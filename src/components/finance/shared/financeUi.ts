import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  INCOME_CATEGORIES,
  INCOME_CATEGORY_LABELS,
  PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type ExpenseStatus,
} from "@/lib/financeTypes";
import type { Option } from "@/lib/types";

export const METHOD_OPTIONS: Option[] = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABELS[m] }));
export const INCOME_CATEGORY_OPTIONS: Option[] = INCOME_CATEGORIES.map((c) => ({ value: c, label: INCOME_CATEGORY_LABELS[c] }));
export const EXPENSE_CATEGORY_OPTIONS: Option[] = EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_LABELS[c] }));
export const EXPENSE_STATUS_OPTIONS: Option[] = (["PENDING", "PARTIAL", "PAID", "CANCELLED"] as ExpenseStatus[]).map((s) => ({
  value: s,
  label: EXPENSE_STATUS_LABELS[s],
}));

export const REFERENCE_TYPE_LABELS: Record<string, string> = {
  ORDER: "Order",
  EXPENSE: "Expense",
  INCOME: "Other Income",
  GENERAL: "General",
};

/** Account dropdown entry (from /api/finance/accounts?options=1 or the server page). */
export interface AccountOption extends Option {
  type: string;
  isDefault: boolean;
}

export const FINANCE_PATHS = {
  income: "/dashboard/finance/income",
  expenses: "/dashboard/finance/expenses",
  payments: "/dashboard/finance/payments",
  accounts: "/dashboard/finance/accounts",
  ledger: "/dashboard/finance/accounts/ledger",
  orders: "/dashboard/orders",
} as const;

/** Where a payment's reference opens. */
export function referenceHref(type: string, id?: string | null): string | null {
  if (!id) return null;
  if (type === "ORDER") return `${FINANCE_PATHS.orders}/${id}`;
  if (type === "EXPENSE") return `${FINANCE_PATHS.expenses}/${id}`;
  return null;
}
