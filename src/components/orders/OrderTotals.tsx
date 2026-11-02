"use client";

import { useFormikContext } from "formik";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { formatCurrency } from "@/lib/format";
import type { OrderInput } from "@/lib/validation/order.schema";
import { PAYMENT_METHOD_OPTIONS, TAX_PRESETS } from "./orderConfig";

/** Same arithmetic as the server (which recomputes on save). */
export function computeTotals(values: Pick<OrderInput, "items" | "discount" | "taxPercent" | "shipping">) {
  const subtotal = values.items.reduce((s, i) => s + (Number(i.quantity) || 0) * (Number(i.price) || 0), 0);
  const discount = Math.min(Number(values.discount) || 0, subtotal);
  const taxPercent = Number(values.taxPercent) || 0;
  const tax = Math.round((subtotal - discount) * taxPercent) / 100;
  const shipping = Number(values.shipping) || 0;
  return { subtotal, discount, tax, shipping, total: subtotal - discount + tax + shipping };
}

/** Discount, tax %, live totals and the payment taken with the order. */
export function OrderTotals() {
  const { values, setFieldValue } = useFormikContext<OrderInput>();
  const t = computeTotals(values);
  const upfront = Number(values.upfrontPayment) || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField name="discount" label="Discount (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
          <TextField
            name="shipping"
            label="Shipping Charge (₹)"
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            hint="Optional — added to the total"
            className="sm:order-last"
          />
          <div className="space-y-1.5">
            <TextField name="taxPercent" label="Tax %" type="number" min={0} max={100} step="0.01" hint="Optional" />
            <div className="flex gap-1.5">
              {TAX_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setFieldValue("taxPercent", p)}
                  className={`h-7 px-2.5 text-[11px] font-semibold rounded-md border ${
                    Number(values.taxPercent) === p ? "border-brand bg-brand-light text-brand" : "border-slate-300 text-slate-600 hover:border-brand"
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3">
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Payment taken with the order</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <TextField name="upfrontPayment" label="Amount Paid (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
            <SelectField
              name="upfrontPaymentMethod"
              label="Method"
              placeholder={upfront > 0 ? "Select" : "—"}
              options={PAYMENT_METHOD_OPTIONS}
              required={upfront > 0}
            />
            <TextField name="upfrontPaymentRef" label="Reference" placeholder="UPI / txn id" />
          </div>
          <p className="text-[11px] text-slate-500">
            Recorded as a payment received when the order is confirmed. Leave 0 for credit / unpaid orders.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 overflow-hidden self-start">
        <dl className="divide-y divide-slate-100 text-xs">
          <Row label="Subtotal" value={formatCurrency(t.subtotal)} />
          <Row label="Discount" value={t.discount ? `− ${formatCurrency(t.discount)}` : formatCurrency(0)} />
          <Row label={`Tax${Number(values.taxPercent) ? ` (${values.taxPercent}%)` : ""}`} value={formatCurrency(t.tax)} />
          <Row label="Shipping" value={formatCurrency(t.shipping)} />
          <div className="flex items-center justify-between px-4 py-3 bg-brand-light/60">
            <dt className="text-sm font-bold text-slate-900">Order Total</dt>
            <dd className="text-base font-black text-brand">{formatCurrency(t.total)}</dd>
          </div>
          <Row label="Paid now" value={formatCurrency(upfront)} />
          <Row
            label="Balance due"
            value={<span className={t.total - upfront > 0 ? "text-rose-700" : "text-emerald-700"}>{formatCurrency(Math.max(t.total - upfront, 0))}</span>}
          />
        </dl>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5">
      <dt className="text-slate-600 font-medium">{label}</dt>
      <dd className="font-bold text-slate-800">{value}</dd>
    </div>
  );
}
