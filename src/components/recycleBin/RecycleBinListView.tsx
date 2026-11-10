"use client";

import { RotateCcw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { formatDateTime } from "@/lib/format";
import { RECYCLE_BIN_TYPES, type RecycleBinItem } from "@/lib/recycleBinTypes";
import type { Paginated } from "@/lib/types";
import { ApiError, apiRequest } from "@/services/apiClient";

function RestoreButton({ item }: { item: RecycleBinItem }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const restore = async () => {
    setBusy(true);
    try {
      const res = await apiRequest<{ type: string; href?: string }>(`/api/recycle-bin/${item._id}/restore`, "POST");
      toast.success(`${res.type} restored`, res.href ? { action: { label: "Open", onClick: () => router.push(res.href!) } } : undefined);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not restore");
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={restore}
      disabled={busy}
      title="Restore"
      className="inline-flex items-center gap-1 h-7 px-2 rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[11px] font-bold hover:bg-emerald-100 disabled:opacity-50"
    >
      <RotateCcw className={`w-3.5 h-3.5 ${busy ? "animate-spin" : ""}`} />
      Restore
    </button>
  );
}

export function RecycleBinListView({ data }: { data: Paginated<RecycleBinItem> }) {
  const columns = useMemo<Column<RecycleBinItem>[]>(
    () => [
      {
        key: "title",
        label: "Deleted Item",
        render: (r) => (
          <span className="inline-flex flex-col">
            <span className="font-semibold text-slate-900 whitespace-normal">{r.title}</span>
            {r.detail && <span className="text-[11px] text-slate-500 whitespace-normal">{r.detail}</span>}
          </span>
        ),
      },
      { key: "type", label: "Module", render: (r) => <Badge variant="neutral">{r.typeLabel}</Badge> },
      { key: "deletedAt", label: "Deleted On", render: (r) => formatDateTime(r.deletedAt) },
      { key: "deletedBy", label: "Deleted By", render: (r) => r.deletedBy || "—" },
    ],
    []
  );
  const filters = useMemo<FilterConfig[]>(() => [{ key: "type", allLabel: "All Modules", minWidth: "170px", options: RECYCLE_BIN_TYPES }], []);

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="deleted items"
      searchPlaceholder="Search deleted items..."
      filters={filters}
      rowActions={(r) =>
        r.canRestore ? (
          <div className="flex items-center justify-center gap-1.5">
            <RestoreButton item={r} />
            <RowActions entityLabel={r.typeLabel} itemName={r.title} deleteUrl={`/api/recycle-bin/${r._id}`} permanent />
          </div>
        ) : (
          <span className="text-[11px] text-slate-400">No permission</span>
        )
      }
    />
  );
}
