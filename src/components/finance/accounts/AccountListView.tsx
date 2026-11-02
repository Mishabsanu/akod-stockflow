"use client";

import { BookOpen, Edit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/providers/SessionProvider";
import type { Column } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { FinanceAccount } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { apiRequest, ApiError } from "@/services/apiClient";
import { FINANCE_PATHS } from "../shared/financeUi";
import { StaticTable } from "../shared/FinanceWidgets";
import { AccountFormModal } from "./AccountFormModal";

const iconBtn = "p-1 rounded text-slate-400 transition-colors";

export function AccountListView({ accounts }: { accounts: FinanceAccount[] }) {
  const router = useRouter();
  const canEdit = usePermission("account", "update");
  const canDelete = usePermission("account", "delete");
  const [editing, setEditing] = useState<FinanceAccount | null>(null);
  const [deleting, setDeleting] = useState<FinanceAccount | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiRequest(`/api/finance/accounts/${deleting._id}`, "DELETE");
      toast.success("Account deleted");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<Column<FinanceAccount>[]>(
    () => [
      {
        key: "name",
        label: "Account",
        render: (r) => (
          <span className="inline-flex flex-col">
            <span className="font-semibold text-slate-900">
              {r.name} {r.isDefault && <Badge variant="brand">Default</Badge>}
            </span>
            <span className="font-mono text-[11px] text-slate-500">{r.code}</span>
          </span>
        ),
      },
      { key: "type", label: "Type", render: (r) => (r.type === "CASH" ? "Cash" : "Bank / UPI") },
      { key: "openingBalance", label: "Opening", align: "right", render: (r) => formatCurrency(r.openingBalance) },
      {
        key: "balance",
        label: "Current Balance",
        align: "right",
        render: (r) => <span className={`font-bold ${(r.balance ?? 0) < 0 ? "text-rose-700" : "text-slate-900"}`}>{formatCurrency(r.balance ?? 0)}</span>,
      },
      { key: "status", label: "Status", align: "center", render: (r) => <StatusBadge status={r.status} /> },
      {
        key: "actions",
        label: "Actions",
        align: "center",
        render: (r) => (
          <span className="inline-flex items-center gap-1.5">
            <Link href={`${FINANCE_PATHS.ledger}?account=${r._id}`} title="Open ledger" className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
              <BookOpen className="w-3.5 h-3.5" />
            </Link>
            {canEdit && (
              <button type="button" onClick={() => setEditing(r)} title="Edit account" className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={() => setDeleting(r)} title="Delete account" className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}>
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        ),
      },
    ],
    [canEdit, canDelete]
  );

  const total = accounts.filter((a) => a.status === "active").reduce((s, a) => s + (a.balance ?? 0), 0);

  return (
    <>
      <StaticTable rows={accounts} columns={columns} itemName="accounts" footer={["Total (active)", "", "", formatCurrency(total), "", ""]} />
      <AccountFormModal account={editing ?? undefined} open={Boolean(editing)} onClose={() => setEditing(null)} />
      <ConfirmDeleteModal
        open={Boolean(deleting)}
        entityLabel="Account"
        itemName={deleting?.name}
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
