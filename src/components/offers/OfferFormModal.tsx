"use client";

import { Form, Formik, useField, useFormikContext } from "formik";
import { BadgePercent, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FormErrorNotice } from "@/components/forms/FormErrorNotice";
import { SelectField, STATUS_OPTIONS, TextAreaField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import type { Offer } from "@/lib/commerceTypes";
import { applyOffer, emptyOffer, offerLabel, offerSchema, type OfferInput } from "@/lib/validation/offer.schema";
import { ApiError, resourceApi } from "@/services/apiClient";
import type { OfferOptions } from "./OfferListView";

const api = resourceApi<Offer>("/api/offers");

const SCOPES = [
  { value: "all", label: "All products", hint: "Store-wide" },
  { value: "categories", label: "Categories", hint: "Every product in them" },
  { value: "products", label: "Products", hint: "Only the ones you pick" },
] as const;

/** Segmented choice: % or ₹, and what the offer applies to. */
function Segmented<T extends string>({ name, items }: { name: string; items: readonly { value: T; label: string; hint?: string }[] }) {
  const [field, , helpers] = useField<T>(name);
  return (
    <div className={`grid gap-2 ${items.length === 3 ? "grid-cols-3" : "grid-cols-2"}`} role="radiogroup">
      {items.map((it) => {
        const on = field.value === it.value;
        return (
          <button
            key={it.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => void helpers.setValue(it.value)}
            className={`rounded-lg border px-3 py-2 text-left transition ${
              on ? "border-brand bg-brand-light ring-1 ring-brand" : "border-line bg-white hover:border-slate-400"
            }`}
          >
            <span className={`block text-[12.5px] font-semibold ${on ? "text-brand" : "text-slate-800"}`}>{it.label}</span>
            {it.hint && <span className="block text-[10.5px] text-slate-500">{it.hint}</span>}
          </button>
        );
      })}
    </div>
  );
}

/** Searchable checkbox list for categories or products. */
function PickList({ name, items, empty }: { name: "categories" | "products"; items: { value: string; label: string; sub?: string }[]; empty: string }) {
  const [field, meta, helpers] = useField<string[]>(name);
  const [q, setQ] = useState("");
  const selected = new Set(field.value ?? []);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => `${i.label} ${i.sub ?? ""}`.toLowerCase().includes(t)) : items;
  }, [q, items]);
  const toggle = (v: string) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    void helpers.setValue([...next]);
  };

  return (
    <div>
      <div className="rounded-lg border border-line">
        {items.length > 6 && (
          <div className="flex items-center gap-2 border-b border-line px-2.5 py-1.5">
            <Search className="h-3.5 w-3.5 text-slate-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="w-full bg-transparent text-[12.5px] outline-none" />
          </div>
        )}
        <ul className="max-h-48 overflow-y-auto divide-y divide-line">
          {shown.length === 0 && <li className="px-3 py-3 text-[12px] text-slate-500">{items.length ? "No matches" : empty}</li>}
          {shown.map((i) => (
            <li key={i.value}>
              <label className="flex cursor-pointer items-center gap-2.5 px-3 py-2 hover:bg-slate-50">
                <input type="checkbox" checked={selected.has(i.value)} onChange={() => toggle(i.value)} className="h-4 w-4 accent-brand" />
                <span className="text-[12.5px] text-slate-800">{i.label}</span>
                {i.sub && <span className="ml-auto text-[11px] text-slate-400">{i.sub}</span>}
              </label>
            </li>
          ))}
        </ul>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">{selected.size} selected</p>
      {meta.touched && typeof meta.error === "string" && <p className="text-[11px] font-medium text-rose-600">{meta.error}</p>}
    </div>
  );
}

/** Live example of the discount, e.g. ₹199 → ₹169. */
function Preview() {
  const { values } = useFormikContext<OfferInput>();
  const v = Number(values.value);
  if (!v || v <= 0) return null;
  const sample = 199;
  return (
    <p className="rounded-lg bg-slate-50 px-3 py-2 text-[12px] text-slate-600">
      Example: a ₹{sample} pack shows as <b className="text-slate-900">₹{applyOffer(sample, { discountType: values.discountType, value: v })}</b>{" "}
      <span className="line-through">₹{sample}</span> with a <b>{offerLabel({ discountType: values.discountType, value: v })}</b> badge.
    </p>
  );
}

/** Create / edit an offer. `offer` = null → closed; "new" → create. */
export function OfferFormModal({ offer, options, onClose }: { offer: Offer | "new" | null; options: OfferOptions; onClose: () => void }) {
  const router = useRouter();
  if (!offer) return null;
  const editing = offer !== "new" ? offer : null;
  const initial: OfferInput = editing
    ? {
        name: editing.name,
        description: editing.description ?? "",
        discountType: editing.discountType,
        value: editing.value,
        appliesTo: editing.appliesTo,
        categories: editing.categories ?? [],
        products: editing.products ?? [],
        startDate: editing.startDate ?? "",
        endDate: editing.endDate ?? "",
        status: editing.status,
      }
    : emptyOffer;

  return (
    <Formik
      initialValues={initial}
      validationSchema={offerSchema}
      onSubmit={async (values, helpers) => {
        try {
          const saved = editing ? await api.update(editing._id, values) : await api.create(values);
          toast.success(editing ? "Offer updated" : `${saved.name} created`);
          onClose();
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not save");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, submitForm, values }) => (
        <Modal
          open
          onClose={onClose}
          title={editing ? "Edit Offer" : "New Offer"}
          subtitle="Shown on the online store with the discounted price and an offer badge"
          icon={<BadgePercent className="w-4 h-4" />}
          size="md"
          footer={
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitForm} loading={isSubmitting}>
                {editing ? "Save Changes" : "Create Offer"}
              </Button>
            </>
          }
        >
          <Form noValidate className="grid grid-cols-1 gap-3.5">
            <FormErrorNotice />
            <TextField name="name" label="Offer Name" required placeholder="e.g. Onam Offer" autoFocus maxLength={80} />
            <TextAreaField name="description" label="Message on the Store" rows={2} placeholder="e.g. Celebrate Onam with Kerala's best banana chips" maxLength={200} />

            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Discount *</p>
              <div className="grid grid-cols-[1fr_140px] gap-2.5">
                <Segmented
                  name="discountType"
                  items={[
                    { value: "percent", label: "% off" },
                    { value: "flat", label: "₹ off" },
                  ]}
                />
                <TextField
                  name="value"
                  label={values.discountType === "percent" ? "Percent" : "Rupees"}
                  type="number"
                  min={0}
                  step={values.discountType === "percent" ? 1 : 0.01}
                  inputMode="decimal"
                  className="[&_label]:sr-only"
                />
              </div>
            </div>
            <Preview />

            <div>
              <p className="mb-1.5 text-[12px] font-semibold text-slate-700">Applies To *</p>
              <Segmented name="appliesTo" items={SCOPES} />
            </div>
            {values.appliesTo === "categories" && (
              <PickList name="categories" items={options.categories.map((c) => ({ value: c, label: c }))} empty="No active categories" />
            )}
            {values.appliesTo === "products" && (
              <PickList
                name="products"
                items={options.products.map((p) => ({ value: p.id, label: p.name, sub: p.category || p.sku }))}
                empty="No active products"
              />
            )}

            <div className="grid grid-cols-2 gap-3">
              <TextField name="startDate" label="Start Date" type="date" hint="Empty = starts now" />
              <TextField name="endDate" label="End Date" type="date" hint="Empty = no end" />
            </div>
            <SelectField name="status" label="Status" required options={STATUS_OPTIONS} hint="Inactive offers never show on the store" />
          </Form>
        </Modal>
      )}
    </Formik>
  );
}
