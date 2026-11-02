"use client";

import { Edit2, Eye, Plus, Power } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import type { Channel } from "@/lib/commerceTypes";
import { formatNumber } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { apiRequest, ApiError } from "@/services/apiClient";
import { ChannelFormModal } from "./ChannelFormModal";

const iconBtn = "p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light transition-colors";

/** Activate / deactivate a marketplace (inactive ones cannot take new orders). */
export function useToggleChannel() {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const toggle = async (c: Pick<Channel, "_id" | "name" | "status">) => {
    setBusy(c._id);
    const status = c.status === "active" ? "inactive" : "active";
    try {
      await apiRequest(`/api/channels/${c._id}`, "PATCH", { status });
      toast.success(`${c.name} ${status === "active" ? "activated" : "deactivated"}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not change status");
    } finally {
      setBusy(null);
    }
  };
  return { toggle, busy };
}

export function NewChannelButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
      >
        <Plus className="w-4 h-4" />
        New Marketplace
      </button>
      <ChannelFormModal channel={open ? "new" : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function ChannelListView({ data }: { data: Paginated<Channel> }) {
  const canEdit = usePermission("channel", "update");
  const canDelete = usePermission("channel", "delete");
  const [editing, setEditing] = useState<Channel | null>(null);
  const { toggle, busy } = useToggleChannel();

  const columns = useMemo<Column<Channel>[]>(
    () => [
      {
        key: "name",
        label: "Marketplace",
        render: (c) => (
          <Link href={`/dashboard/channels/${c._id}`} className="inline-flex flex-col hover:text-brand">
            <span className="font-semibold text-slate-900">{c.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{c.code}</span>
          </Link>
        ),
      },
      { key: "description", label: "Description", render: (c) => <span className="whitespace-normal">{c.description || "—"}</span> },
      {
        key: "productCount",
        label: "Products Assigned",
        align: "right",
        render: (c) => <span className="font-bold text-slate-900">{formatNumber(c.productCount ?? 0)}</span>,
      },
      { key: "status", label: "Status", align: "center", render: (c) => <StatusBadge status={c.status} /> },
    ],
    []
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName="marketplaces"
        searchPlaceholder="Search by name, code, description..."
        filters={[STATUS_FILTER]}
        rowActions={(c) => (
          <div className="flex items-center justify-center gap-1.5">
            <Link href={`/dashboard/channels/${c._id}`} title="View products" className={iconBtn}>
              <Eye className="w-3.5 h-3.5" />
            </Link>
            {canEdit && (
              <>
                <button type="button" title="Edit" className={iconBtn} onClick={() => setEditing(c)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  title={c.status === "active" ? "Deactivate" : "Activate"}
                  disabled={busy === c._id}
                  className={`${iconBtn} ${c.status === "active" ? "hover:text-amber-700" : "hover:text-emerald-700"}`}
                  onClick={() => toggle(c)}
                >
                  <Power className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            {canDelete && <RowActions entityLabel="Marketplace" itemName={c.name} deleteUrl={`/api/channels/${c._id}`} />}
          </div>
        )}
      />
      <ChannelFormModal channel={editing} onClose={() => setEditing(null)} />
    </>
  );
}
