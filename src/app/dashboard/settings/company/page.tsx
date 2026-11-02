import { CompanyForm } from "@/components/settings/CompanyForm";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { getPageAccess } from "@/server/auth/session";
import { getCompanySettings } from "@/server/services/setting.service";

export const metadata = { title: "Company Settings" };

export default async function Page() {
  const { allowed } = await getPageAccess("setting", "update");
  if (!allowed) return <AccessDenied />;
  return <CompanyForm initial={await getCompanySettings()} />;
}
