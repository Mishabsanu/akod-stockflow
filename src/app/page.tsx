import { redirect } from "next/navigation";
import { homePath } from "@/lib/permissions";
import { getCurrentUser } from "@/server/auth/session";

/** Signed-in users go to the dashboard, everyone else to the login page. */
export default async function Home() {
  const user = await getCurrentUser();
  redirect(user ? homePath(user) : "/login");
}
