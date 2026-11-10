"use client";

import { Edit2, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import type { Manufacturer } from "@/lib/batchCodeTypes";
import type { Paginated } from "@/lib/types";
import { ManufacturerFormModal } from "./ManufacturerFormModal";

const iconBtn = "p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light transition-colors";
const SHOWN_CODES = 10;

export function NewManufacturerButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
      >
        <Plus className="w-4 h-4" />
        New Manufacturer
      </button>
      <ManufacturerFormModal manufacturer={open ? "new" : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function CodeChips({ codes, highlight, limit }: { codes: string[]; highlight?: string; limit?: number }) {
  const shown = limit ? codes.slice(0, limit) : codes;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {shown.map((c) => (
        <span
          key={c}
          className={`inline-flex items-center justify-center min-w-8 h-6 px-2 rounded-full text-[11px] font-bold font-mono border ${
            c === highlight ? "bg-brand text-white border-brand" : "bg-slate-100 text-slate-700 border-slate-200"
          }`}
        >
          {c}
        </span>
      ))}
      {limit && codes.length > limit && <span className="text-[11px] text-slate-500 self-center">+{codes.length - limit} more</span>}
    </span>
  );
}

export function ManufacturerListView({ data }: { data: Paginated<Manufacturer> }) {
  const canEdit = usePermission("production", "update");
  const canDelete = usePermission("production", "delete");
  const [editing, setEditing] = useState<Manufacturer | null>(null);

  const columns = useMemo<Column<Manufacturer>[]>(
    () => [
      {
        key: "name",
        label: "Manufacturer",
        render: (m) => (
          <span className="inline-flex flex-col max-w-xs">
            <span className="font-semibold text-slate-900 whitespace-normal">{m.name}</span>
            <span className="text-[11px] text-slate-500 whitespace-normal line-clamp-2">{m.address}</span>
          </span>
        ),
      },
      { key: "fssaiLicNo", label: "FSSAI Lic. No.", mono: true, render: (m) => m.fssaiLicNo },
      {
        key: "batchCodes",
        label: "Batch Codes",
        render: (m) => (
          <span className="whitespace-normal">
            <CodeChips codes={m.batchCodes} limit={SHOWN_CODES} />
          </span>
        ),
      },
      { key: "phone", label: "Phone", hiddenByDefault: true, render: (m) => m.phone || "—" },
      { key: "status", label: "Status", align: "center", render: (m) => <StatusBadge status={m.status} /> },
    ],
    []
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName="manufacturers"
        searchPlaceholder="Search name, address, FSSAI no or an exact batch code..."
        filters={[STATUS_FILTER]}
        rowActions={(m) => (
          <div className="flex items-center justify-center gap-1.5">
            {canEdit && (
              <button type="button" title="Edit" className={iconBtn} onClick={() => setEditing(m)}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && <RowActions entityLabel="Manufacturer" itemName={m.name} deleteUrl={`/api/manufacturers/${m._id}`} />}
          </div>
        )}
      />
      <ManufacturerFormModal manufacturer={editing} onClose={() => setEditing(null)} />
    </>
  );
}
