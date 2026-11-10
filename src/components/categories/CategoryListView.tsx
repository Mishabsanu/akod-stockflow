"use client";

import { Edit2, Plus } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ProductThumb } from "@/components/products/ProductImages";
import { usePermission } from "@/components/providers/SessionProvider";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import { STATUS_FILTER, type Column } from "@/components/table/types";
import { StatusBadge } from "@/components/ui/Badge";
import type { Category } from "@/lib/commerceTypes";
import { formatDate, formatNumber } from "@/lib/format";
import type { Paginated } from "@/lib/types";
import { CategoryFormModal } from "./CategoryFormModal";

const iconBtn = "p-1 rounded text-slate-400 hover:text-brand hover:bg-brand-light transition-colors";

export function NewCategoryButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white rounded-lg px-3.5 py-2 font-bold text-xs shadow-xs transition"
      >
        <Plus className="w-4 h-4" />
        New Category
      </button>
      <CategoryFormModal category={open ? "new" : null} onClose={() => setOpen(false)} />
    </>
  );
}

export function CategoryListView({ data }: { data: Paginated<Category> }) {
  const canEdit = usePermission("category", "update");
  const canDelete = usePermission("category", "delete");
  const canSeeProducts = usePermission("product", "view");
  const [editing, setEditing] = useState<Category | null>(null);

  const columns = useMemo<Column<Category>[]>(
    () => [
      {
        key: "name",
        label: "Category",
        render: (c) => (
          <span className="inline-flex items-center gap-2.5">
            <ProductThumb image={c.image} size={34} />
            <span className="font-semibold text-slate-900">{c.name}</span>
          </span>
        ),
      },
      { key: "description", label: "Description", render: (c) => <span className="whitespace-normal">{c.description || "—"}</span> },
      {
        key: "productCount",
        label: "Products",
        align: "right",
        render: (c) =>
          canSeeProducts && (c.productCount ?? 0) > 0 ? (
            <Link href={`/dashboard/products?category=${encodeURIComponent(c.name)}`} className="font-bold text-brand hover:underline">
              {formatNumber(c.productCount ?? 0)}
            </Link>
          ) : (
            <span className="font-bold text-slate-900">{formatNumber(c.productCount ?? 0)}</span>
          ),
      },
      { key: "createdAt", label: "Created", hiddenByDefault: true, render: (c) => (c.createdAt ? formatDate(c.createdAt) : "—") },
      { key: "status", label: "Status", align: "center", render: (c) => <StatusBadge status={c.status} /> },
    ],
    [canSeeProducts]
  );

  return (
    <>
      <DataTable
        data={data}
        columns={columns}
        itemName="categories"
        searchPlaceholder="Search by name or description..."
        filters={[STATUS_FILTER]}
        rowActions={(c) => (
          <div className="flex items-center justify-center gap-1.5">
            {canEdit && (
              <button type="button" title="Edit" className={iconBtn} onClick={() => setEditing(c)}>
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && <RowActions entityLabel="Category" itemName={c.name} deleteUrl={`/api/categories/${c._id}`} />}
          </div>
        )}
      />
      <CategoryFormModal category={editing} onClose={() => setEditing(null)} />
    </>
  );
}
