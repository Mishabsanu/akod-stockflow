import { ClipboardList, History, Plus } from "lucide-react";
import Link from "next/link";
import { DateRangeFilter } from "@/components/inventory/DateRangeFilter";
import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatDateTime, formatNumber } from "@/lib/format";
import { formatDay } from "@/lib/indiaDate";
import { MR_PRIORITY_LABELS, MR_STATUS_LABELS } from "@/lib/materialRequestTypes";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { getMaterialRequest, listMaterialRequests, MR_FILTERS } from "@/server/services/materialRequest.service";
import { listSellableProducts } from "@/server/services/product.service";
import { orNotFound } from "@/server/utils/pageData";
import { MrActions } from "./MrActions";
import { MrForm } from "./MrForm";
import { MrListView } from "./MrListView";
import { MR_UI, MrStatusBadge } from "./mrUi";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type IdParams = Promise<{ id: string }>;

const addBtn =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-lg bg-brand hover:bg-brand-dark text-white transition";

export async function MrListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("material_request", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listMaterialRequests(parseListQuery(await searchParams, MR_FILTERS), user);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Material Requests"
        description="Requests to restock products: raised by anyone, approved, then received into stock"
        actions={
          <>
            <ImportExport entity="material-requests" title="Material Requests" />
            {can(user, "material_request", "create") && (
              <Link href={`${MR_UI.basePath}/new`} className={addBtn}>
                <Plus className="w-4 h-4" />
                New Request
              </Link>
            )}
          </>
        }
      />
      <DateRangeFilter />
      <MrListView data={data} />
    </div>
  );
}

export async function MrCreatePage() {
  const { allowed } = await getPageAccess("material_request", "create");
  if (!allowed) return <AccessDenied />;
  return <MrForm products={await listSellableProducts()} />;
}

export async function MrEditPage({ params }: { params: IdParams }) {
  const { allowed } = await getPageAccess("material_request", "create");
  if (!allowed) return <AccessDenied />;
  const [mr, products] = await Promise.all([orNotFound(getMaterialRequest((await params).id)), listSellableProducts()]);
  if (mr.status !== "PENDING") return <AccessDenied title="Cannot edit" message="Only pending requests can be changed." />;
  return <MrForm initial={mr} products={products} />;
}

export async function MrDetailPage({ params }: { params: IdParams }) {
  const { allowed } = await getPageAccess("material_request", "view");
  if (!allowed) return <AccessDenied />;
  const mr = await orNotFound(getMaterialRequest((await params).id));

  return (
    <div className="space-y-4">
      <DetailCard
        title={mr.mrNo}
        subtitle={`Requested by ${mr.requestedByName} on ${formatDay(mr.requestDate)}`}
        badge={<MrStatusBadge status={mr.status} />}
        icon={<ClipboardList className="w-4.5 h-4.5" />}
        backHref={MR_UI.basePath}
      >
        <div className="flex justify-end -mt-1 mb-3">
          <MrActions mr={mr} />
        </div>
        <DetailSection title="Request">
          <DetailItem label="Requested By" value={mr.requestedByName} />
          <DetailItem label="Request Date" value={formatDay(mr.requestDate)} />
          <DetailItem label="Priority" value={MR_PRIORITY_LABELS[mr.priority ?? "MEDIUM"]} />
          <DetailItem label="Required By" value={mr.requiredBy ? formatDay(mr.requiredBy) : "—"} />
          <DetailItem label="Status" value={MR_STATUS_LABELS[mr.status]} />
          <DetailItem label="Approved By" value={mr.approvedByName ? `${mr.approvedByName} · ${formatDateTime(mr.approvedAt)}` : "—"} />
          {mr.rejectReason && <DetailItem label="Reject Reason" value={mr.rejectReason} />}
          {mr.notes && <DetailItem label="Notes" value={mr.notes} />}
        </DetailSection>
      </DetailCard>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Products</h2>
          <span className="text-xs text-slate-500">
            {formatNumber(mr.receivedQty)} of {formatNumber(mr.totalQty)} received
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 text-[10.5px] uppercase tracking-wider text-slate-500">
              <tr>
                <th className="text-left px-4 py-2">Product</th>
                <th className="text-right px-4 py-2">Required</th>
                <th className="text-right px-4 py-2">Received</th>
                <th className="text-right px-4 py-2">Remaining</th>
                <th className="text-right px-4 py-2">In Stock Now</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mr.items.map((i) => (
                <tr key={i.product}>
                  <td className="px-4 py-2.5">
                    <Link href={`/dashboard/products/${i.product}`} className="hover:text-brand">
                      <span className="block font-semibold text-slate-900">{i.name}</span>
                      <span className="font-mono text-[11px] text-slate-500">{i.sku}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-right font-semibold">{formatNumber(i.quantity)}</td>
                  <td className="px-4 py-2.5 text-right text-emerald-700">{formatNumber(i.receivedQty)}</td>
                  <td className="px-4 py-2.5 text-right">{formatNumber(Math.max(i.quantity - i.receivedQty, 0))}</td>
                  <td className="px-4 py-2.5 text-right text-slate-600">{formatNumber(i.stock ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
          <History className="w-4 h-4 text-brand" />
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider">History</h2>
        </div>
        <ul className="divide-y divide-slate-100 text-xs">
          {[...mr.history].reverse().map((h, n) => (
            <li key={n} className="px-4 py-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <MrStatusBadge status={h.status} />
              <span className="text-slate-700">{h.note || "—"}</span>
              <span className="text-slate-400 ml-auto">
                {h.by} · {formatDateTime(h.at)}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
