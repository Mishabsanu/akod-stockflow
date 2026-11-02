"use client";

import { Form, Formik } from "formik";
import { Edit2, Eye, Tag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { TextField } from "@/components/forms/FormikFields";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { STATUS_FILTER, type Column, type FilterConfig } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmDeleteModal } from "@/components/ui/ConfirmDeleteModal";
import { Modal } from "@/components/ui/Modal";
import type { ChannelProduct } from "@/lib/commerceTypes";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { channelProductSchema, type ChannelProductInput } from "@/lib/validation/channel.schema";
import { apiRequest, ApiError } from "@/services/apiClient";

const iconBtn = "p-1 rounded text-slate-400 transition-colors";

function ListingModal({ channelId, row, onClose }: { channelId: string; row: ChannelProduct | null; onClose: () => void }) {
  const router = useRouter();
  if (!row) return null;
  return (
    <Formik<ChannelProductInput>
      initialValues={{ channelSku: row.channelSku ?? "", channelPrice: row.channelPrice, allocatedQty: row.allocatedQty }}
      validationSchema={channelProductSchema}
      onSubmit={async (values, helpers) => {
        try {
          await apiRequest(`/api/channels/${channelId}/products/${row._id}`, "PUT", values);
          toast.success("Listing updated");
          onClose();
          router.refresh();
        } catch (e) {
          if (e instanceof ApiError && e.fieldErrors) helpers.setErrors(e.fieldErrors as never);
          toast.error(e instanceof ApiError ? e.message : "Could not save");
        } finally {
          helpers.setSubmitting(false);
        }
      }}
    >
      {({ isSubmitting, submitForm }) => (
        <Modal
          open
          onClose={onClose}
          title="Marketplace Listing"
          subtitle={`${row.product.sku} — ${row.product.name}`}
          icon={<Tag className="w-4 h-4" />}
          size="sm"
          footer={
            <>
              <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button onClick={submitForm} loading={isSubmitting}>
                Save
              </Button>
            </>
          }
        >
          <Form noValidate className="grid grid-cols-1 gap-4">
            <TextField name="channelSku" label="Marketplace SKU / Listing ID" placeholder="e.g. ASIN B0XXXXXXX (optional)" />
            <TextField
              name="channelPrice"
              label="Marketplace Price (₹)"
              type="number"
              min={0}
              step="0.01"
              inputMode="decimal"
              hint={`0 = selling price ${formatCurrency(row.product.sellingPrice)}`}
            />
            <TextField
              name="allocatedQty"
              label="Assigned Qty"
              type="number"
              min={row.soldQty}
              step={1}
              inputMode="numeric"
              placeholder="No limit"
              hint={`Most this marketplace may sell. Sold here: ${formatNumber(row.soldQty)} · in stock: ${formatNumber(row.stock ?? 0)}. Leave blank for no limit.`}
            />
          </Form>
        </Modal>
      )}
    </Formik>
  );
}

export function ChannelProductListView({ channelId, data, categories }: { channelId: string; data: Paginated<ChannelProduct>; categories: string[] }) {
  const router = useRouter();
  const canEdit = usePermission("channel", "update");
  const [editing, setEditing] = useState<ChannelProduct | null>(null);
  const [removing, setRemoving] = useState<ChannelProduct | null>(null);
  const [busy, setBusy] = useState(false);

  const remove = async () => {
    if (!removing) return;
    setBusy(true);
    try {
      await apiRequest(`/api/channels/${channelId}/products/${removing._id}`, "DELETE");
      toast.success(`${removing.product.sku} removed from this marketplace`);
      setRemoving(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not remove");
    } finally {
      setBusy(false);
    }
  };

  const columns = useMemo<Column<ChannelProduct>[]>(
    () => [
      {
        key: "product",
        label: "Product",
        render: (r) => (
          <span className="inline-flex flex-col">
            <span className="font-semibold text-slate-900 whitespace-normal">{r.product.name}</span>
            <span className="font-mono text-[11px] text-slate-500">{r.product.sku}</span>
          </span>
        ),
      },
      { key: "category", label: "Category", render: (r) => r.product.category || "—" },
      { key: "channelSku", label: "Marketplace SKU", mono: true, render: (r) => r.channelSku || "—" },
      {
        key: "price",
        label: "Price Here",
        align: "right",
        render: (r) =>
          r.channelPrice ? (
            <span className="font-semibold">{formatCurrency(r.channelPrice)}</span>
          ) : (
            <span className="text-slate-500" title="Uses the product selling price">
              {formatCurrency(r.product.sellingPrice)}
            </span>
          ),
      },
      {
        key: "allocatedQty",
        label: "Assigned",
        align: "right",
        render: (r) => (r.allocatedQty === null ? <span className="text-slate-400" title="No limit">No limit</span> : <b>{formatNumber(r.allocatedQty)}</b>),
      },
      { key: "soldQty", label: "Sold", align: "right", render: (r) => formatNumber(r.soldQty) },
      {
        key: "remainingQty",
        label: "Remaining",
        align: "right",
        render: (r) =>
          r.remainingQty === null ? (
            <span className="text-slate-400">—</span>
          ) : (
            <span className={`font-bold ${r.remainingQty === 0 ? "text-rose-600" : r.remainingQty <= 5 ? "text-amber-600" : "text-emerald-700"}`}>
              {formatNumber(r.remainingQty)}
            </span>
          ),
      },
      {
        key: "stock",
        label: "Central Stock",
        align: "right",
        render: (r) => <span className={`font-bold ${(r.stock ?? 0) > 0 ? "text-slate-900" : "text-rose-600"}`}>{formatNumber(r.stock ?? 0)}</span>,
      },
      { key: "status", label: "Product Status", align: "center", render: (r) => <StatusBadge status={r.product.status} /> },
    ],
    []
  );

  const filters = useMemo<FilterConfig[]>(
    () => [
      { key: "category", allLabel: "All Categories", minWidth: "160px", options: categories.map((c) => ({ label: c, value: c })) },
      { ...STATUS_FILTER, allLabel: "All Products" },
    ],
    [categories]
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName="assigned products"
        searchPlaceholder="Search assigned products by SKU, name, marketplace SKU..."
        filters={filters}
        rowActions={(r) => (
          <div className="flex items-center justify-center gap-1.5">
            <Link href={`/dashboard/products/${r.product._id}`} title="View product" className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
              <Eye className="w-3.5 h-3.5" />
            </Link>
            {canEdit && (
              <>
                <button type="button" title="Edit listing" onClick={() => setEditing(r)} className={`${iconBtn} hover:text-brand hover:bg-brand-light`}>
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button type="button" title="Remove from marketplace" onClick={() => setRemoving(r)} className={`${iconBtn} hover:text-red-600 hover:bg-red-50`}>
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      />
      <ListingModal channelId={channelId} row={editing} onClose={() => setEditing(null)} />
      <ConfirmDeleteModal
        open={Boolean(removing)}
        entityLabel="Listing"
        itemName={removing ? `${removing.product.sku} — ${removing.product.name}` : ""}
        loading={busy}
        onCancel={() => setRemoving(null)}
        onConfirm={remove}
      />
    </>
  );
}
