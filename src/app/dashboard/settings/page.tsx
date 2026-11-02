import { redirectToModuleHome } from "@/server/utils/moduleHome";

export default async function Page() {
  return redirectToModuleHome("settings");
}
