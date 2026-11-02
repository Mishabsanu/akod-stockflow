"use client";

import { Form, Formik, useField } from "formik";
import { PackagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { formatNumber } from "@/lib/format";
import { todayIST } from "@/lib/indiaDate";
import { emptyStockIn, stockInSchema, type StockInInput } from "@/lib/validation/stock.schema";
import { apiRequest, ApiError } from "@/services/apiClient";
import { ProductPicker, type PickerProduct } from "./ProductPicker";

function ProductField({ products }: { products: PickerProduct[] }) {
  const [field, meta, helpers] = useField<string>("product");
  const error = meta.touched ? meta.error : undefined;
  return (
    <FormField label="Product" htmlFor="product" required error={error} className="md:col-span-2">
      <ProductPicker
        id="product"
        products={products}
        value={field.value}
        invalid={Boolean(error)}
        onChange={(v) => {
          helpers.setValue(v);
          helpers.setTouched(true, false);
        }}
      />
    </FormField>
  );
}

interface LastSaved {
  sku: string;
  before: number;
  after: number;
  qty: number;
}

/** Manual Stock Update: product, quantity, optional PO number, date. Shows previous → updated stock. */
export function StockInForm({ products, preselect }: { products: PickerProduct[]; preselect?: string }) {
  const router = useRouter();
  const [last, setLast] = useState<LastSaved | null>(null);
  const initial: StockInInput = { ...emptyStockIn(), product: products.some((p) => p.productId === preselect) ? preselect! : "" };

  return (
    <Formik
      initialValues={initial}
      validationSchema={stockInSchema}
      onSubmit={async (values, helpers) => {
        try {
          const res = await apiRequest<{ sku: string; before: number; after: number }>("/api/stock/in", "POST", values);
          setLast({ ...res, qty: Number(values.quantity) });
          toast.success(`${res.sku}: stock ${res.before} → ${res.after}`);
          helpers.resetForm({ values: { ...emptyStockIn(), txnDate: values.txnDate, poNumber: values.poNumber } });
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not update stock");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ values, isSubmitting }) => {
        const p = products.find((x) => x.productId === values.product);
        const q = Number(values.quantity) || 0;
        return (
          <Form noValidate className="bg-white border border-line rounded-xl">
            <div className="px-4 py-3 border-b border-line flex items-center gap-2">
              <PackagePlus className="w-4 h-4 text-brand" />
              <h2 className="text-sm font-bold text-slate-800">Add Stock</h2>
            </div>
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <ProductField products={products} />
              <TextField name="quantity" label="Quantity" required type="number" min={1} step={1} inputMode="numeric" />
              <TextField name="txnDate" label="Date" required type="date" max={todayIST()} />
              <TextField name="poNumber" label="PO Number" placeholder="Optional reference" hint="Reference only" />
              <TextField name="reason" label="Note" placeholder="Optional" />
            </div>
            <div className="px-4 py-3 border-t border-line bg-slate-50/80 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-600">
                {p ? (
                  <>
                    Current stock <b>{formatNumber(p.stock)}</b>
                    {q > 0 && (
                      <>
                        {" "}
                        → after update <b className="text-brand">{formatNumber(p.stock + q)}</b>
                      </>
                    )}
                  </>
                ) : last ? (
                  <span className="text-emerald-700 font-semibold">
                    Saved {last.sku}: {formatNumber(last.before)} → {formatNumber(last.after)} (+{formatNumber(last.qty)})
                  </span>
                ) : (
                  "Choose a product to see its current stock."
                )}
              </p>
              <Button type="submit" loading={isSubmitting} icon={<PackagePlus className="w-4 h-4" />}>
                Update Stock
              </Button>
            </div>
          </Form>
        );
      }}
    </Formik>
  );
}
