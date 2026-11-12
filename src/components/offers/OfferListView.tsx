"use client";

import { Edit2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import type { Offer } from "@/lib/commerceTypes";
import { formatDay } from "@/lib/indiaDate";
import type { Paginated } from "@/lib/types";
import { offerLabel } from "@/lib/validation/offer.schema";
import { OfferFormModal } from "./OfferFormModal";

export type OfferOptions = {
  categories: string[];
  products: { id: string; name: string; sku: string; category: string }[];
};

const iconBtn = "p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light transition-colors";

const STATE_STYLE: Record<NonNullable<Offer["state"]>, string> = {
  live: "bg-emerald-50 text-emerald-700 border-emerald-200",
  scheduled: "bg-sky-50 text-sky-700 border-sky-200",
  expired: "bg-slate-100 text-slate-500 border-slate-200",
  inactive: "bg-rose-50 text-rose-700 border-rose-200",
};
const STATE_LABEL: Record<NonNullable<Offer["state"]>, string> = {
  live: "Live now",
  scheduled: "Scheduled",
  expired: "Expired",
  inactive: "Inactive",
};

export function NewOfferButton({ options }: { options: OfferOptions }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
      >
        <Plus className="w-4 h-4" />
        New Offer
      </button>
      <OfferFormModal offer={open ? "new" : null} options={options} onClose={() => setOpen(false)} />
    </>
  );
}

function scopeText(o: Offer) {
  if (o.appliesTo === "all") return "All products";
  if (o.appliesTo === "categories") return o.categories.join(", ") || "—";
  const names = o.productNames ?? [];
  return names.length > 2 ? `${names.slice(0, 2).join(", ")} +${names.length - 2} more` : names.join(", ") || "—";
}

function datesText(o: Offer) {
  if (!o.startDate && !o.endDate) return "Always";
  if (o.startDate && o.endDate) return `${formatDay(o.startDate)} – ${formatDay(o.endDate)}`;
  return o.startDate ? `From ${formatDay(o.startDate)}` : `Until ${formatDay(o.endDate!)}`;
}

export function OfferListView({ data, options }: { data: Paginated<Offer>; options: OfferOptions }) {
  const canEdit = usePermission("offer", "update");
  const canDelete = usePermission("offer", "delete");
  const [editing, setEditing] = useState<Offer | null>(null);

  const columns = useMemo<Column<Offer>[]>(
    () => [
      {
        key: "name",
        label: "Offer",
        render: (o) => (
          <span className="block">
            <span className="font-semibold text-slate-900">{o.name}</span>
            {o.description && <span className="block text-[11px] text-slate-500 whitespace-normal">{o.description}</span>}
          </span>
        ),
      },
      {
        key: "value",
        label: "Discount",
        align: "center",
        render: (o) => (
          <span className="inline-flex rounded-md bg-slate-900 px-2 py-0.5 text-[11px] font-bold text-white">{offerLabel(o)}</span>
        ),
      },
      {
        key: "appliesTo",
        label: "Applies To",
        render: (o) => (
          <span className="block whitespace-normal">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              {o.appliesTo === "all" ? "Store-wide" : o.appliesTo === "categories" ? "Categories" : "Products"}
            </span>
            <span className="block text-slate-800">{scopeText(o)}</span>
          </span>
        ),
      },
      { key: "dates", label: "Dates", render: (o) => datesText(o) },
      {
        key: "state",
        label: "Status",
        align: "center",
        render: (o) =>
          o.state ? (
            <span className={`inline-flex rounded border px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide ${STATE_STYLE[o.state]}`}>
              {STATE_LABEL[o.state]}
            </span>
          ) : null,
      },
    ],
    []
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName="offers"
        searchPlaceholder="Search offers..."
        filters={[STATUS_FILTER]}
        rowActions={(o) => (
          <div className="flex items-center justify-center gap-1.5">
            {canEdit && (
              <button type="button" title="Edit" className={iconBtn} onClick={() => setEditing(o)}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && <RowActions entityLabel="Offer" itemName={o.name} deleteUrl={`/api/offers/${o._id}`} />}
          </div>
        )}
      />
      <OfferFormModal offer={editing} options={options} onClose={() => setEditing(null)} />
    </>
  );
}
