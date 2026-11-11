"use client";

import { FieldArray, useFormikContext } from "formik";
import { Layers, Plus, Trash2 } from "lucide-react";
import { SelectField, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import {
  emptyVariant,
  MAX_VARIANTS,
  VARIANT_UNIT_LABELS,
  VARIANT_UNITS,
  variantLabel,
  type ProductInput,
} from "@/lib/validation/product.schema";

const UNIT_OPTIONS = VARIANT_UNITS.map((u) => ({ value: u, label: VARIANT_UNIT_LABELS[u] }));

/** One line per variant: SKU · size · unit · selling price · MRP · stock · remove. */
const ROW = "grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_2rem]";
// Same columns from the sm breakpoint up (written out in full so Tailwind generates it)
const ROW_SM = "sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1.1fr)_minmax(0,1fr)_2rem]";

/**
 * Variants (packet weight / size): SKU, size, unit, selling price, MRP and stock units.
 * Stock units post an opening stock / adjustment entry when saved. Rows stack on phones.
 */
export function VariantsEditor({ stockById }: { stockById: Record<string, number> }) {
  const { values, errors, submitCount } = useFormikContext<ProductInput>();
  const variants = values.variants ?? [];
  // "Add at least one variant" is an error on the list itself, not on a field
  const listError = submitCount > 0 && typeof errors.variants === "string" ? errors.variants : "";

  return (
    <FieldArray name="variants">
      {({ push, remove }) => (
        <div className="space-y-3">
          {variants.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-lg px-4 py-5 text-center">
              <Layers className="w-6 h-6 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700 mt-1">Add at least one variant</p>
              <p className="text-[11px] text-slate-500">Each packet weight / size has its own SKU, selling price, MRP and stock, e.g. 250 g, 500 g, 1 kg.</p>
            </div>
          ) : (
            <div className="border border-line rounded-lg overflow-hidden">
              {/* Column headings once (tablet / laptop); phones show a label on every field */}
              <div className={`hidden sm:grid ${ROW} gap-x-2 px-2.5 py-1.5 bg-head text-[10.5px] font-bold text-slate-600 uppercase tracking-wider`}>
                <span>
                  SKU Code <span className="text-rose-500">*</span>
                </span>
                <span>
                  Weight / Size <span className="text-rose-500">*</span>
                </span>
                <span>
                  Unit <span className="text-rose-500">*</span>
                </span>
                <span>
                  Selling Price (₹) <span className="text-rose-500">*</span>
                </span>
                <span>MRP (₹)</span>
                <span>Stock Units</span>
                <span />
              </div>
              <ul className="divide-y divide-line">
                {variants.map((v, i) => {
                  const saved = v._id ? stockById[v._id] : undefined;
                  const stockChange = saved !== undefined && Number(v.stock) !== saved;
                  return (
                    <li key={v._id || `new-${i}`} className="px-2.5 py-2 bg-white">
                      <div className={`grid grid-cols-2 ${ROW_SM} gap-x-2 gap-y-2 items-start sm:[&_label]:sr-only`}>
                        <TextField
                          name={`variants.${i}.sku`}
                          label="SKU Code"
                          required
                          placeholder="e.g. AKD-CHIPS-250G"
                          className="col-span-2 sm:col-span-1 [&_input]:font-mono [&_input]:uppercase"
                        />
                        <TextField name={`variants.${i}.size`} label="Weight / Size" required placeholder="250" inputMode="decimal" />
                        <SelectField name={`variants.${i}.unit`} label="Unit" required options={UNIT_OPTIONS} />
                        <TextField name={`variants.${i}.sellingPrice`} label="Selling Price (₹)" required type="number" min={0} step="0.01" inputMode="decimal" />
                        <TextField
                          name={`variants.${i}.mrp`}
                          label="MRP (₹)"
                          type="number"
                          min={0}
                          step="0.01"
                          inputMode="decimal"
                          placeholder="Optional"
                        />
                        <TextField name={`variants.${i}.stock`} label="Stock Units" type="number" min={0} step={1} inputMode="numeric" />
                        <button
                          type="button"
                          onClick={() => remove(i)}
                          className="justify-self-end sm:justify-self-center mt-0 sm:mt-1.5 p-1.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          title="Remove variant"
                          aria-label={`Remove variant ${v.size ? variantLabel(v.size, v.unit) : i + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      {(stockChange || !v._id) && (
                        <p className="mt-1 text-[10.5px] font-semibold">
                          {!v._id && <span className="text-emerald-700">New{v.size ? ` · ${variantLabel(v.size, v.unit)}` : ""}</span>}
                          {stockChange && (
                            <span className="text-amber-700">
                              {!v._id ? " · " : ""}Stock {formatNumber(saved ?? 0)} → {formatNumber(Number(v.stock) || 0)} (adjustment entry)
                            </span>
                          )}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {listError && (
            <p role="alert" className="text-[11px] font-medium text-rose-600">
              {listError}
            </p>
          )}
          {variants.length < MAX_VARIANTS && (
            <Button
              variant="outline"
              icon={<Plus className="w-4 h-4" />}
              onClick={() => {
                const last = variants[variants.length - 1];
                push({ ...emptyVariant, unit: last?.unit ?? emptyVariant.unit, reorderLevel: last?.reorderLevel ?? values.reorderLevel });
              }}
            >
              Add Variant
            </Button>
          )}
        </div>
      )}
    </FieldArray>
  );
}
