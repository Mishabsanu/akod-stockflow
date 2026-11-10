import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listManufacturers } from "@/server/services/manufacturer.service";
import { BatchLookup } from "./BatchLookup";
import { ManufacturerListView, NewManufacturerButton } from "./ManufacturerListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function ManufacturerListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("production", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listManufacturers(parseListQuery(await searchParams));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Manufacturers & Batch Codes"
        description="Each manufacturing unit with its FSSAI licence and the batch codes printed on its packs"
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
