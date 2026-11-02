import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isValidObjectId } from "mongoose";
import { can, normalizePermissions, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";
import { connectDB } from "../db";
import { Role, type RoleDoc } from "../models/Role";
import { User } from "../models/User";
import { readSessionToken, SESSION_COOKIE } from "./token";

/** Loads the signed-in user fresh from the DB, so deactivation or role changes apply immediately. */
export async function loadSessionUser(token?: string): Promise<SessionUser | null> {
  const session = readSessionToken(token);
  if (!session || !isValidObjectId(session.uid)) return null;

  await connectDB();
  const user = await User.findById(session.uid).select("name email status role").lean();
  if (!user || user.status !== "active") return null;

  const role = await Role.findById(user.role).lean<RoleDoc>();
  if (!role || role.status !== "active") return null;

  return {
    _id: String(user._id),
    name: user.name,
    email: user.email,
    roleName: role.name,
    isSuperAdmin: role.isSuperAdmin,
    permissions: normalizePermissions(role.permissions),
  };
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
