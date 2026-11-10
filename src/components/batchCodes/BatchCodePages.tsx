import { ArrowLeft, Factory } from "lucide-react";
import Link from "next/link";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { StatusBadge } from "@/components/ui/Badge";
import { DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { getManufacturer, listManufacturers } from "@/server/services/manufacturer.service";
import { orNotFound } from "@/server/utils/pageData";
import { formatDateTime } from "@/lib/format";
import { BatchLookup } from "./BatchLookup";
import { ManufacturerDetailActions } from "./ManufacturerDetailActions";
import { BASE, CodeChips, ManufacturerListView, NewManufacturerButton } from "./ManufacturerListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function ManufacturerListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("production", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listManufacturers(parseListQuery(await searchParams));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Batch Numbers"
        description="Batch number printed on the pack, with the FSSAI licence, company name and address that made it"
        actions={can(user, "production", "create") ? <NewManufacturerButton /> : undefined}
      />
      <ManufacturerListView data={data} />
    </div>
  );
}

export async function BatchLookupPage() {
  const { allowed } = await getPageAccess("production", "view");
  if (!allowed) return <AccessDenied />;
  return (
    <div className="py-4">
      <BatchLookup />
    </div>
  );
}

export async function ManufacturerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await getPageAccess("production", "view");
  if (!allowed) return <AccessDenied />;
  const m = await orNotFound(getManufacturer((await params).id));
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-6 py-4 border-b border-slate-200 flex flex-wrap items-center gap-3">
        <Link href={BASE} title="Back to list" className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="w-9 h-9 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
          <Factory className="w-4.5 h-4.5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-base font-bold text-slate-900">{m.name}</h1>
            <StatusBadge status={m.status} />
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{m.batchCodes.length} batch number(s)</p>
        </div>
        <ManufacturerDetailActions manufacturer={m} />
      </div>
      <div className="p-4 sm:p-6 space-y-5">
        <section className="space-y-2">
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider pb-1.5 border-b border-slate-100">Batch Number</h2>
          <CodeChips codes={m.batchCodes} />
        </section>
        <DetailSection title="Details">
          <DetailItem label="FSSAI Lic. No." value={m.fssaiLicNo} mono />
          <DetailItem label="Company Name" value={m.name} />
          <DetailItem label="Address" value={<span className="whitespace-pre-line">{m.address}</span>} />
        </DetailSection>
        <DetailSection title="Audit">
          <DetailItem label="Created" value={formatDateTime(m.createdAt)} />
          <DetailItem label="Last Updated" value={formatDateTime(m.updatedAt)} />
        </DetailSection>
      </div>
    </div>
  );
}
