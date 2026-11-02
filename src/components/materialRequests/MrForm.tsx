"use client";

import { FieldArray, Form, Formik, getIn, useFormikContext } from "formik";
import { ClipboardPlus, Plus, Trash2, UserRound } from "lucide-react";
import { FormCard, FormSection } from "@/components/forms/FormCard";
import { TextAreaField, TextField } from "@/components/forms/FormikFields";
import { ProductPicker, type PickerProduct } from "@/components/inventory/ProductPicker";
import { useSession } from "@/components/providers/SessionProvider";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/FormField";
import { useApiSubmit } from "@/hooks/useApiSubmit";
import { formatNumber } from "@/lib/format";
import { todayIST } from "@/lib/indiaDate";
import { MR_PRIORITIES, MR_PRIORITY_LABELS, type MaterialRequest, type MrPriority } from "@/lib/materialRequestTypes";
import { materialRequestSchema, type MaterialRequestInput } from "@/lib/validation/materialRequest.schema";
import { resourceApi } from "@/services/apiClient";
import { MR_UI } from "./mrUi";

const PRIORITY_OPTIONS = MR_PRIORITIES.map((p) => ({ value: p, label: MR_PRIORITY_LABELS[p] }));

const PRIORITY_TONE: Record<MrPriority, string> = { HIGH: "text-rose-700 font-bold", MEDIUM: "text-amber-700 font-semibold", LOW: "text-slate-600" };

const api = resourceApi<MaterialRequest>(MR_UI.apiBase);

type Values = Omit<MaterialRequestInput, "items"> & { items: { product: string; quantity: number | ""; priority: MrPriority }[] };

function ItemsEditor({ products }: { products: PickerProduct[] }) {
  const { values, errors, touched, setFieldValue } = useFormikContext<Values>();
  const byId = new Map(products.map((p) => [p.productId, p]));
  const listError = typeof errors.items === "string" ? errors.items : null;

  return (
    <FieldArray name="items">
      {({ push, remove }) => (
        <div className="space-y-2 md:col-span-2 lg:col-span-3">
          <div className="hidden md:grid grid-cols-[1fr_100px_130px_130px_36px] gap-2 px-1 text-[10.5px] font-bold uppercase tracking-wider text-slate-500">
            <span>Product</span>
            <span className="text-right">In Stock</span>
            <span>Required Qty</span>
            <span>Priority</span>
            <span />
          </div>
          {values.items.map((line, i) => {
            const p = byId.get(line.product);
            const err = (f: string) => (getIn(touched, `items.${i}.${f}`) || getIn(touched, "items")) && getIn(errors, `items.${i}.${f}`);
            return (
              <div
                key={i}
                className="grid grid-cols-2 md:grid-cols-[1fr_100px_130px_130px_36px] gap-2 items-start p-3 md:p-0 border md:border-0 border-slate-200 rounded-lg"
              >
                <div className="col-span-2 md:col-span-1">
                  <ProductPicker
                    products={products.filter((x) => x.productId === line.product || !values.items.some((l) => l.product === x.productId))}
                    value={line.product}
                    onChange={(id) => setFieldValue(`items.${i}.product`, id)}
                    invalid={Boolean(err("product"))}
                  />
                  {err("product") && <p className="text-[11px] text-rose-600 mt-1">{err("product")}</p>}
                </div>
                <div className="col-span-2 md:col-span-1 flex md:block items-center justify-between text-xs md:text-right md:pt-2.5">
                  <span className="md:hidden text-slate-500">In stock</span>
                  <span className="font-semibold text-slate-700">{p ? formatNumber(p.stock) : "—"}</span>
                </div>
                <div>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    inputMode="numeric"
                    placeholder="Qty"
                    aria-label="Required quantity"
                    className={inputClass(Boolean(err("quantity")))}
                    value={line.quantity}
                    onChange={(e) => setFieldValue(`items.${i}.quantity`, e.target.value === "" ? "" : Number(e.target.value))}
                  />
                  {err("quantity") && <p className="text-[11px] text-rose-600 mt-1">{err("quantity")}</p>}
                </div>
                <div>
                  <select
                    aria-label="Priority"
                    className={`${inputClass()} ${PRIORITY_TONE[line.priority ?? "MEDIUM"]}`}
                    value={line.priority ?? "MEDIUM"}
                    onChange={(e) => setFieldValue(`items.${i}.priority`, e.target.value)}
                  >
                    {PRIORITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => remove(i)}
                  disabled={values.items.length === 1}
                  aria-label="Remove line"
                  className="h-9 w-9 justify-self-end inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {listError && <p className="text-[11px] text-rose-600">{listError}</p>}
          <Button type="button" variant="outline" size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={() => push({ product: "", quantity: "", priority: "MEDIUM" })}>
            Add product
          </Button>
        </div>
      )}
    </FieldArray>
  );
}

export function MrForm({ initial, products }: { initial?: MaterialRequest; products: PickerProduct[] }) {
  const session = useSession();
  const isEdit = Boolean(initial);

  const initialValues: Values = initial
    ? {
        requestDate: initial.requestDate,
        requiredBy: initial.requiredBy ?? "",
        notes: initial.notes ?? "",
        items: initial.items.map((i) => ({ product: i.product, quantity: i.quantity, priority: i.priority ?? "MEDIUM" })),
      }
    : { requestDate: todayIST(), requiredBy: "", notes: "", items: [{ product: "", quantity: "", priority: "MEDIUM" }] };

  const onSubmit = useApiSubmit<Values, MaterialRequest>({
    request: (values) => {
      const body = { ...values, items: values.items.map((i) => ({ product: i.product, quantity: Number(i.quantity), priority: i.priority })) };
      return initial ? api.update(initial._id, body) : api.create(body);
    },
    successMessage: isEdit ? "Material request updated" : "Material request raised",
    redirectTo: (mr) => `${MR_UI.basePath}/${mr._id}`,
  });

  return (
    <Formik initialValues={initialValues} validationSchema={materialRequestSchema} onSubmit={onSubmit}>
      {({ isSubmitting }) => (
        <Form noValidate>
          <FormCard
            title={isEdit ? `Edit ${initial!.mrNo}` : "New Material Request"}
            description="Ask for products to be restocked. Once approved, received quantities are added to stock."
            badge={isEdit ? initial!.mrNo : "New Request"}
            icon={<ClipboardPlus className="w-4.5 h-4.5" />}
            backHref={isEdit ? `${MR_UI.basePath}/${initial!._id}` : MR_UI.basePath}
            submitLabel={isEdit ? "Save Changes" : "Submit Request"}
            submitting={isSubmitting}
          >
            <FormSection title="Request">
              <div>
                <span className="block text-[11px] font-bold text-slate-600 mb-1">Requested By</span>
                <div className="h-9 px-3 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-800">
                  <UserRound className="w-3.5 h-3.5 text-brand" />
                  {initial?.requestedByName ?? session.name}
                </div>
                <p className="text-[10.5px] text-slate-500 mt-1">Filled in from your login</p>
              </div>
              <TextField name="requestDate" label="Request Date" type="date" required />
              <TextField name="requiredBy" label="Required By" type="date" hint="Optional — when the stock is needed" />
            </FormSection>
            <FormSection title="Products & Required Quantity">
              <ItemsEditor products={products} />
            </FormSection>
            <FormSection title="Notes">
              <TextAreaField name="notes" label="Notes" rows={2} maxLength={1000} placeholder="Optional — reason, supplier, anything useful" className="md:col-span-2 lg:col-span-3" />
            </FormSection>
          </FormCard>
        </Form>
      )}
    </Formik>
  );
}
