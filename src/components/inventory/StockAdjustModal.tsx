"use client";

import { Form, Formik } from "formik";
import { SlidersHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { formatNumber } from "@/lib/format";
import { todayIST } from "@/lib/indiaDate";
import { ADJUSTMENT_REASONS, adjustmentSchema, type AdjustmentInput } from "@/lib/validation/stock.schema";
import { apiRequest, ApiError } from "@/services/apiClient";

export interface AdjustTarget {
  _id: string;
  sku: string;
  name: string;
  quantity: number;
}

const DIRECTIONS = [
  { value: "in", label: "Add stock (+)" },
  { value: "out", label: "Remove stock (−)" },
];

const REASON_LIST_ID = "adjust-reason-suggestions";

/** Stock Adjustment: + or − with a required reason; shows the resulting stock before saving. */
export function StockAdjustModal({ target, onClose }: { target: AdjustTarget | null; onClose: () => void }) {
  const router = useRouter();
  if (!target) return null;

  const initial: AdjustmentInput = {
    product: target._id,
    direction: "out",
    quantity: "" as unknown as number,
    reason: "",
    txnDate: todayIST(),
  };

  return (
    <Formik
      initialValues={initial}
      validationSchema={adjustmentSchema}
      onSubmit={async (values, helpers) => {
        try {
          const res = await apiRequest<{ before: number; after: number }>("/api/stock/adjust", "POST", values);
          toast.success(`${target.sku}: stock ${res.before} → ${res.after}`);
          onClose();
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not save the adjustment");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ values, isSubmitting, submitForm }) => {
        const q = Number(values.quantity) || 0;
        const after = values.direction === "in" ? target.quantity + q : target.quantity - q;
        return (
          <Modal
            open
            onClose={onClose}
            title="Stock Adjustment"
            subtitle={`${target.sku} — ${target.name}`}
            icon={<SlidersHorizontal className="w-4 h-4" />}
            size="sm"
            footer={
              <>
                <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button onClick={submitForm} loading={isSubmitting} disabled={after < 0}>
                  Save Adjustment
                </Button>
              </>
            }
          >
            <Form noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-500 uppercase">Current</p>
                  <p className="text-lg font-black text-slate-900">{formatNumber(target.quantity)}</p>
                </div>
                <div className={`p-2.5 rounded-lg border ${after < 0 ? "bg-rose-50 border-rose-200" : "bg-brand-light border-brand-border"}`}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase">After</p>
                  <p className={`text-lg font-black ${after < 0 ? "text-rose-700" : "text-brand"}`}>{formatNumber(after)}</p>
                </div>
              </div>
              {after < 0 && <p className="text-[11px] font-semibold text-rose-600">You cannot remove more than the stock on hand.</p>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <SelectField name="direction" label="Adjustment" required options={DIRECTIONS} />
                <TextField name="quantity" label="Quantity" required type="number" min={1} step={1} inputMode="numeric" autoFocus />
                <TextField name="reason" label="Reason" required list={REASON_LIST_ID} placeholder="e.g. Damaged" className="sm:col-span-2" autoComplete="off" />
                <TextField name="txnDate" label="Date" required type="date" max={todayIST()} />
              </div>
              <datalist id={REASON_LIST_ID}>
                {ADJUSTMENT_REASONS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
            </Form>
          </Modal>
        );
      }}
    </Formik>
  );
}
