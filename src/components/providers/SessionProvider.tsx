"use client";

import { createContext, useContext, type ReactNode } from "react";
import { can, type PermissionAction, type PermissionModule } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

const SessionContext = createContext<SessionUser | null>(null);

/** Receives the user from the server layout — no client-side fetch, no loading flash. */
export function SessionProvider({ user, children }: { user: SessionUser; children: ReactNode }) {
  return <SessionContext.Provider value={user}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionUser {
  const user = useContext(SessionContext);
  if (!user) throw new Error("useSession must be used inside SessionProvider");
  return user;
}

export function usePermission(module: PermissionModule, action: PermissionAction = "view"): boolean {
  return can(useSession(), module, action);
}
