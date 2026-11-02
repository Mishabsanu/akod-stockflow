"use client";

import { Ban, Edit2, Eye, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { Modal } from "@/components/ui/Modal";
import type { Expense } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { apiRequest, ApiError } from "@/services/apiClient";
import { RecordPaymentModal } from "../payments/RecordPaymentModal";
import { FINANCE_PATHS } from "../shared/financeUi";
import { ExpenseFormModal, type ExpenseFormOptions } from "./ExpenseFormModal";

const iconBtn = "p-1 rounded text-slate-400 transition-colors";

/** View · Edit · Pay · Cancel · Delete for one expense (each only when allowed). */
export function ExpenseRowActions({
  expense,
  options,
  showView = true,
  autoPay = false,
}: {
  expense: Expense;
  options: ExpenseFormOptions;
  showView?: boolean;
  /** Open the payment form on mount (detail page with ?pay=1) */
  autoPay?: boolean;
}) {
  const router = useRouter();
  const canEdit = usePermission("expense", "update");
  const canDelete = usePermission("expense", "delete");
  const canPay = usePermission("payment", "create");
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);
  const [busy, setBusy] = useState(false);

  const open = expense.status === "PENDING" || expense.status === "PARTIAL";
  const unpaid = expense.paid === 0;

  const run = async (kind: "cancel" | "delete") => {
    setBusy(true);
    try {
      if (kind === "cancel") await apiRequest(`/api/finance/expenses/${expense._id}/cancel`, "POST");
      else await apiRequest(`/api/finance/expenses/${expense._id}`, "DELETE");
      toast.success(kind === "cancel" ? "Expense cancelled" : "Expense deleted");
      setConfirm(null);
      if (kind === "delete" && !showView) router.push(FINANCE_PATHS.expenses);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center justify-center gap-1.5">
      {showView && (
        <Link href={`${FINANCE_PATHS.expenses}/${expense._id}`} title="View expense" className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
          <Eye className="w-3.5 h-3.5" />
        </Link>
      )}
      {canEdit && expense.status !== "CANCELLED" && (
        <button type="button" onClick={() => setEditing(true)} title="Edit expense" className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
          <Edit2 className="w-3.5 h-3.5" />
        </button>
      )}
      {canPay && open && (
        <RecordPaymentModal
          accounts={options.accounts}
          initialOpen={autoPay}
          preset={{
            direction: "MADE",
            referenceType: "EXPENSE",
            referenceId: expense._id,
            label: `${expense.expenseNo}${expense.payeeName ? ` — ${expense.payeeName}` : ""}`,
            max: expense.balance,
          }}
          trigger={(show) => (
            <button type="button" onClick={show} title="Record payment" className={`${iconBtn} hover:text-emerald-700 hover:bg-emerald-50`}>
              <Wallet className="w-3.5 h-3.5" />
            </button>
          )}
        />
      )}
      {canEdit && expense.status !== "CANCELLED" && unpaid && (
        <button type="button" onClick={() => setConfirm("cancel")} title="Cancel expense" className={`${iconBtn} hover:text-amber-700 hover:bg-amber-50`}>
          <Ban className="w-3.5 h-3.5" />
        </button>
      )}
      {canDelete && unpaid && (
        <button type="button" onClick={() => setConfirm("delete")} title="Delete expense" className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}>
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}

      <ExpenseFormModal {...options} open={editing} onClose={() => setEditing(false)} expense={expense} />
      <ConfirmDeleteModal
        open={confirm === "delete"}
        entityLabel="Expense"
        itemName={`${expense.expenseNo} — ${formatCurrency(expense.amount)}`}
        loading={busy}
        onCancel={() => setConfirm(null)}
        onConfirm={() => run("delete")}
      />
      <Modal
        open={confirm === "cancel"}
        onClose={() => setConfirm(null)}
        size="sm"
        title={`Cancel ${expense.expenseNo}?`}
        subtitle="It stays on record but no longer counts as an expense or payable."
        icon={<Ban className="w-4 h-4" />}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirm(null)} disabled={busy}>
              Keep it
            </Button>
            <Button variant="danger" onClick={() => run("cancel")} loading={busy}>
              Cancel Expense
            </Button>
          </>
        }
      >
        <p className="text-xs text-slate-600">
          {formatCurrency(expense.amount)} {expense.payeeName ? `to ${expense.payeeName}` : ""} will be marked as cancelled.
        </p>
      </Modal>
    </div>
  );
}
