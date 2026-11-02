"use client";

import { FieldArray, getIn, useFormikContext } from "formik";
import { PackageSearch, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { inputClass } from "@/components/ui/FormField";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { OrderInput } from "@/lib/validation/order.schema";
import type { OrderProductOption } from "@/server/services/order.service";

interface OrderLinesEditorProps {
  products: OrderProductOption[];
  loading: boolean;
  /** Why no products can be picked yet, e.g. "Select a marketplace first" */
  blockedReason?: string;
  /** Products already on the saved draft stay pickable even if now out of stock */
  keepIds: Set<string>;
}

const emptyLine = { product: "", quantity: 1, price: 0 };

/** Product lines: pick, qty (checked against stock), price, line total. Stacks per line on phones. */
export function OrderLinesEditor({ products, loading, blockedReason, keepIds }: OrderLinesEditorProps) {
  const { values, errors, touched, setFieldValue, submitCount } = useFormikContext<OrderInput>();
  const [search, setSearch] = useState("");
  const byId = useMemo(() => new Map(products.map((p) => [p.productId, p])), [products]);

  const pickable = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(
      (p) => (p.stock > 0 || keepIds.has(p.productId)) && (!q || p.sku.toLowerCase().includes(q) || p.name.toLowerCase().includes(q))
    );
  }, [products, search, keepIds]);

  const showError = (path: string) => (getIn(touched, path) || submitCount > 0 ? (getIn(errors, path) as string | undefined) : undefined);
  const listError = typeof errors.items === "string" && submitCount > 0 ? errors.items : undefined;

  const pick = (index: number, productId: string) => {
    setFieldValue(`items.${index}.product`, productId);
    const p = byId.get(productId);
    if (p) setFieldValue(`items.${index}.price`, p.price);
  };

  if (blockedReason) {
    return (
      <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center text-xs text-slate-500">
        <PackageSearch className="w-7 h-7 mx-auto mb-1.5 text-slate-300" />
        {blockedReason}
      </div>
    );
  }

  return (
    <FieldArray name="items">
      {({ push, remove }) => (
        <div className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 justify-between">
            <div className="relative sm:w-80">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter products by SKU or name"
                className={`${inputClass()} pl-8`}
              />
            </div>
            <p className="text-[11px] text-slate-500">
              {loading ? "Loading products…" : `${pickable.length} of ${products.length} products available`}
            </p>
          </div>

          <div className="hidden md:grid grid-cols-[minmax(0,1fr)_110px_130px_120px_36px] gap-2 px-1 text-[10.5px] font-bold text-slate-500 uppercase tracking-wider">
            <span>Product</span>
            <span className="text-right">Qty</span>
            <span className="text-right">Price (₹)</span>
            <span className="text-right">Line Total</span>
            <span />
          </div>

          {values.items.map((line, index) => {
            const p = byId.get(line.product);
            const qtyErr = showError(`items.${index}.quantity`);
            const productErr = showError(`items.${index}.product`);
            const priceErr = showError(`items.${index}.price`);
            const total = (Number(line.quantity) || 0) * (Number(line.price) || 0);
            const options = p && !pickable.includes(p) ? [p, ...pickable] : pickable;
            return (
              <div
                key={index}
                className="grid grid-cols-2 md:grid-cols-[minmax(0,1fr)_110px_130px_120px_36px] gap-2 items-start p-3 md:p-1 border md:border-0 border-slate-200 rounded-xl bg-slate-50/50 md:bg-transparent"
              >
                <div className="col-span-2 md:col-span-1 space-y-1">
                  <select
                    aria-label={`Product for line ${index + 1}`}
                    value={line.product}
                    onChange={(e) => pick(index, e.target.value)}
                    className={`${inputClass(Boolean(productErr))} cursor-pointer`}
                  >
                    <option value="">Select a product</option>
                    {options.map((o) => (
                      <option key={o.productId} value={o.productId}>
                        {o.sku} — {o.name} ({formatNumber(o.stock)} in stock)
                      </option>
                    ))}
                  </select>
                  {productErr ? (
                    <p className="text-[11px] text-rose-600 font-medium">{productErr}</p>
                  ) : p ? (
                    <p className={`text-[11px] ${p.stock < (Number(line.quantity) || 0) ? "text-rose-600 font-semibold" : "text-slate-500"}`}>
                      Available: {formatNumber(p.stock)}
                    </p>
                  ) : null}
                </div>
                <label className="space-y-1">
                  <span className="md:hidden block text-[10px] font-bold text-slate-500 uppercase">Qty</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    value={line.quantity ?? ""}
                    onChange={(e) => setFieldValue(`items.${index}.quantity`, e.target.value === "" ? "" : Number(e.target.value))}
                    className={`${inputClass(Boolean(qtyErr))} text-right`}
                  />
                  {qtyErr && <p className="text-[11px] text-rose-600 font-medium">{qtyErr}</p>}
                </label>
                <label className="space-y-1">
                  <span className="md:hidden block text-[10px] font-bold text-slate-500 uppercase">Price (₹)</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="0.01"
                    value={line.price ?? ""}
                    onChange={(e) => setFieldValue(`items.${index}.price`, e.target.value === "" ? "" : Number(e.target.value))}
                    className={`${inputClass(Boolean(priceErr))} text-right`}
                  />
                  {priceErr && <p className="text-[11px] text-rose-600 font-medium">{priceErr}</p>}
                </label>
                <div className="flex items-center md:justify-end h-9 text-xs font-bold text-slate-800">
                  <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase mr-2">Total</span>
                  {formatCurrency(total)}
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={values.items.length === 1}
                    title="Remove line"
                    className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {listError && <p className="text-[11px] text-rose-600 font-medium">{listError}</p>}

          <button
            type="button"
            onClick={() => push({ ...emptyLine })}
            className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-bold rounded-lg border border-dashed border-brand-border text-brand hover:bg-brand-light"
          >
            <Plus className="w-4 h-4" />
            Add product
          </button>
        </div>
      )}
    </FieldArray>
  );
}
