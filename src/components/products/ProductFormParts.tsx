"use client";

import { FieldArray, useField, useFormikContext } from "formik";
import type { ReactNode } from "react";
import { Clapperboard, Plus, Trash2 } from "lucide-react";
import { TextField } from "@/components/forms/FormikFields";
import { Button } from "@/components/ui/Button";
import type { ProductImage } from "@/lib/commerceTypes";
import type { Product } from "@/lib/types";
import { MAX_PRODUCT_IMAGES, VARIANT_UNITS, type ProductInput, type VariantInput } from "@/lib/validation/product.schema";
import { ProductImageGallery } from "./ProductImages";

export const FLAVOR_SUGGESTIONS = ["Traditional", "Classic", "Salted", "Sweet", "Spicy", "Tangy", "Masala", "Cheesy", "Peri Peri", "Mint"];

/** Bordered block with a small heading: groups the product form into clean cards. */
export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-white p-4 space-y-3">
      <div>
        <h2 className="text-xs font-bold text-brand uppercase tracking-wider">{title}</h2>
        {description && <p className="text-[11px] text-slate-500 mt-0.5">{description}</p>}
      </div>
      {children}
    </section>
  );
}

/** Checkbox card, e.g. Free Delivery, Visible on Storefront. */
export function ToggleField({ name, label, hint }: { name: "freeDelivery" | "storefrontVisible"; label: string; hint: string }) {
  const [field, , helpers] = useField<boolean>(name);
  return (
    <label className="flex items-start gap-2.5 p-2.5 rounded-lg border border-line bg-slate-50/60 cursor-pointer">
      <input type="checkbox" checked={Boolean(field.value)} onChange={(e) => void helpers.setValue(e.target.checked)} className="mt-0.5 w-4 h-4 accent-brand" />
      <span>
        <span className="block text-[12px] font-semibold text-slate-700">{label}</span>
        <span className="block text-[11px] text-slate-500">{hint}</span>
      </span>
    </label>
  );
}

export function ImagesField() {
  const [field, , helpers] = useField<ProductImage[]>("images");
  return <ProductImageGallery images={field.value ?? []} onChange={(next) => void helpers.setValue(next)} max={MAX_PRODUCT_IMAGES} />;
}

/** Instagram Reel Showcase: any number of reel links (up to 10). */
export function InstagramReelsField() {
  const { values } = useFormikContext<ProductInput>();
  const reels = values.instagramReels ?? [];
  return (
    <FieldArray name="instagramReels">
      {({ push, remove }) => (
        <div className="space-y-2">
          {reels.length === 0 && <p className="text-[11px] text-slate-500">No reels yet. Add links to Instagram reels that show this product.</p>}
          {reels.map((_, i) => (
            <div key={i} className="flex items-end gap-2">
              <Clapperboard className="w-4 h-4 text-pink-600 mb-2.5 shrink-0" />
              <TextField
                name={`instagramReels.${i}`}
                label={`Reel ${i + 1}`}
                placeholder="https://www.instagram.com/reel/…"
                inputMode="url"
                className="flex-1 min-w-0"
              />
              <button
                type="button"
                onClick={() => remove(i)}
                className="mb-1 p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                title="Remove link"
                aria-label={`Remove reel ${i + 1}`}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {reels.length < 10 && (
            <Button variant="outline" icon={<Plus className="w-4 h-4" />} onClick={() => push("")}>
              Add Reel Link
            </Button>
          )}
        </div>
      )}
    </FieldArray>
  );
}

/** Older variants only have a name like "250 g" / "1 kg" / "1000 ml": split it into size + unit. */
function splitVariantName(v: Product): { size: string; unit: VariantInput["unit"] } {
  if (v.size && v.unit && (VARIANT_UNITS as readonly string[]).includes(v.unit)) return { size: v.size, unit: v.unit as VariantInput["unit"] };
  const m = /^\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]+)\s*$/.exec(v.variantName ?? "");
  const raw = m?.[2]?.toLowerCase() ?? "";
  const unit = (({ ltr: "l", litre: "l", liter: "l", gm: "g", gms: "g", grams: "g", kgs: "kg", pc: "pcs", piece: "pcs", pieces: "pcs" }) as Record<string, string>)[raw] ?? raw;
  if (m && (VARIANT_UNITS as readonly string[]).includes(unit)) return { size: m[1], unit: unit as VariantInput["unit"] };
  return { size: v.variantName ?? "", unit: "pcs" };
}

export function toInitialValues(initial: Product): ProductInput {
  return {
    sku: initial.sku,
    name: initial.name,
    barcode: initial.barcode || "",
    category: initial.category || "",
    description: initial.description || "",
    mrp: initial.mrp ?? 0,
    sellingPrice: initial.sellingPrice,
    costPrice: initial.costPrice,
    reorderLevel: initial.reorderLevel,
    status: initial.status,
    flavorProfile: initial.flavorProfile || "",
    // Older products: start the summary from their description
    summary: initial.summary || (initial.description ?? "").slice(0, 300),
    story: initial.story || "",
    ingredients: initial.ingredients || "",
    shelfLife: initial.shelfLife || "",
    mfgDate: initial.mfgDate || "",
    expiryDate: initial.expiryDate || "",
    storefrontVisible: initial.storefrontVisible ?? true,
    displayOrder: initial.displayOrder ?? 0,
    instagramReels: initial.instagramReels ?? [],
    freeDelivery: Boolean(initial.freeDelivery),
    images: initial.images ?? [],
    variants: (initial.variants ?? []).map((v) => ({
      _id: v._id,
      sku: v.sku,
      ...splitVariantName(v),
      sellingPrice: v.sellingPrice,
      stock: v.stock ?? 0,
      variantName: v.variantName || "",
      barcode: v.barcode || "",
      mrp: v.mrp ?? 0,
      costPrice: v.costPrice,
      reorderLevel: v.reorderLevel,
      status: v.status,
    })),
  };
}
