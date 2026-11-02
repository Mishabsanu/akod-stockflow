import "server-only";
import { redirect } from "next/navigation";
import { visibleModules } from "@/components/layout/navigation";
import { requireUser } from "../auth/session";

/** Module index pages (/dashboard/finance …) open the first screen of that module this user may see. */
export async function redirectToModuleHome(moduleId: string): Promise<never> {
  const user = await requireUser();
  const navModule = visibleModules(user).find((m) => m.id === moduleId);
  redirect(navModule?.items[0]?.href ?? "/dashboard/overview");
}
