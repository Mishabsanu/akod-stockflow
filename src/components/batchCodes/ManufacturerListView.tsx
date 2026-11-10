"use client";

import { Edit2, Eye, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import type { Manufacturer } from "@/lib/batchCodeTypes";
import type { Paginated } from "@/lib/types";

const iconBtn = "p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light transition-colors";
const SHOWN_CODES = 10;
export const BASE = "/dashboard/production";

/** Header button: opens the New Batch Number page. */
export function NewManufacturerButton() {
  return (
    <Link
      href={`${BASE}/new`}
      className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
    >
      <Plus className="w-4 h-4" />
      New Batch Number
    </Link>
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

  const columns = useMemo<Column<Manufacturer>[]>(
    () => [
      {
        key: "batchCodes",
        label: "Batch Number",
        render: (m) => (
          <span className="whitespace-normal">
            <CodeChips codes={m.batchCodes} limit={SHOWN_CODES} />
          </span>
        ),
      },
      { key: "fssaiLicNo", label: "FSSAI Lic. No.", mono: true, render: (m) => m.fssaiLicNo },
      {
        key: "name",
        label: "Company Name",
        render: (m) => (
          <Link href={`${BASE}/${m._id}`} className="font-semibold text-slate-900 hover:text-brand whitespace-normal">
            {m.name}
          </Link>
        ),
      },
      {
        key: "address",
        label: "Address",
        render: (m) => <span className="block max-w-xs text-slate-600 whitespace-normal line-clamp-2">{m.address}</span>,
      },
      { key: "status", label: "Status", align: "center", render: (m) => <StatusBadge status={m.status} /> },
    ],
    []
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName="batch numbers"
        searchPlaceholder="Search batch number, FSSAI no, company name, address..."
        filters={[STATUS_FILTER]}
        rowActions={(m) => (
          <div className="flex items-center justify-center gap-1.5">
            <Link href={`${BASE}/${m._id}`} title="View" className={iconBtn}>
              <Eye className="w-3.5 h-3.5" />
            </Link>
            {canEdit && (
              <Link href={`${BASE}/${m._id}/edit`} title="Edit" className={iconBtn}>
                <Edit2 className="w-3.5 h-3.5" />
              </Link>
            )}
            {canDelete && <RowActions entityLabel="Batch Number" itemName={`${m.batchCodes.join(", ")} — ${m.name}`} deleteUrl={`/api/manufacturers/${m._id}`} />}
          </div>
        )}
      />
    </>
  );
}
