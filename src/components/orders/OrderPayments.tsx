"use client";

import { Form, Formik, type FormikHelpers } from "formik";
import { IndianRupee, RotateCcw, Wallet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { SALE_STATUSES, type Order } from "@/lib/commerceTypes";
import { PAYMENT_METHOD_LABELS, type Payment } from "@/lib/financeTypes";
import { formatCurrency } from "@/lib/format";
import { formatDay, todayIST } from "@/lib/indiaDate";
import type { Option } from "@/lib/types";
import { orderPaymentSchema, type OrderPaymentInput } from "@/lib/validation/order.schema";
import { ApiError, apiRequest } from "@/services/apiClient";
import { ORDER_UI, PAYMENT_METHOD_OPTIONS } from "./orderConfig";

interface OrderPaymentsProps {
  order: Order;
  payments: Payment[];
  accounts: Option[];
  canPay: boolean;
}

/** Payments linked to the order, with Record Payment (or Record Refund once cancelled / returned). */
export function OrderPayments({ order, payments, accounts, canPay }: OrderPaymentsProps) {
  const canReceive = canPay && SALE_STATUSES.includes(order.status) && order.outstanding > 0;
  const canRefund = canPay && order.paymentStatus === "REFUND_DUE";
  // Receivables links here with ?pay=1 to open the payment form straight away
  const autoPay = useSearchParams().get("pay") === "1";
  const [mode, setMode] = useState<"RECEIVED" | "MADE" | null>(() =>
    autoPay ? (canReceive ? "RECEIVED" : canRefund ? "MADE" : null) : null
  );

  return (
    <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Wallet className="w-4 h-4 text-brand" />
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Payments</h2>
        </div>
        <div className="flex gap-2">
          {canReceive && (
            <Button size="sm" icon={<IndianRupee className="w-3.5 h-3.5" />} onClick={() => setMode("RECEIVED")}>
              Record Payment
            </Button>
          )}
          {canRefund && (
            <Button size="sm" variant="danger" icon={<RotateCcw className="w-3.5 h-3.5" />} onClick={() => setMode("MADE")}>
              Record Refund
            </Button>
          )}
        </div>
      </div>

      {payments.length === 0 ? (
        <p className="p-4 text-xs text-slate-500">
          {order.status === "PENDING" ? "Payments can be recorded once the order is confirmed." : "No payments recorded yet."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 text-xs">
          {payments.map((p) => (
            <li key={p._id} className="px-4 py-2.5 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-slate-800 flex items-center gap-2 flex-wrap">
                  <span className="font-mono">{p.paymentNo}</span>
                  <Badge variant={p.direction === "RECEIVED" ? "success" : "danger"}>{p.direction === "RECEIVED" ? "Received" : "Refund"}</Badge>
                </p>
                <p className="text-[11px] text-slate-500">
                  {formatDay(p.paymentDate)} · {PAYMENT_METHOD_LABELS[p.method]}
                  {p.account ? ` · ${p.account.name}` : ""}
                  {p.transactionRef ? ` · Ref ${p.transactionRef}` : ""}
                </p>
                {p.notes && <p className="text-[11px] text-slate-500 italic">{p.notes}</p>}
              </div>
              <span className={`font-bold whitespace-nowrap ${p.direction === "RECEIVED" ? "text-emerald-700" : "text-rose-700"}`}>
                {p.direction === "RECEIVED" ? "+" : "−"} {formatCurrency(p.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}

      {mode && (
        <PaymentModal
          order={order}
          accounts={accounts}
          direction={mode}
          max={mode === "RECEIVED" ? order.outstanding : order.paid}
          onClose={() => setMode(null)}
        />
      )}
    </section>
  );
}

function PaymentModal({
  order,
  accounts,
  direction,
  max,
  onClose,
}: {
  order: Order;
  accounts: Option[];
  direction: "RECEIVED" | "MADE";
  max: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const refund = direction === "MADE";
  const initial: OrderPaymentInput = {
    direction,
    paymentDate: todayIST(),
    amount: max,
    method: "UPI",
    accountId: "",
    transactionRef: "",
    notes: "",
  };

  const submit = async (values: OrderPaymentInput, helpers: FormikHelpers<OrderPaymentInput>) => {
    if (Number(values.amount) > max) {
      helpers.setFieldError("amount", `At most ${formatCurrency(max)}`);
      helpers.setSubmitting(false);
      return;
    }
    try {
      await apiRequest(`${ORDER_UI.apiBase}/${order._id}/payments`, "POST", values);
      toast.success(refund ? "Refund recorded" : `Payment of ${formatCurrency(Number(values.amount))} recorded`);
      onClose();
      router.refresh();
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.fieldErrors) helpers.setErrors(error.fieldErrors as never);
        toast.error(error.message);
      } else toast.error("Something went wrong. Please try again.");
    } finally {
      helpers.setSubmitting(false);
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={refund ? `Refund — ${order.orderNo}` : `Record Payment — ${order.orderNo}`}
      subtitle={refund ? `Received so far ${formatCurrency(order.paid)}` : `Outstanding ${formatCurrency(order.outstanding)} of ${formatCurrency(order.total)}`}
      icon={refund ? <RotateCcw className="w-4 h-4" /> : <IndianRupee className="w-4 h-4" />}
    >
      <Formik initialValues={initial} validationSchema={orderPaymentSchema} onSubmit={submit}>
        {({ isSubmitting }) => (
          <Form noValidate className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField name="amount" label="Amount (₹)" type="number" min={0} step="0.01" required hint={`Max ${formatCurrency(max)}`} />
              <TextField name="paymentDate" label="Payment Date" type="date" required />
              <SelectField name="method" label="Payment Method" required options={PAYMENT_METHOD_OPTIONS} />
              <SelectField name="accountId" label="Account" placeholder="Default for the method" options={accounts} />
              <TextField name="transactionRef" label="Transaction Reference" placeholder="UTR / UPI ref / receipt no." />
              <TextField name="notes" label="Notes" />
            </div>
            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant={refund ? "danger" : "primary"} loading={isSubmitting}>
                {refund ? "Record Refund" : "Save Payment"}
              </Button>
            </div>
          </Form>
        )}
      </Formik>
    </Modal>
  );
}
