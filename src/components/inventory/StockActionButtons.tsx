"use client";

import { PackagePlus, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { StockAdjustModal, type AdjustTarget } from "./StockAdjustModal";

const btn =
  "inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 transition";

/** "Add stock" (Stock Update page, product preselected) and "Adjust" (modal) for one product. */
export function StockActionButtons({ target, disabledAdd = false }: { target: AdjustTarget; disabledAdd?: boolean }) {
  const canAdd = usePermission("stock", "create");
  const canAdjust = usePermission("stock", "update");
  const [open, setOpen] = useState(false);
  return (
    <>
      {canAdd && !disabledAdd && (
        <Link href={`/dashboard/inventory/update?product=${target._id}`} className={btn}>
          <PackagePlus className="w-4 h-4" />
          Add Stock
        </Link>
      )}
      {canAdjust && (
        <button type="button" className={btn} onClick={() => setOpen(true)}>
          <SlidersHorizontal className="w-4 h-4" />
          Adjust
        </button>
      )}
      <StockAdjustModal target={open ? target : null} onClose={() => setOpen(false)} />
    </>
  );
}
