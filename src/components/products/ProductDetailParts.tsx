"use client";

import Link from "next/link";
import { useState } from "react";
import { StockLevelBadge, stockLevel } from "@/components/inventory/StockLevelBadge";
import { StatusBadge } from "@/components/ui/Badge";
import type { ProductImage } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Product } from "@/lib/types";
import { ProductThumb } from "./ProductImages";
import { PRODUCT_UI } from "./productConfig";

/** Large cover photo with clickable thumbnails. */
export function ProductGallery({ images }: { images: ProductImage[] }) {
  const [active, setActive] = useState(0);
  const current = images[Math.min(active, images.length - 1)];
  if (!current) return null;
  return (
    <section className="flex flex-col sm:flex-row gap-3">
      <a
        href={current.url}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full sm:w-72 aspect-square rounded-xl border border-line bg-slate-50 overflow-hidden shrink-0"
        title="Open full size"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt={current.name || "Product photo"} className="w-full h-full object-contain" />
      </a>
      {images.length > 1 && (
        <ul className="flex sm:flex-col flex-wrap gap-2 content-start">
          {images.map((img, i) => (
            <li key={img.publicId}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-label={`Show photo ${i + 1}`}
                className={`rounded-md ${i === active ? "ring-2 ring-brand" : "opacity-80 hover:opacity-100"}`}
              >
                <ProductThumb image={img} size={56} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Product detail: its variants with price, stock and level. */
export function VariantTable({ variants }: { variants: Product[] }) {
  return (
    <section className="bg-white border border-line rounded-xl p-4 space-y-3">
      <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Variants ({variants.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse min-w-[640px]">
          <thead>
            <tr className="bg-head text-[11px] font-bold text-slate-600 uppercase tracking-wider border-b border-line">
              <th className="px-3 py-2 text-left">Variant / Size</th>
              <th className="px-3 py-2 text-left">SKU Code</th>
              <th className="px-3 py-2 text-right">MRP</th>
              <th className="px-3 py-2 text-right">Selling Price</th>
              <th className="px-3 py-2 text-right">Cost Price</th>
              <th className="px-3 py-2 text-right">Stock</th>
              <th className="px-3 py-2 text-center">Stock Level</th>
              <th className="px-3 py-2 text-center">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {variants.map((v) => (
              <tr key={v._id} className="hover:bg-head">
                <td className="px-3 py-2">
                  <Link href={`${PRODUCT_UI.basePath}/${v._id}`} className="inline-flex items-center gap-2 font-semibold text-slate-900 hover:text-brand">
                    <ProductThumb image={v.images?.[0]} size={28} />
                    {v.variantName}
                  </Link>
                </td>
                <td className="px-3 py-2 font-mono font-semibold text-slate-700">{v.sku}</td>
                <td className="px-3 py-2 text-right text-slate-500">{v.mrp ? formatCurrency(v.mrp) : "—"}</td>
                <td className="px-3 py-2 text-right font-bold text-slate-900">{formatCurrency(v.sellingPrice)}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(v.costPrice)}</td>
                <td className="px-3 py-2 text-right font-bold">{formatNumber(v.stock ?? 0)}</td>
                <td className="px-3 py-2 text-center">
                  <StockLevelBadge level={stockLevel(v.stock ?? 0, v.reorderLevel)} />
                </td>
                <td className="px-3 py-2 text-center">
                  <StatusBadge status={v.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
