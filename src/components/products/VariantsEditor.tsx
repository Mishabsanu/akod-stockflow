"use client";

import { FieldArray, useField, useFormikContext } from "formik";
import { Layers, Plus, Trash2 } from "lucide-react";
import { SelectField, STATUS_OPTIONS, TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";
import { emptyVariant, MAX_VARIANTS, type ProductInput, type VariantInput } from "@/lib/validation/product.schema";
import { VariantImagePicker } from "./ProductImages";

function VariantImage({ index }: { index: number }) {
  const [field, , helpers] = useField<VariantInput["image"]>(`variants.${index}.image`);
  return <VariantImagePicker image={field.value} onChange={(next) => void helpers.setValue(next)} />;
}

/** Suggested SKU for a new variant: product SKU + variant name, e.g. AKD-CHIPS + "500 g" → AKD-CHIPS-500G. */
function suggestSku(productSku: string, variantName: string) {
  const suffix = variantName.toUpperCase().replace(/[^A-Z0-9]+/g, "");
  return productSku && suffix ? `${productSku.trim().toUpperCase()}-${suffix}`.slice(0, 40) : "";
}

/**
 * Variants (size, pack, flavour …): each is sold and stocked on its own SKU.
 * Rows stack on phones; existing variants with orders or stock can be set inactive but not removed.
 */
export function VariantsEditor({ stockById }: { stockById: Record<string, number> }) {
  const { values, setFieldValue } = useFormikContext<ProductInput>();
  const variants = values.variants ?? [];

  return (
    <FieldArray name="variants">
      {({ push, remove }) => (
        <div className="md:col-span-2 lg:col-span-3 space-y-3">
          {variants.length === 0 ? (
            <div className="border border-dashed border-slate-300 rounded-lg px-4 py-5 text-center">
              <Layers className="w-6 h-6 mx-auto text-slate-300" />
              <p className="text-xs font-semibold text-slate-700 mt-1">No variants — this product is sold as one item</p>
              <p className="text-[11px] text-slate-500">
                Add variants when it comes in sizes, packs or flavours. Each variant gets its own SKU, price, stock and photo.
              </p>
            </div>
          ) : (
            <ul className="space-y-3">
              {variants.map((v, i) => {
                const stock = v._id ? stockById[v._id] : undefined;
                return (
                  <li key={v._id || `new-${i}`} className="border border-line rounded-lg p-3 bg-slate-50/50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[11px] font-bold text-brand uppercase tracking-wider">
                        Variant {i + 1}
                        {stock !== undefined && <span className="ml-2 font-semibold text-slate-500 normal-case">Stock {formatNumber(stock)}</span>}
                        {!v._id && <span className="ml-2 font-semibold text-emerald-700 normal-case">New</span>}
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
                    <div className="flex gap-3 items-start">
                      <VariantImage index={i} />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 flex-1 min-w-0">
                        <TextField
                          name={`variants.${i}.variantName`}
                          label="Variant / Size"
                          required
                          placeholder="e.g. 500 g"
                          maxLength={80}
                          onChange={(e) => {
                            const name = e.target.value;
                            const prev = suggestSku(values.sku, v.variantName);
                            void setFieldValue(`variants.${i}.variantName`, name);
                            // Keep suggesting the SKU on new rows until the user edits it
                            if (!v._id && (!v.sku || v.sku === prev)) void setFieldValue(`variants.${i}.sku`, suggestSku(values.sku, name));
                          }}
                        />
                        <TextField
                          name={`variants.${i}.sku`}
                          label="SKU Code"
                          required
                          placeholder="e.g. AKD-CHIPS-500G"
                          className="[&_input]:font-mono [&_input]:uppercase"
                        />
                        <TextField name={`variants.${i}.mrp`} label="MRP (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
                        <TextField name={`variants.${i}.sellingPrice`} label="Selling Price (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
                        <TextField name={`variants.${i}.costPrice`} label="Cost Price (₹)" type="number" min={0} step="0.01" inputMode="decimal" />
                        <TextField name={`variants.${i}.barcode`} label="Barcode" placeholder="Optional" inputMode="numeric" />
                        <TextField name={`variants.${i}.reorderLevel`} label="Reorder Level" type="number" min={0} step={1} inputMode="numeric" />
                        <SelectField name={`variants.${i}.status`} label="Status" required options={STATUS_OPTIONS} />
                      </div>
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
                // A new row starts with the product's prices; the user only changes what differs
                const last = variants[variants.length - 1];
                push({
                  ...emptyVariant,
                  mrp: last?.mrp ?? values.mrp,
                  sellingPrice: last?.sellingPrice ?? values.sellingPrice,
                  costPrice: last?.costPrice ?? values.costPrice,
                  reorderLevel: last?.reorderLevel ?? values.reorderLevel,
                });
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
