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

/**
 * Variants (packet weight / size): SKU, size, unit, selling price and stock units.
 * Stock units post an opening stock / adjustment entry when saved. Rows stack on phones.
 */
export function VariantsEditor({ stockById }: { stockById: Record<string, number> }) {
  const { values } = useFormikContext<ProductInput>();
  const variants = values.variants ?? [];

  return (
    <FieldArray name="variants">
      {({ push, remove }) => (
        <div className="md:col-span-2 lg:col-span-3 space-y-3">
          {variants.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-lg px-4 py-5 text-center">
              <Layers className="w-6 h-6 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700 mt-1">No variants — this product is sold as one item</p>
              <p className="text-[11px] text-slate-500">Add a variant for each packet weight / size, e.g. 250 g, 500 g, 1 kg.</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {variants.map((v, i) => {
                const saved = v._id ? stockById[v._id] : undefined;
                return (
                  <li key={v._id || `new-${i}`} className="border border-line rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                        {v.size ? variantLabel(v.size, v.unit) : `Variant ${i + 1}`}
                        {!v._id && <span className="ml-2 font-semibold text-emerald-700 normal-case">New</span>}
                        {saved !== undefined && Number(v.stock) !== saved && (
                          <span className="ml-2 font-semibold text-amber-700 normal-case">
                            Stock {formatNumber(saved)} → {formatNumber(Number(v.stock) || 0)} (adjustment entry)
                          </span>
                        )}
                      </span>
                      <button
                        type="button"
                        onClick={() => remove(i)}
                        className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Remove variant"
                        aria-label={`Remove variant ${i + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-5 gap-x-3 gap-y-2">
                      <TextField
                        name={`variants.${i}.sku`}
                        label="SKU Code"
                        required
                        placeholder="e.g. AKD-CHIPS-250G"
                        className="col-span-2 lg:col-span-1 [&_input]:font-mono [&_input]:uppercase"
                      />
                      <TextField name={`variants.${i}.size`} label="Packet Weight / Size" required placeholder="e.g. 250" inputMode="decimal" />
                      <SelectField name={`variants.${i}.unit`} label="Unit" required options={UNIT_OPTIONS} />
                      <TextField name={`variants.${i}.sellingPrice`} label="Selling Price (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
                      <TextField name={`variants.${i}.stock`} label="Stock Units" type="number" min={0} step={1} inputMode="numeric" />
                    </div>
                  </li>
                );
              })}
            </ul>
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
