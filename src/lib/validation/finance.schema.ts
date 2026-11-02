import * as Yup from "yup";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS } from "../financeTypes";
import { optionalDay, optionalObjectId, optionalText, positiveRupees, requiredDay, requiredText, rupees, statusField } from "./common";

const method = Yup.string()
  .oneOf([...PAYMENT_METHODS], "Select a payment method")
  .required("Payment method is required");

/** Other income (manual) — always received in full when entered. */
export const incomeSchema = Yup.object({
  txnDate: requiredDay("Date"),
  category: Yup.string().oneOf([...INCOME_CATEGORIES], "Select a category").default("OTHER_INCOME"),
  description: requiredText("Description", 300),
  amount: positiveRupees("Amount"),
  paymentMethod: method,
  accountId: optionalObjectId("Account"),
  referenceNo: optionalText("Reference number", 80),
});
export type IncomeInput = Yup.InferType<typeof incomeSchema>;

/** Expense; `paidNow` (create only) posts a payment made straight away. */
export const expenseSchema = Yup.object({
  expenseDate: requiredDay("Expense date"),
  dueDate: optionalDay("Due date"),
  category: Yup.string().oneOf([...EXPENSE_CATEGORIES], "Select a category").required("Category is required"),
  payeeName: optionalText("Payee name", 120),
  channel: optionalObjectId("Marketplace"),
  description: optionalText("Description", 300),
  amount: positiveRupees("Amount"),
  paidNow: rupees("Paid now").test("not-more", "Paid now cannot be more than the amount", function (v) {
    return !v || v <= (this.parent.amount ?? 0);
  }),
  paymentMethod: Yup.string()
    .oneOf([...PAYMENT_METHODS, ""], "Select a payment method")
    .default("")
    .test("needed", "Select how it was paid", function (v) {
      return !this.parent.paidNow || Boolean(v);
    }),
  accountId: optionalObjectId("Account"),
  referenceNo: optionalText("Reference number", 80),
});
export type ExpenseInput = Yup.InferType<typeof expenseSchema>;

export const paymentSchema = Yup.object({
  paymentDate: requiredDay("Payment date"),
  direction: Yup.string().oneOf(["RECEIVED", "MADE"], "Select received or made").required("Select received or made"),
  referenceType: Yup.string().oneOf(["ORDER", "EXPENSE", "GENERAL"], "Select what the payment is for").default("GENERAL"),
  referenceId: optionalObjectId("Reference").test("needed", "Select the order or expense", function (v) {
    return this.parent.referenceType === "GENERAL" || Boolean(v);
  }),
  amount: positiveRupees("Amount"),
  method,
  accountId: optionalObjectId("Account"),
  transactionRef: optionalText("Transaction reference", 80),
  notes: optionalText("Notes", 300),
  partyName: optionalText("Party name", 120).test("needed", "Enter who the payment is with", function (v) {
    return this.parent.referenceType !== "GENERAL" || Boolean(v);
  }),
});
export type PaymentInput = Yup.InferType<typeof paymentSchema>;

export const accountSchema = Yup.object({
  code: requiredText("Code", 20).matches(/^[A-Za-z0-9_-]+$/, "Code may use letters, numbers, - and _ only"),
  name: requiredText("Account name", 80),
  type: Yup.string().oneOf(["CASH", "BANK"], "Select Cash or Bank").required("Type is required"),
  openingBalance: rupees("Opening balance"),
  isDefault: Yup.boolean().default(false),
  description: optionalText("Description", 200),
  status: statusField,
});
export type AccountInput = Yup.InferType<typeof accountSchema>;
