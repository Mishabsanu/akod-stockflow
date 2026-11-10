import { AccountEditPage } from "@/components/finance/accounts/AccountPages";

export const metadata = { title: "Edit Account" };

export default function Page({ params }: PageProps<"/dashboard/finance/accounts/[id]/edit">) {
  return <AccountEditPage params={params} />;
}
