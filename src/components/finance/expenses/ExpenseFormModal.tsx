"use client";

import { Form, Formik } from "formik";
import { Plus, Receipt } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormSurface } from "@/components/forms/FormSurface";
import { SelectField, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { Expense } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { todayIST } from "@/lib/indiaDate";
import type { Option } from "@/lib/types";
import { expenseSchema, type ExpenseInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";
import { EXPENSE_CATEGORY_OPTIONS, FINANCE_PATHS, type AccountOption } from "../shared/financeUi";
import { PaymentModeFields } from "../shared/PaymentModeFields";

export interface ExpenseFormOptions {
  accounts: AccountOption[];
  channels: Option[];
}

interface Props extends ExpenseFormOptions {
  open?: boolean;
  onClose?: () => void;
  /** Full page (New / Edit Expense screens) instead of a modal */
  page?: { backHref: string };
  /** Edit this expense; omit to create */
  expense?: Expense;
}

const FORM_ID = "expense-form";

function initial(expense?: Expense): ExpenseInput {
  return {
    expenseDate: expense?.expenseDate ?? todayIST(),
    dueDate: expense?.dueDate ?? "",
    category: (expense?.category ?? "") as ExpenseInput["category"],
    payeeName: expense?.payeeName ?? "",
    channel: expense?.channel?._id ?? "",
    description: expense?.description ?? "",
    amount: expense?.amount ?? 0,
    paidNow: 0,
    paymentMethod: (expense?.paymentMethod ?? "") as ExpenseInput["paymentMethod"],
    accountId: "",
    referenceNo: expense?.referenceNo ?? "",
  };
}

/** Create / edit an expense. On create, "Paid now" posts a payment made straight away (rest stays payable). */
export function ExpenseFormModal({ open, onClose, expense, accounts, channels, page }: Props) {
  const router = useRouter();
  const isEdit = Boolean(expense);
  const close = page ? () => router.push(page.backHref) : () => onClose?.();
  const onSubmit = useApiSubmit<ExpenseInput, Expense>({
    request: (values) =>
      isEdit ? apiRequest<Expense>(`/api/finance/expenses/${expense!._id}`, "PUT", values) : apiRequest<Expense>("/api/finance/expenses", "POST", values),
    successMessage: isEdit ? "Expense updated" : "Expense saved",
    onSuccess: page ? undefined : onClose,
    redirectTo: page ? (saved) => `${FINANCE_PATHS.expenses}/${saved?._id ?? expense?._id ?? ""}` : undefined,
  });

  if (!open && !page) return null;

  return (
    <Formik initialValues={initial(expense)} validationSchema={expenseSchema} onSubmit={onSubmit}>
      {({ isSubmitting, values }) => (
        <FormSurface
          page={page}
          onClose={close}
          size="lg"
          title={isEdit ? `Edit ${expense!.expenseNo}` : "New Expense"}
          subtitle={isEdit ? `Paid so far ${formatCurrency(expense!.paid)} — record more from "Pay"` : "Rent, salary, packaging, marketplace fees …"}
          icon={<Receipt className="w-4 h-4" />}
          footer={
            <>
              <Button variant="outline" onClick={close} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                {isEdit ? "Save Changes" : "Save Expense"}
              </Button>
            </>
          }
        >
          <Form id={FORM_ID} noValidate className="space-y-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <TextField name="expenseDate" label="Expense Date" type="date" required />
              <SelectField name="category" label="Category" required placeholder="Select category" options={EXPENSE_CATEGORY_OPTIONS} />
              <TextField name="amount" label="Amount (₹)" type="number" min={0} step="0.01" required />
              <TextField name="payeeName" label="Payee Name" placeholder="Who is paid (optional)" maxLength={120} />
              <TextField name="dueDate" label="Due Date" type="date" hint="When it must be paid (payables)" />
              {(values.category === "MARKETPLACE_FEES" || values.channel) && channels.length > 0 ? (
                <SelectField name="channel" label="Marketplace" placeholder="Not linked" options={channels} />
              ) : (
                <TextField name="referenceNo" label="Bill / Reference No" maxLength={80} />
              )}
              <TextAreaField name="description" label="Description" rows={2} className="sm:col-span-2 lg:col-span-3" maxLength={300} />
            </div>

            {!isEdit && (
              <div className="border border-line rounded-xl p-4 bg-head/50 space-y-3">
                <p className="text-xs font-bold text-slate-700">
                  Paid now <span className="font-normal text-slate-500">— leave 0 if it is still to be paid (it shows in Payables)</span>
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <TextField name="paidNow" label="Amount Paid (₹)" type="number" min={0} step="0.01" />
                  {values.paidNow ? (
                    <PaymentModeFields
                      methodName="paymentMethod"
                      referenceName="referenceNo"
                      referenceLabel="Payment Reference"
                      showReference={values.category === "MARKETPLACE_FEES" || Boolean(values.channel)}
                      accounts={accounts}
                    />
                  ) : null}
                </div>
              </div>
            )}
          </Form>
        </FormSurface>
      )}
    </Formik>
  );
}

/** Header button: opens the New Expense page. */
export function NewExpenseButton() {
  return (
    <Link
      href={`${FINANCE_PATHS.expenses}/new`}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-bold transition"
    >
      <Plus className="w-4 h-4" />
      New Expense
    </Link>
  );
}
