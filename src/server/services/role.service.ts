import "server-only";
import { isValidObjectId, type Types } from "mongoose";
import {
  normalizePermissions,
  PERMISSION_ACTIONS,
  PERMISSION_MODULES,
  type ModulePermission,
  type PermissionModule,
} from "@/lib/permissions";
import type { Option, Paginated, Role } from "@/lib/types";
import type { RoleInput } from "@/lib/validation/role.schema";
import { Role as RoleModel, type RoleDoc } from "../models/Role";
import { User } from "../models/User";
import { AppError, notFound } from "../http/errors";
import { paginate, searchFilter, statusFilter, type Filter, type ListQuery } from "../http/query";
import { toPlain } from "../utils/serialize";

const SEARCH_FIELDS = ["name", "description"];

const SORTS: Record<string, Record<string, 1 | -1>> = {
  newest: { createdAt: -1 },
  oldest: { createdAt: 1 },
  name: { nameKey: 1 },
};

type FullMap = Record<PermissionModule, ModulePermission>;

/** Super Admin always has every permission, whatever is stored on the document. */
function fullPermissions(): FullMap {
  return Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m, { view: true, create: true, update: true, delete: true }])
  ) as FullMap;
}

function samePermissions(a: FullMap, b: FullMap): boolean {
  return PERMISSION_MODULES.every((m) => PERMISSION_ACTIONS.every((act) => a[m][act] === b[m][act]));
}

/** Shapes a lean role for the client: effective permissions + optional user count. */
function toRole(doc: RoleDoc, userCount?: number): Role {
  const role = toPlain<Role & { nameKey?: string; createdBy?: string; __v?: number }>(doc);
  delete role.nameKey;
  delete role.createdBy;
  delete role.__v;
  role.permissions = doc.isSuperAdmin ? fullPermissions() : normalizePermissions(doc.permissions);
  if (userCount !== undefined) role.userCount = userCount;
  return role;
}

/** Number of users per role id, in one grouped query. */
async function countUsersByRole(roleIds: Types.ObjectId[]): Promise<Map<string, number>> {
  if (roleIds.length === 0) return new Map();
  const rows = await User.aggregate<{ _id: Types.ObjectId; count: number }>([
    { $match: { role: { $in: roleIds } } },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export async function listRoles(query: ListQuery): Promise<Paginated<Role>> {
  const filter: Filter = { ...searchFilter(query.search, SEARCH_FIELDS), ...statusFilter(query.status) };
  const [docs, total] = await Promise.all([
    RoleModel.find(filter)
      .sort(SORTS[query.sort] || SORTS.newest)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .select("-__v")
      .lean<RoleDoc[]>(),
    RoleModel.countDocuments(filter),
  ]);
  const counts = await countUsersByRole(docs.map((d) => d._id));
  return paginate(
    docs.map((d) => toRole(d, counts.get(String(d._id)) ?? 0)),
    total,
    query
  );
}

async function findRole(id: string): Promise<RoleDoc> {
  if (!isValidObjectId(id)) throw notFound("Role");
  const doc = await RoleModel.findById(id).select("-__v").lean<RoleDoc>();
  if (!doc) throw notFound("Role");
  return doc;
}

export async function getRole(id: string): Promise<Role> {
  const doc = await findRole(id);
  const userCount = await User.countDocuments({ role: doc._id });
  return toRole(doc, userCount);
}

export async function createRole(input: RoleInput, userId: string): Promise<Role> {
  const doc = await RoleModel.create({
    name: input.name,
    nameKey: input.name.trim().toLowerCase(),
    description: input.description || "",
    status: input.status,
    isSuperAdmin: false,
    permissions: normalizePermissions(input.permissions),
    createdBy: userId,
  });
  return toRole(doc.toObject() as RoleDoc, 0);
}

export async function updateRole(id: string, input: RoleInput): Promise<Role> {
  const existing = await findRole(id);
  const update: Record<string, unknown> = {
    name: input.name,
    nameKey: input.name.trim().toLowerCase(),
    description: input.description || "",
  };

  if (existing.isSuperAdmin) {
    if (input.status !== "active") {
      throw new AppError("The Super Admin role cannot be deactivated.", 409);
    }
    if (!samePermissions(normalizePermissions(input.permissions), fullPermissions())) {
      throw new AppError("Super Admin permissions cannot be changed. This role always has full access.", 409);
    }
  } else {
    update.status = input.status;
    update.permissions = normalizePermissions(input.permissions);
  }

  const doc = await RoleModel.findByIdAndUpdate(id, update, { returnDocument: "after", runValidators: true })
    .select("-__v")
    .lean<RoleDoc>();
  if (!doc) throw notFound("Role");
  const userCount = await User.countDocuments({ role: doc._id });
  return toRole(doc, userCount);
}

export async function deleteRole(id: string): Promise<void> {
  const existing = await findRole(id);
  if (existing.isSuperAdmin) {
    throw new AppError("The Super Admin role cannot be deleted.", 409);
  }
  const assigned = await User.countDocuments({ role: existing._id });
  if (assigned > 0) {
    throw new AppError(`${assigned} user(s) still have this role. Reassign them first.`, 409);
  }
  const deleted = await RoleModel.findByIdAndDelete(id);
  if (!deleted) throw notFound("Role");
}

/** Active roles for dropdowns. `includeInactive` is for list filters (inactive ones are labelled). */
export async function listRoleOptions({ includeInactive = false } = {}): Promise<Option[]> {
  const filter: Filter = includeInactive ? {} : { status: "active" };
  const docs = await RoleModel.find(filter).sort({ nameKey: 1 }).select("name status").limit(500).lean();
  return docs.map((d) => ({
    value: String(d._id),
    label: d.status === "active" ? d.name : `${d.name} (inactive)`,
  }));
}
