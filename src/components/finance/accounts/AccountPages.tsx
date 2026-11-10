import { BookOpen } from "lucide-react";
import Link from "next/link";
import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { readRange, thisMonth } from "@/lib/dateRange";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { getAccount, listAccountOptions, listAccounts } from "@/server/services/finance/account.service";
import { getLedger } from "@/server/services/finance/ledger.service";
import { orNotFound } from "@/server/utils/pageData";
import { DateRangeFilter } from "../shared/DateRangeFilter";
import { FINANCE_PATHS } from "../shared/financeUi";
import { AccountFormModal, NewAccountButton } from "./AccountFormModal";
import { AccountListView } from "./AccountListView";
import { LedgerAccountSelect, LedgerView } from "./LedgerView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const linkBtn =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition";

export async function AccountListPage() {
  const { user, allowed } = await getPageAccess("account", "view");
  if (!allowed) return <AccessDenied />;
  const accounts = await listAccounts();
  return (
    <>
      <PageHeader
        title="Cash & Bank Accounts"
        description="Every payment lands in one of these. Balance = opening + received − paid."
        actions={
          <>
            <Link href={FINANCE_PATHS.ledger} className={linkBtn}>
              <BookOpen className="w-4 h-4" />
              Ledger
            </Link>
            {can(user, "account", "create") && <NewAccountButton />}
          </>
        }
      />
      <AccountListView accounts={accounts} />
    </>
  );
}

export async function LedgerPage({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getPageAccess("account", "view");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const range = readRange(one(sp.from), one(sp.to), thisMonth());
  const accountId = one(sp.account);
  const [ledger, options] = await Promise.all([orNotFound(getLedger(accountId || undefined, range)), listAccountOptions()]);

  return (
    <>
      <PageHeader
        title={ledger.account ? `Ledger — ${ledger.account.name}` : "Ledger — All Accounts"}
        description="Cash / bank book: every payment in date order with a running balance."
        actions={<ImportExport entity="ledger" title="Ledger" />}
      />
      <div className="flex flex-col lg:flex-row lg:items-end gap-3">
        <LedgerAccountSelect accounts={options.map(({ value, label }) => ({ value, label }))} value={accountId} />
        <DateRangeFilter from={range.from} to={range.to} />
      </div>
      <LedgerView ledger={ledger} />
    </>
  );
}

/** New Account — full page. */
export async function AccountCreatePage() {
  const { allowed } = await getPageAccess("account", "create");
  if (!allowed) return <AccessDenied />;
  return <AccountFormModal page={{ backHref: FINANCE_PATHS.accounts }} />;
}

/** Edit Account — full page. */
export async function AccountEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await getPageAccess("account", "update");
  if (!allowed) return <AccessDenied />;
  const account = await orNotFound(getAccount((await params).id));
  return <AccountFormModal account={account} page={{ backHref: FINANCE_PATHS.accounts }} />;
}
