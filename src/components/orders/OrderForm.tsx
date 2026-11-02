"use client";

import { Form, Formik, getIn, useFormikContext, type FormikErrors, type FormikHelpers } from "formik";
import { ArrowLeft, CheckCircle2, ClipboardList, Plus, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FormSection } from "@/components/forms/FormCard";
import { SelectField, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { CustomerFormModal } from "@/components/customers/CustomerFormModal";
import type { OrderType } from "@/lib/commerceTypes";
import { addDays, todayIST } from "@/lib/indiaDate";
import type { Option } from "@/lib/types";
import { orderSchema, type OrderInput } from "@/lib/validation/order.schema";
import type { CustomerOption } from "@/server/services/customer.service";
import type { OrderProductOption, OrderRecord, SaveOrderResult } from "@/server/services/order.service";
import { ApiError, apiRequest } from "@/services/apiClient";
import { OrderLinesEditor } from "./OrderLinesEditor";
import { OrderTotals } from "./OrderTotals";
import { OrderTypePicker } from "./OrderTypePicker";
import { ORDER_UI } from "./orderConfig";

interface OrderFormProps {
  initial?: OrderRecord;
  channels: Option[];
  distributors: CustomerOption[];
  defaultType?: OrderType;
  canCreateCustomer: boolean;
  canConfirm: boolean;
}

function initialValues(initial: OrderRecord | undefined, defaultType?: OrderType): OrderInput {
  if (!initial) {
    return {
      orderType: (defaultType ?? "") as OrderInput["orderType"],
      channel: "",
      orderReference: "",
      customer: "",
      customerName: "",
      customerPhone: "",
      customerAddress: "",
      orderDate: todayIST(),
      dueDate: "",
      items: [{ product: "", quantity: 1, price: 0 }],
      discount: 0,
      taxPercent: 0,
      upfrontPayment: 0,
      upfrontPaymentMethod: "",
      upfrontPaymentRef: "",
      notes: "",
      confirm: false,
    };
  }
  return {
    orderType: initial.orderType,
    channel: initial.channel?._id ?? "",
    orderReference: initial.orderReference ?? "",
    customer: initial.customer?._id ?? "",
    customerName: initial.customer ? "" : initial.customerName ?? "",
    customerPhone: initial.customerPhone ?? "",
    customerAddress: initial.customerAddress ?? "",
    orderDate: initial.orderDate,
    dueDate: initial.dueDate ?? "",
    items: initial.items.map((i) => ({ product: i.product, quantity: i.quantity, price: i.price })),
    discount: initial.discount,
    taxPercent: initial.taxPercent,
    upfrontPayment: initial.upfrontPayment,
    upfrontPaymentMethod: initial.upfrontPaymentMethod as OrderInput["upfrontPaymentMethod"],
    upfrontPaymentRef: initial.upfrontPaymentRef,
    notes: initial.notes ?? "",
    confirm: false,
  };
}

/** Loads the products this order type / marketplace may sell. */
function useProductOptions(orderType: string, channel: string) {
  const key =
    !orderType || (orderType === "MARKETPLACE" && !channel)
      ? ""
      : new URLSearchParams({ type: orderType, ...(orderType === "MARKETPLACE" ? { channel } : {}) }).toString();
  const [loaded, setLoaded] = useState<{ key: string; items: OrderProductOption[] }>({ key: "", items: [] });
  useEffect(() => {
    if (!key) return;
    let live = true;
    apiRequest<{ items: OrderProductOption[] }>(`/api/orders/product-options?${key}`)
      .then((r) => live && setLoaded({ key, items: r.items }))
      .catch((e) => {
        if (!live) return;
        toast.error(e instanceof ApiError ? e.message : "Could not load products");
        setLoaded({ key, items: [] });
      });
    return () => {
      live = false;
    };
  }, [key]);
  return { products: loaded.key === key ? loaded.items : [], loading: Boolean(key) && loaded.key !== key };
}

export function OrderForm({ initial, channels, distributors: initialDistributors, defaultType, canCreateCustomer, canConfirm }: OrderFormProps) {
  const router = useRouter();
  const confirmRef = useRef(false);
  const isEdit = Boolean(initial);

  const submit = async (values: OrderInput, helpers: FormikHelpers<OrderInput>) => {
    const body = { ...values, confirm: confirmRef.current };
    try {
      const res = initial
        ? await apiRequest<SaveOrderResult>(`${ORDER_UI.apiBase}/${initial._id}`, "PUT", body)
        : await apiRequest<SaveOrderResult>(ORDER_UI.apiBase, "POST", body);
      if (res.confirmError) {
        toast.warning(`Saved ${res.order.orderNo} as Pending, but not confirmed: ${res.confirmError}`, { duration: 8000 });
      } else {
        toast.success(
          res.order.status === "CONFIRMED" ? `Order ${res.order.orderNo} confirmed — stock deducted` : `Order ${res.order.orderNo} saved as Pending`
        );
      }
      router.push(`${ORDER_UI.basePath}/${res.order._id}`);
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
    <Formik initialValues={initialValues(initial, defaultType)} validationSchema={orderSchema} onSubmit={submit} validateOnBlur>
      <OrderFormBody
        initial={initial}
        isEdit={isEdit}
        channels={channels}
        initialDistributors={initialDistributors}
        canCreateCustomer={canCreateCustomer}
        canConfirm={canConfirm}
        confirmRef={confirmRef}
      />
    </Formik>
  );
}

function OrderFormBody({
  initial,
  isEdit,
  channels,
  initialDistributors,
  canCreateCustomer,
  canConfirm,
  confirmRef,
}: {
  initial?: OrderRecord;
  isEdit: boolean;
  channels: Option[];
  initialDistributors: CustomerOption[];
  canCreateCustomer: boolean;
  canConfirm: boolean;
  confirmRef: React.MutableRefObject<boolean>;
}) {
  const { values, setFieldValue, setFieldTouched, setValues, isSubmitting, submitForm, validateForm, setErrors, errors, submitCount } =
    useFormikContext<OrderInput>();
  const [distributors, setDistributors] = useState(initialDistributors);
  const [addOpen, setAddOpen] = useState(false);
  const { products, loading } = useProductOptions(values.orderType, values.channel);
  const keepIds = useMemo(() => new Set(initial?.items.map((i) => i.product) ?? []), [initial]);
  const stockById = useMemo(() => new Map(products.map((p) => [p.productId, p.stock])), [products]);

  const type = values.orderType as OrderType | "";
  const distributorOptions = distributors.map((d) => ({ value: d.value, label: d.label }));

  const changeType = (next: OrderType) => {
    if (next === values.orderType) return;
    setValues({ ...values, orderType: next, channel: "", customer: "", dueDate: "", items: [{ product: "", quantity: 1, price: 0 }] }, false);
  };

  const pickDistributor = (id: string, list = distributors) => {
    setFieldValue("customer", id);
    const d = list.find((x) => x.value === id);
    if (d && d.creditDays > 0) setFieldValue("dueDate", addDays(values.orderDate || todayIST(), d.creditDays));
  };

  // Lines whose product is not sold on the newly chosen marketplace are cleared
  useEffect(() => {
    if (type !== "MARKETPLACE" || loading || !products.length) return;
    const allowed = new Set(products.map((p) => p.productId));
    if (values.items.some((i) => i.product && !allowed.has(i.product))) {
      setFieldValue(
        "items",
        values.items.map((i) => (i.product && !allowed.has(i.product) ? { ...i, product: "" } : i))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products]);

  /** Quantities above available stock block "Save & Confirm" (pending orders may be saved). */
  const stockErrors = (): FormikErrors<OrderInput> | null => {
    const totals = new Map<string, number>();
    values.items.forEach((i) => i.product && totals.set(i.product, (totals.get(i.product) ?? 0) + (Number(i.quantity) || 0)));
    const items = values.items.map((i) => {
      const have = stockById.get(i.product);
      return i.product && have !== undefined && (totals.get(i.product) ?? 0) > have ? { quantity: `Only ${have} in stock` } : undefined;
    });
    return items.some(Boolean) ? ({ items } as FormikErrors<OrderInput>) : null;
  };

  const save = async (confirm: boolean) => {
    confirmRef.current = confirm;
    if (confirm) {
      const errs = stockErrors();
      if (errs) {
        const schemaErrors = await validateForm();
        setErrors({ ...schemaErrors, ...errs });
        (errs.items as unknown[]).forEach((e, i) => e && setFieldTouched(`items.${i}.quantity`, true, false));
        toast.error("Some quantities are more than the stock available. Lower them or save as Pending.");
        return;
      }
    }
    await submitForm();
  };

  const blockedReason = !type
    ? "Choose the order type first"
    : type === "MARKETPLACE" && !values.channel
      ? "Select the marketplace — only products assigned to it can be added"
      : !loading && products.length === 0
        ? type === "MARKETPLACE"
          ? "No products are assigned to this marketplace yet. Assign them under Channels."
          : "No active products yet. Add products and stock first."
        : undefined;

  const typeError = submitCount > 0 ? (getIn(errors, "orderType") as string | undefined) : undefined;

  return (
    <Form noValidate>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex items-center gap-3">
          <Link
            href={initial ? `${ORDER_UI.basePath}/${initial._id}` : ORDER_UI.basePath}
            title="Back"
            className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition shrink-0"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-9 h-9 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
            <ClipboardList className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-900">{isEdit ? "Edit Pending Order" : "Create Order"}</h1>
              <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 font-mono">
                {initial?.orderNo ?? "New"}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">Choose the channel, add products and quantities. Stock is deducted when you confirm.</p>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-8">
          <section className="space-y-3">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">1. Order Type</h2>
            <OrderTypePicker value={values.orderType} onChange={changeType} />
            {typeError && <p className="text-[11px] text-rose-600 font-medium">{typeError}</p>}
          </section>

          {type && (
            <FormSection title="2. Order Details">
              {type === "MARKETPLACE" && (
                <SelectField
                  name="channel"
                  label="Marketplace"
                  required
                  placeholder={channels.length ? "Select marketplace" : "No active marketplaces — add one under Channels"}
                  options={channels}
                />
              )}
              {type === "DISTRIBUTOR" && (
                <div className="space-y-1.5">
                  <SelectField
                    name="customer"
                    label="Distributor"
                    required
                    placeholder="Select distributor"
                    options={distributorOptions}
                    onChange={(e) => pickDistributor(e.target.value)}
                  />
                  {canCreateCustomer && (
                    <button type="button" onClick={() => setAddOpen(true)} className="inline-flex items-center gap-1 text-[11px] font-bold text-brand hover:underline">
                      <Plus className="w-3.5 h-3.5" />
                      New distributor
                    </button>
                  )}
                </div>
              )}
              <TextField
                name="orderReference"
                label={type === "MARKETPLACE" ? "Marketplace Order ID" : "Order Reference"}
                placeholder={type === "MARKETPLACE" ? "e.g. 402-1234567-1234567" : "Optional"}
                maxLength={100}
              />
              <TextField name="orderDate" label="Order Date" type="date" required />
              <TextField
                name="dueDate"
                label="Payment Due Date"
                type="date"
                hint={type === "DISTRIBUTOR" ? "From the distributor's credit days" : "Optional"}
              />
              {type !== "DISTRIBUTOR" && (
                <>
                  <TextField name="customerName" label={type === "MARKETPLACE" ? "Buyer Name" : "Customer Name"} placeholder="Optional" maxLength={150} />
                  <TextField name="customerPhone" label="Phone" placeholder="Optional" />
                  <TextField name="customerAddress" label="Address" placeholder="Optional" maxLength={500} />
                </>
              )}
            </FormSection>
          )}

          {type && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">3. Products</h2>
              <OrderLinesEditor products={products} loading={loading} blockedReason={blockedReason} keepIds={keepIds} />
            </section>
          )}

          {type && (
            <section className="space-y-3">
              <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">4. Totals &amp; Payment</h2>
              <OrderTotals />
              <TextAreaField name="notes" label="Notes" rows={2} maxLength={1000} />
            </section>
          )}
        </div>

        <div className="px-4 sm:px-6 py-4 bg-slate-50/80 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2">
          <Link
            href={initial ? `${ORDER_UI.basePath}/${initial._id}` : ORDER_UI.basePath}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-lg transition border border-slate-300 text-center"
          >
            Cancel
          </Link>
          <button
            type="button"
            disabled={isSubmitting || !type}
            onClick={() => save(false)}
            className="px-4 py-2 bg-white border border-brand-border text-brand hover:bg-brand-light text-xs font-bold rounded-lg transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            Save as Pending
          </button>
          {canConfirm && (
            <button
              type="button"
              disabled={isSubmitting || !type}
              onClick={() => save(true)}
              className="px-5 py-2 bg-brand hover:bg-brand-dark text-white text-xs font-bold rounded-lg transition shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Save &amp; Confirm
            </button>
          )}
        </div>
      </div>

      {canCreateCustomer && (
        <CustomerFormModal
          open={addOpen}
          onClose={() => setAddOpen(false)}
          defaultKind="distributor"
          lockKind
          onSaved={(c) => {
            const option: CustomerOption = {
              value: c._id,
              label: `${c.name} (${c.code})`,
              phone: c.phone ?? "",
              address: c.address ?? "",
              creditDays: c.creditDays,
            };
            const next = [...distributors, option].sort((a, b) => a.label.localeCompare(b.label));
            setDistributors(next);
            pickDistributor(c._id, next);
          }}
        />
      )}
    </Form>
  );
}
