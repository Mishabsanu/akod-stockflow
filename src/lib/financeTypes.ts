/**
 * Finance follows Proserve ERP: one Payments table (Received / Made) linked to the order or
 * expense it settles; balances are recalculated from those payments; each payment hits a
 * Cash / Bank account, which gives the ledger.
 */
import type { NamedRef, RecordStatus } from "./types";

export const PAYMENT_METHODS = ["CASH", "BANK_TRANSFER", "UPI", "CARD", "OTHER"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

export const INCOME_CATEGORIES = ["MARKETPLACE_SALES", "LOCAL_SALES", "DISTRIBUTOR_SALES", "OTHER_INCOME"] as const;
export type IncomeCategory = (typeof INCOME_CATEGORIES)[number];

export const INCOME_CATEGORY_LABELS: Record<IncomeCategory, string> = {
  MARKETPLACE_SALES: "Marketplace Sales",
  LOCAL_SALES: "Local Sales",
  DISTRIBUTOR_SALES: "Distributor Sales",
  OTHER_INCOME: "Other Income",
};

export const EXPENSE_CATEGORIES = [
  "TRANSPORTATION",
  "PACKAGING",
  "MARKETING",
  "RENT",
  "SALARY",
  "UTILITIES",
  "MARKETPLACE_FEES",
  "OTHER",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategory, string> = {
  TRANSPORTATION: "Transportation",
  PACKAGING: "Packaging",
  MARKETING: "Marketing",
  RENT: "Rent",
  SALARY: "Salary",
  UTILITIES: "Utilities",
  MARKETPLACE_FEES: "Marketplace Fees",
  OTHER: "Other Expenses",
};

export type ExpenseStatus = "PENDING" | "PARTIAL" | "PAID" | "CANCELLED";

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partially Paid",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export type AccountType = "CASH" | "BANK";

export interface FinanceAccount {
  _id: string;
  code: string;
  name: string;
  type: AccountType;
  openingBalance: number;
  /** Opening + received − paid */
  balance?: number;
  isDefault: boolean;
  description?: string;
  status: RecordStatus;
}

export interface Income {
  _id: string;
  txnNo: string;
  txnDate: string;
  category: IncomeCategory;
  order: { _id: string; orderNo: string } | null;
  description?: string;
  amount: number;
  /** Manual (other) income only — order income is settled through payments */
  paymentMethod?: PaymentMethod | "";
  referenceNo?: string;
  source: "ORDER" | "MANUAL";
  /** Reversed when the order is cancelled or returned */
  status: "ACTIVE" | "REVERSED";
  createdAt?: string;
}

export interface Expense {
  _id: string;
  expenseNo: string;
  expenseDate: string;
  dueDate?: string;
  category: ExpenseCategory;
  payeeName?: string;
  channel: NamedRef | null;
  description?: string;
  amount: number;
  paid: number;
  balance: number;
  status: ExpenseStatus;
  paymentMethod?: PaymentMethod | "";
  referenceNo?: string;
  createdAt?: string;
}

export type PaymentDirection = "RECEIVED" | "MADE";
export type PaymentRefType = "ORDER" | "EXPENSE" | "INCOME" | "GENERAL";

export interface Payment {
  _id: string;
  paymentNo: string;
  paymentDate: string;
  direction: PaymentDirection;
  referenceType: PaymentRefType;
  referenceId?: string | null;
  /** Order no. / expense no. shown in lists */
  referenceLabel?: string;
  partyName?: string;
  amount: number;
  method: PaymentMethod;
  account: NamedRef | null;
  transactionRef?: string;
  notes?: string;
  createdBy?: { _id: string; name: string } | null;
  createdAt?: string;
}
