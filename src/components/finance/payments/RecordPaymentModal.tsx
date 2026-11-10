"use client";

import { Form, Formik } from "formik";
import { Plus, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { FormSurface } from "@/components/forms/FormSurface";
import { SelectField, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import type { PaymentDirection } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { todayIST } from "@/lib/indiaDate";
import { paymentSchema, type PaymentInput } from "@/lib/validation/finance.schema";
import { apiRequest } from "@/services/apiClient";
import { FINANCE_PATHS, type AccountOption } from "../shared/financeUi";
import { PaymentModeFields } from "../shared/PaymentModeFields";
import { maxHint, ReferencePicker } from "./ReferencePicker";

/** Pay one known order / expense (from its row or detail page). */
export interface PaymentPreset {
  direction: PaymentDirection;
  referenceType: "ORDER" | "EXPENSE";
  referenceId: string;
  /** e.g. "EXP-00012 — Blue Dart" */
  label: string;
  /** Still due (rupees) */
  max: number;
}

interface Props {
  accounts: AccountOption[];
  preset?: PaymentPreset;
  /** Custom trigger; receives the open function */
  trigger?: (open: () => void) => ReactNode;
  /** Open as soon as it mounts (Payables links with ?pay=1) */
  initialOpen?: boolean;
  buttonLabel?: string;
  /** Full page (Record Payment screen) instead of a trigger + modal */
  page?: { backHref: string };
}

const FORM_ID = "payment-form";

const FOR_OPTIONS = [
  { value: "GENERAL", label: "General (no order / expense)" },
  { value: "ORDER", label: "An order" },
  { value: "EXPENSE", label: "An expense" },
];

/**
 * Proserve "quick pay": records a payment received / made. Linked payments re-calculate the
 * order's or expense's paid / balance on the server; every payment lands in a Cash / Bank account.
 */
export function RecordPaymentModal({ accounts, preset, trigger, buttonLabel = "Record Payment", initialOpen = false, page }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(initialOpen || Boolean(page));
  const close = page ? () => router.push(page.backHref) : () => setOpen(false);
  const [max, setMax] = useState<number | null>(preset?.max ?? null);

  const initialValues: PaymentInput = {
    paymentDate: todayIST(),
    direction: preset?.direction ?? "RECEIVED",
    referenceType: preset?.referenceType ?? "GENERAL",
    referenceId: preset?.referenceId ?? "",
    amount: preset?.max ?? 0,
    method: "" as PaymentInput["method"],
    accountId: "",
    transactionRef: "",
    notes: "",
    partyName: "",
  };

  const onSubmit = useApiSubmit<PaymentInput>({
    request: (values) => apiRequest("/api/payments", "POST", values),
    successMessage: "Payment recorded",
    onSuccess: page ? undefined : () => setOpen(false),
    redirectTo: page?.backHref,
  });

  const show = () => {
    setMax(preset?.max ?? null);
    setOpen(true);
  };

  return (
    <>
      {page ? null : trigger ? (
        trigger(show)
      ) : (
        <Button icon={<Wallet className="w-4 h-4" />} onClick={show}>
          {buttonLabel}
        </Button>
      )}
      {open && (
        <Formik initialValues={initialValues} validationSchema={paymentSchema} onSubmit={onSubmit}>
          {({ isSubmitting, values, setFieldValue }) => (
            <FormSurface
              page={page}
              onClose={close}
              title={preset ? (preset.direction === "RECEIVED" ? "Receive Payment" : "Make Payment") : "Record Payment"}
              subtitle={preset ? `${preset.label} · due ${formatCurrency(preset.max)}` : "Money received or paid — partial payments are fine"}
              icon={<Wallet className="w-4 h-4" />}
              footer={
                <>
                  <Button variant="outline" onClick={close} disabled={isSubmitting}>
                    Cancel
                  </Button>
                  <Button type="submit" form={FORM_ID} loading={isSubmitting}>
                    Save Payment
                  </Button>
                </>
              }
            >
              <Form id={FORM_ID} noValidate className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {!preset && (
                  <>
                    <SelectField
                      name="direction"
                      label="Type"
                      required
                      options={[
                        { value: "RECEIVED", label: "Payment Received (money in)" },
                        { value: "MADE", label: "Payment Made (money out)" },
                      ]}
                      onChange={(e) => {
                        setFieldValue("direction", e.target.value);
                        setFieldValue("referenceId", "");
                        // Expenses are only ever paid
                        if (e.target.value === "RECEIVED" && values.referenceType === "EXPENSE") setFieldValue("referenceType", "GENERAL");
                        setMax(null);
                      }}
                    />
                    <SelectField
                      name="referenceType"
                      label="Payment For"
                      required
                      options={values.direction === "RECEIVED" ? FOR_OPTIONS.filter((o) => o.value !== "EXPENSE") : FOR_OPTIONS}
                      onChange={(e) => {
                        setFieldValue("referenceType", e.target.value);
                        setFieldValue("referenceId", "");
                        setMax(null);
                      }}
                    />
                    <ReferencePicker onPick={(o) => setMax(o?.max ?? null)} />
                    {values.referenceType === "GENERAL" && (
                      <TextField
                        name="partyName"
                        label={values.direction === "RECEIVED" ? "Received From" : "Paid To"}
                        required
                        placeholder="Name of the person / company"
                        className="sm:col-span-2"
                        maxLength={120}
                      />
                    )}
                  </>
                )}
                <TextField name="paymentDate" label="Payment Date" type="date" required />
                <TextField name="amount" label="Amount (₹)" type="number" min={0} step="0.01" required hint={maxHint(max)} />
                <PaymentModeFields accounts={accounts} />
                <TextAreaField name="notes" label="Notes" rows={2} className="sm:col-span-2" maxLength={300} />
              </Form>
            </FormSurface>
          )}
        </Formik>
      )}
    </>
  );
}

/** Header button: opens the Record Payment page. */
export function RecordPaymentLink() {
  return (
    <Link
      href={`${FINANCE_PATHS.payments}/new`}
      className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-dark text-white text-xs font-bold transition"
    >
      <Plus className="w-4 h-4" />
      Record Payment
    </Link>
  );
}
