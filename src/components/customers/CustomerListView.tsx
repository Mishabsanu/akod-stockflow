"use client";

import { Edit2, Eye, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import type { Customer } from "@/lib/commerceTypes";
import { formatCurrency } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { ApiError, apiRequest } from "@/services/apiClient";
import { CustomerFormModal } from "./CustomerFormModal";
import { CUSTOMER_KIND_OPTIONS, CUSTOMER_UI } from "./customerConfig";

export function CustomerKindBadge({ kind }: { kind: Customer["kind"] }) {
  return <Badge variant={kind === "distributor" ? "info" : "success"}>{kind === "distributor" ? "Distributor" : "Local"}</Badge>;
}

/** List with add / edit in a modal. */
export function CustomerListView({ data }: { data: Paginated<Customer> }) {
  const router = useRouter();
  const canCreate = usePermission("customer", "create");
  const canEdit = usePermission("customer", "update");
  const canDelete = usePermission("customer", "delete");
  const [editing, setEditing] = useState<Customer | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      await apiRequest(`${CUSTOMER_UI.apiBase}/${deleting._id}`, "DELETE");
      toast.success("Contact moved to the Recycle Bin");
      setDeleting(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete failed");
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<Column<Customer>[]>(
    () => [
      {
        key: "name",
        label: "Name",
        render: (c) => (
          <Link href={`${CUSTOMER_UI.basePath}/${c._id}`} className="inline-flex flex-col hover:underline">
            <span className="font-semibold text-slate-900">{c.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{c.code}</span>
          </Link>
        ),
      },
      { key: "kind", label: "Type", align: "center", render: (c) => <CustomerKindBadge kind={c.kind} /> },
      { key: "contactPerson", label: "Contact", render: (c) => c.contactPerson || "—" },
      { key: "phone", label: "Phone", render: (c) => c.phone || "—" },
      { key: "email", label: "Email", hiddenByDefault: true, render: (c) => c.email || "—" },
      { key: "gstin", label: "GSTIN", hiddenByDefault: true, mono: true, render: (c) => c.gstin || "—" },
      { key: "creditDays", label: "Credit Days", align: "right", render: (c) => (c.creditDays ? `${c.creditDays} days` : "—") },
      {
        key: "outstanding",
        label: "Outstanding",
        align: "right",
        render: (c) =>
          c.outstanding ? <span className="font-bold text-rose-700">{formatCurrency(c.outstanding)}</span> : <span className="text-slate-400">—</span>,
      },
      { key: "status", label: "Status", align: "center", render: (c) => <StatusBadge status={c.status} /> },
    ],
    []
  );

  const filters = useMemo<FilterConfig[]>(
    () => [{ key: "kind", allLabel: "All Types", options: CUSTOMER_KIND_OPTIONS }, STATUS_FILTER],
    []
  );

  const btn = "p-1 rounded text-slate-400 transition-colors hover:text-brand hover:bg-brand-light";

  return (
    <>
      {canCreate && (
        <div className="flex justify-end -mt-1">
          <Button icon={<Plus className="w-4 h-4" />} onClick={() => setAdding(true)}>
            Add Contact
          </Button>
        </div>
      )}
      <DataTable
        data={data}
        columns={columns}
        itemName="contacts"
        searchPlaceholder="Search by name, code, phone, email, GSTIN..."
        filters={filters}
        rowActions={(c) => (
          <div className="flex items-center justify-center gap-1.5">
            <Link href={`${CUSTOMER_UI.basePath}/${c._id}`} title="View" className={btn}>
              <Eye className="w-3.5 h-3.5" />
            </Link>
            {canEdit && (
              <button type="button" title="Edit" onClick={() => setEditing(c)} className={btn}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button type="button" title="Delete" onClick={() => setDeleting(c)} className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />
      <CustomerFormModal open={adding} onClose={() => setAdding(false)} />
      {editing && <CustomerFormModal open onClose={() => setEditing(null)} initial={editing} />}
      <ConfirmDeleteModal
        open={Boolean(deleting)}
        entityLabel={CUSTOMER_UI.label}
        itemName={deleting ? `${deleting.code} — ${deleting.name}` : ""}
        loading={busy}
        onCancel={() => setDeleting(null)}
        onConfirm={remove}
      />
    </>
  );
}
