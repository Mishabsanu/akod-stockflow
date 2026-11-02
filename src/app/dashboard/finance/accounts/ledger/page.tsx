import { LedgerPage } from "@/components/finance/accounts/AccountPages";

export const metadata = { title: "Ledger" };

export default function Page({ searchParams }: PageProps<"/dashboard/finance/accounts/ledger">) {
  return <LedgerPage searchParams={searchParams} />;
}
