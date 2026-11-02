"use client";

import Link from "next/link";
import { useMemo } from "react";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig } from "@/components/table/types";
import { formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { MR_PRIORITIES, MR_PRIORITY_LABELS, MR_STATUS_LABELS, MR_STATUSES, type MaterialRequest } from "@/lib/materialRequestTypes";
import type { Paginated } from "@/lib/types";
import { MR_UI, MrPriorityBadge, MrStatusBadge } from "./mrUi";

const FILTERS: FilterConfig[] = [
  {
    key: "mrStatus",
    allLabel: "All Statuses",
    minWidth: "170px",
    options: [{ value: "OPEN", label: "Open (not finished)" }, ...MR_STATUSES.map((s) => ({ value: s, label: MR_STATUS_LABELS[s] }))],
  },
  { key: "priority", allLabel: "All Priorities", minWidth: "150px", options: MR_PRIORITIES.map((p) => ({ value: p, label: MR_PRIORITY_LABELS[p] })) },
  { key: "mine", allLabel: "Everyone's requests", minWidth: "170px", options: [{ value: "1", label: "My requests" }] },
  {
    key: "sort",
    allLabel: "Newest first",
    minWidth: "150px",
    options: [
      { value: "oldest", label: "Oldest first" },
      { value: "requiredBy", label: "By required date" },
      { value: "priority", label: "High priority first" },
    ],
  },
];

export function MrListView({ data }: { data: Paginated<MaterialRequest> }) {
  const columns = useMemo<Column<MaterialRequest>[]>(
    () => [
      {
        key: "mrNo",
        label: "MR No",
        mono: true,
        render: (r) => (
          <Link href={`${MR_UI.basePath}/${r._id}`} className="font-semibold text-brand hover:underline">
            {r.mrNo}
          </Link>
        ),
      },
      { key: "priority", label: "Top Priority", align: "center", render: (r) => <MrPriorityBadge priority={r.priority ?? "MEDIUM"} /> },
      { key: "requestDate", label: "Request Date", render: (r) => formatDay(r.requestDate) },
      { key: "requiredBy", label: "Required By", render: (r) => (r.requiredBy ? formatDay(r.requiredBy) : "—") },
      { key: "requestedByName", label: "Requested By", render: (r) => <span className="font-semibold">{r.requestedByName}</span> },
      {
        key: "items",
        label: "Products",
        render: (r) => (
          <span className="whitespace-normal text-slate-700">
            {r.items
              .slice(0, 3)
              .map((i) => `${i.sku} × ${formatNumber(i.quantity)}`)
              .join(", ")}
            {r.items.length > 3 && <span className="text-slate-400"> +{r.items.length - 3} more</span>}
          </span>
        ),
      },
      { key: "totalQty", label: "Qty", align: "right", render: (r) => formatNumber(r.totalQty) },
      {
        key: "receivedQty",
        label: "Received",
        align: "right",
        render: (r) => (r.receivedQty ? `${formatNumber(r.receivedQty)} / ${formatNumber(r.totalQty)}` : "—"),
      },
      { key: "status", label: "Status", align: "center", render: (r) => <MrStatusBadge status={r.status} /> },
    ],
    []
  );

  return (
    <DataTable
      data={data}
      columns={columns}
      itemName="material requests"
      searchPlaceholder="Search MR no, requester, SKU or product..."
      filters={FILTERS}
      rowActions={(r) => (
        <Link href={`${MR_UI.basePath}/${r._id}`} className="text-xs font-bold text-brand hover:underline">
          Open
        </Link>
      )}
    />
  );
}
