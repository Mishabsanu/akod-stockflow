import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidObjectId, Types } from "mongoose";
import { can, normalizePermissions, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { connectDB } from "../db";
import { Role, type RoleDoc } from "../models/Role";
import { User } from "../models/User";
import { readSessionToken, SESSION_COOKIE } from "./token";

/**
 * Signed-in users resolved in the last few seconds. Every page and API call needs the session, so
 * this saves a database round trip on most clicks. Cleared whenever a user or role changes
 * (invalidateSessionCache), so deactivation and permission changes still apply straight away.
 */
const SESSION_TTL_MS = 15_000;
const sessionCache = new Map<string, { user: SessionUser | null; expires: number }>();

export function invalidateSessionCache(): void {
  sessionCache.clear();
}

/** User + role in one query (was two round trips). */
async function fetchSessionUser(uid: string): Promise<SessionUser | null> {
  await connectDB();
  const [row] = await User.aggregate<{ _id: unknown; name: string; email: string; status: string; role: RoleDoc | undefined }>([
    { $match: { _id: new Types.ObjectId(uid) } },
    { $project: { name: 1, email: 1, status: 1, role: 1 } },
    { $lookup: { from: Role.collection.name, localField: "role", foreignField: "_id", as: "role" } },
    { $set: { role: { $first: "$role" } } },
  ]);
  if (!row || row.status !== "active") return null;
  const role = row.role;
  if (!role || role.status !== "active") return null;
  return {
    _id: String(row._id),
    name: row.name,
    email: row.email,
    roleName: role.name,
    isSuperAdmin: role.isSuperAdmin,
    permissions: normalizePermissions(role.permissions),
  };
}

/** Loads the signed-in user (from the short-lived cache when fresh). */
export async function loadSessionUser(token?: string): Promise<SessionUser | null> {
  const session = readSessionToken(token);
  if (!session || !isValidObjectId(session.uid)) return null;

  const hit = sessionCache.get(session.uid);
  if (hit && hit.expires > Date.now()) return hit.user;

  const user = await fetchSessionUser(session.uid);
  if (sessionCache.size > 500) sessionCache.clear();
  sessionCache.set(session.uid, { user, expires: Date.now() + SESSION_TTL_MS });
  return user;
}

/** Current user for Server Components, deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  return loadSessionUser(store.get(SESSION_COOKIE)?.value);
});

/** For pages: sends anonymous visitors to the login screen. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * For pages: returns the user plus whether they hold the permission (page shows AccessDenied if not).
 */
export async function getPageAccess(module: PermissionModule, action: PermissionAction = "view") {
  const user = await requireUser();
  return { user, allowed: can(user, module, action) };
}
