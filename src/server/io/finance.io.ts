import "server-only";
import { thisMonth, readRange } from "@/lib/dateRange";
import {
  EXPENSE_CATEGORY_LABELS,
  EXPENSE_STATUS_LABELS,
  INCOME_CATEGORY_LABELS,
  PAYMENT_METHOD_LABELS,
  type Expense,
  type Payment,
} from "@/lib/financeTypes";
import { PAYMENT_STATUS_LABELS } from "@/lib/commerceTypes";
import { parseListQuery } from "../http/query";
import { EXPENSE_FILTERS, listExpenses } from "../services/finance/expense.service";
import { INCOME_FILTERS, listIncome, type IncomeRow } from "../services/finance/income.service";
import { getLedger, type LedgerRow } from "../services/finance/ledger.service";
import { listPayments, PAYMENT_FILTERS } from "../services/finance/payment.service";
import { allRows } from "../services/finance/shared";
import type { IoEntity } from "./types";

const REF_LABEL: Record<string, string> = { ORDER: "Order", EXPENSE: "Expense", INCOME: "Other Income", GENERAL: "General" };

export const incomeIo: IoEntity<IncomeRow> = {
  title: "Income",
  module: "income",
  fileName: "AKOD_Income",
  columns: [
    { header: "Income No", value: (r) => r.txnNo, width: 13 },
    { header: "Date", value: (r) => r.txnDate, width: 12 },
    { header: "Category", value: (r) => INCOME_CATEGORY_LABELS[r.category], width: 18 },
    { header: "Order", value: (r) => r.order?.orderNo ?? "", width: 13 },
    { header: "Order Payment", value: (r) => (r.order ? PAYMENT_STATUS_LABELS[r.order.paymentStatus] : ""), width: 15 },
    { header: "Description", value: (r) => r.description ?? "", width: 34 },
    { header: "Amount", value: (r) => r.amount, width: 13 },
    { header: "Payment Method", value: (r) => (r.paymentMethod ? PAYMENT_METHOD_LABELS[r.paymentMethod] : ""), width: 15 },
    { header: "Reference No", value: (r) => r.referenceNo ?? "", width: 16 },
    { header: "Source", value: (r) => (r.source === "ORDER" ? "Order" : "Manual"), width: 9 },
    { header: "Status", value: (r) => (r.status === "ACTIVE" ? "Active" : "Reversed"), width: 10 },
  ],
  rows: async (params) => (await listIncome(allRows(parseListQuery(params, INCOME_FILTERS)))).items,
};

export const expensesIo: IoEntity<Expense> = {
  title: "Expenses",
  module: "expense",
  fileName: "AKOD_Expenses",
  columns: [
    { header: "Expense No", value: (r) => r.expenseNo, width: 13 },
    { header: "Date", value: (r) => r.expenseDate, width: 12 },
    { header: "Due Date", value: (r) => r.dueDate ?? "", width: 12 },
    { header: "Category", value: (r) => EXPENSE_CATEGORY_LABELS[r.category], width: 18 },
    { header: "Payee", value: (r) => r.payeeName ?? "", width: 22 },
    { header: "Marketplace", value: (r) => r.channel?.name ?? "", width: 14 },
    { header: "Description", value: (r) => r.description ?? "", width: 30 },
    { header: "Amount", value: (r) => r.amount, width: 12 },
    { header: "Paid", value: (r) => r.paid, width: 12 },
    { header: "Balance", value: (r) => r.balance, width: 12 },
    { header: "Status", value: (r) => EXPENSE_STATUS_LABELS[r.status], width: 14 },
    { header: "Reference No", value: (r) => r.referenceNo ?? "", width: 16 },
  ],
  rows: async (params) => (await listExpenses(allRows(parseListQuery(params, EXPENSE_FILTERS)))).items,
};

export const paymentsIo: IoEntity<Payment> = {
  title: "Payments",
  module: "payment",
  fileName: "AKOD_Payments",
  columns: [
    { header: "Payment No", value: (r) => r.paymentNo, width: 13 },
    { header: "Date", value: (r) => r.paymentDate, width: 12 },
    { header: "Type", value: (r) => (r.direction === "RECEIVED" ? "Received" : "Made"), width: 10 },
    { header: "For", value: (r) => REF_LABEL[r.referenceType], width: 13 },
    { header: "Reference", value: (r) => r.referenceLabel ?? "", width: 13 },
    { header: "Party", value: (r) => r.partyName ?? "", width: 24 },
    { header: "Amount", value: (r) => r.amount, width: 12 },
    { header: "Method", value: (r) => PAYMENT_METHOD_LABELS[r.method], width: 14 },
    { header: "Account", value: (r) => r.account?.name ?? "", width: 16 },
    { header: "Transaction Ref", value: (r) => r.transactionRef ?? "", width: 18 },
    { header: "Notes", value: (r) => r.notes ?? "", width: 28 },
    { header: "Entered By", value: (r) => r.createdBy?.name ?? "", width: 16 },
  ],
  rows: async (params) => (await listPayments(allRows(parseListQuery(params, PAYMENT_FILTERS)))).items,
};

/** Same account and period as the ledger screen; first row is the opening balance. */
export const ledgerIo: IoEntity<LedgerRow> = {
  title: "Ledger",
  module: "account",
  fileName: "AKOD_Ledger",
  columns: [
    { header: "Date", value: (r) => r.date, width: 12 },
    { header: "Payment No", value: (r) => r.paymentNo, width: 13 },
    { header: "Party", value: (r) => r.party, width: 24 },
    { header: "Reference", value: (r) => r.reference, width: 13 },
    { header: "Account", value: (r) => r.account, width: 16 },
    { header: "Method", value: (r) => (r.method ? PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.method : ""), width: 13 },
    { header: "Money In", value: (r) => r.in || null, width: 12 },
    { header: "Money Out", value: (r) => r.out || null, width: 12 },
    { header: "Balance", value: (r) => r.balance, width: 13 },
    { header: "Notes", value: (r) => r.notes, width: 28 },
  ],
  rows: async (params) => {
    const range = readRange(params.get("from") ?? undefined, params.get("to") ?? undefined, thisMonth());
    const ledger = await getLedger(params.get("account") || undefined, range);
    const opening: LedgerRow = {
      _id: "opening", date: range.from, paymentNo: "", party: "Opening balance", referenceType: "GENERAL", referenceId: null,
      reference: "", account: ledger.account?.name ?? "All accounts", method: "", notes: "", in: 0, out: 0, balance: ledger.opening,
    };
    return [opening, ...ledger.rows];
  },
};
