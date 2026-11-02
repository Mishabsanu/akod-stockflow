"use client";

import { FieldArray, getIn, useFormikContext } from "formik";
import { PackageSearch, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { ProductPicker } from "@/components/inventory/ProductPicker";
import { inputClass } from "@/components/ui/FormField";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { OrderInput } from "@/lib/validation/order.schema";
import type { OrderProductOption } from "@/server/services/order.service";

interface OrderLinesEditorProps {
  products: OrderProductOption[];
  loading: boolean;
  /** Why no products can be picked yet, e.g. "Select a marketplace first" */
  blockedReason?: string;
  /** Products already on the saved order stay pickable even if now out of stock */
  keepIds: Set<string>;
}

const emptyLine = { product: "", quantity: 1, price: 0 };

/** Desktop column layout shared by the header, every line and the footer. */
const COLS = "md:grid-cols-[28px_minmax(0,1fr)_84px_96px_92px_112px_112px_36px]";

/**
 * Order items as a table: product (search by SKU / name), stock in hand, qty, stock left after this
 * order, price and line total, with a totals footer. Each product can be on one line only, so
 * "Stock After" is exact. Lines stack as cards on phones.
 */
export function OrderLinesEditor({ products, loading, blockedReason, keepIds }: OrderLinesEditorProps) {
  const { values, errors, touched, setFieldValue, submitCount } = useFormikContext<OrderInput>();
  const byId = useMemo(() => new Map(products.map((p) => [p.productId, p])), [products]);
  const sellable = useMemo(() => products.filter((p) => p.stock > 0 || keepIds.has(p.productId)), [products, keepIds]);

  const showError = (path: string) => (getIn(touched, path) || submitCount > 0 ? (getIn(errors, path) as string | undefined) : undefined);
  const listError = typeof errors.items === "string" && submitCount > 0 ? errors.items : undefined;

  const pick = (index: number, productId: string) => {
    setFieldValue(`items.${index}.product`, productId);
    const p = byId.get(productId);
    setFieldValue(`items.${index}.price`, p ? p.price : 0);
  };

  const totals = values.items.reduce(
    (t, l) => ({ qty: t.qty + (Number(l.quantity) || 0), amount: t.amount + (Number(l.quantity) || 0) * (Number(l.price) || 0) }),
    { qty: 0, amount: 0 }
  );
  const short = values.items.filter((l) => {
    const p = byId.get(l.product);
    return p && (Number(l.quantity) || 0) > p.stock;
  }).length;

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
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500">
            <span>{loading ? "Loading products…" : `${sellable.length} products in stock to choose from`}</span>
            {short > 0 && <span className="font-semibold text-rose-600">{short} line(s) above available stock</span>}
          </div>

          <div className="md:border md:border-slate-200 md:rounded-xl">
            {/* Header (desktop) */}
            <div
              className={`hidden md:grid ${COLS} gap-2 items-center px-3 py-2 bg-head rounded-t-xl border-b border-slate-200 text-[10.5px] font-bold text-slate-600 uppercase tracking-wider`}
            >
              <span>#</span>
              <span>Product</span>
              <span className="text-right">In Stock</span>
              <span className="text-right">Qty</span>
              <span className="text-right">Stock After</span>
              <span className="text-right">Price (₹)</span>
              <span className="text-right">Line Total</span>
              <span />
            </div>

            <div className="space-y-2 md:space-y-0 md:divide-y md:divide-slate-100">
              {values.items.map((line, index) => {
                const p = byId.get(line.product);
                const qty = Number(line.quantity) || 0;
                const after = p ? p.stock - qty : null;
                const qtyErr = showError(`items.${index}.quantity`);
                const productErr = showError(`items.${index}.product`);
                const priceErr = showError(`items.${index}.price`);
                const total = qty * (Number(line.price) || 0);
                // One line per product: hide products already used on other lines
                const used = new Set(values.items.filter((_, i) => i !== index).map((l) => l.product));
                const options = sellable.filter((o) => !used.has(o.productId));
                if (p && !options.includes(p)) options.unshift(p);

                return (
                  <div
                    key={index}
                    className={`grid grid-cols-2 ${COLS} gap-2 md:items-center p-3 md:px-3 md:py-2 border md:border-0 border-slate-200 rounded-xl md:rounded-none bg-slate-50/50 md:bg-transparent ${
                      after !== null && after < 0 ? "md:bg-rose-50/60" : ""
                    }`}
                  >
                    <span className="hidden md:block text-[11px] font-bold text-slate-400">{index + 1}</span>

                    <div className="col-span-2 md:col-span-1 space-y-1">
                      <ProductPicker
                        id={`line-${index}-product`}
                        products={options}
                        value={line.product}
                        onChange={(id) => pick(index, id)}
                        invalid={Boolean(productErr)}
                      />
                      {productErr && <p className="text-[11px] text-rose-600 font-medium">{productErr}</p>}
                    </div>

                    <Cell label="In Stock">
                      <span className="font-semibold text-slate-700 tabular-nums">{p ? formatNumber(p.stock) : "—"}</span>
                    </Cell>

                    <label className="space-y-1">
                      <span className="md:hidden block text-[10px] font-bold text-slate-500 uppercase">Qty</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        step={1}
                        aria-label={`Quantity for line ${index + 1}`}
                        value={line.quantity ?? ""}
                        onChange={(e) => setFieldValue(`items.${index}.quantity`, e.target.value === "" ? "" : Number(e.target.value))}
                        className={`${inputClass(Boolean(qtyErr) || (after !== null && after < 0))} text-right`}
                      />
                      {qtyErr && <p className="text-[11px] text-rose-600 font-medium">{qtyErr}</p>}
                    </label>

                    <Cell label="Stock After">
                      {after === null ? (
                        <span className="text-slate-400">—</span>
                      ) : (
                        <span
                          className={`tabular-nums font-bold ${after < 0 ? "text-rose-600" : after === 0 ? "text-amber-600" : "text-emerald-700"}`}
                          title={after < 0 ? "More than the stock available" : "Stock left once this order is confirmed"}
                        >
                          {after < 0 ? `Short ${formatNumber(-after)}` : formatNumber(after)}
                        </span>
                      )}
                    </Cell>

                    <label className="space-y-1">
                      <span className="md:hidden block text-[10px] font-bold text-slate-500 uppercase">Price (₹)</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        aria-label={`Price for line ${index + 1}`}
                        value={line.price ?? ""}
                        onChange={(e) => setFieldValue(`items.${index}.price`, e.target.value === "" ? "" : Number(e.target.value))}
                        className={`${inputClass(Boolean(priceErr))} text-right`}
                      />
                      {priceErr && <p className="text-[11px] text-rose-600 font-medium">{priceErr}</p>}
                    </label>

                    <Cell label="Line Total">
                      <span className="font-bold text-slate-900 tabular-nums">{formatCurrency(total)}</span>
                    </Cell>

                    <div className="flex justify-end">
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        disabled={values.items.length === 1}
                        title="Remove line"
                        aria-label={`Remove line ${index + 1}`}
                        className="h-9 w-9 inline-flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer: add line + totals */}
            <div
              className={`grid grid-cols-2 ${COLS} gap-2 items-center mt-2 md:mt-0 px-3 py-2.5 md:border-t md:border-slate-200 md:bg-slate-50/70 md:rounded-b-xl`}
            >
              <div className="col-span-2 md:col-span-2">
                <button
                  type="button"
                  onClick={() => push({ ...emptyLine })}
                  disabled={!loading && optionsLeft(values.items, sellable) === 0}
                  className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg border border-dashed border-brand-border text-brand hover:bg-brand-light disabled:opacity-40"
                >
                  <Plus className="w-4 h-4" />
                  Add product
                </button>
              </div>
              <span className="hidden md:block" />
              <span className="text-xs font-bold text-slate-700 md:text-right tabular-nums">
                <span className="md:hidden text-slate-500 font-semibold">Total qty </span>
                {formatNumber(totals.qty)}
              </span>
              <span className="hidden md:block" />
              <span className="hidden md:block text-right text-[11px] font-bold text-slate-500 uppercase">Subtotal</span>
              <span className="text-xs font-black text-brand text-right tabular-nums">
                <span className="md:hidden text-slate-500 font-semibold">Subtotal </span>
                {formatCurrency(totals.amount)}
              </span>
              <span className="hidden md:block" />
            </div>
          </div>

          {listError && <p className="text-[11px] text-rose-600 font-medium">{listError}</p>}
        </div>
      )}
    </FieldArray>
  );
}

/** How many sellable products are not on the order yet. */
function optionsLeft(items: { product: string }[], sellable: OrderProductOption[]): number {
  const used = new Set(items.map((i) => i.product));
  return sellable.filter((p) => !used.has(p.productId)).length;
}

function Cell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between md:justify-end h-9 text-xs">
      <span className="md:hidden text-[10px] font-bold text-slate-500 uppercase">{label}</span>
      {children}
    </div>
  );
}
