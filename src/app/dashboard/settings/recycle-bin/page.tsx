import { RecycleBinListView } from "@/components/recycleBin/RecycleBinListView";
import { PageHeader } from "@/components/ui/PageHeader";
import { requireUser } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listRecycleBin } from "@/server/services/recycleBin.service";

export const metadata = { title: "Recycle Bin" };

/** Everything deleted in the app: restore it, or delete it forever. Each user sees the modules they can view. */
export default async function Page({ searchParams }: PageProps<"/dashboard/settings/recycle-bin">) {
  const user = await requireUser();
  const data = await listRecycleBin(parseListQuery(await searchParams, ["type"]), user);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Recycle Bin"
        description="Deleted records are kept here. Restore brings back the record and anything deleted with it (e.g. an income and its payment)."
      />
      <RecycleBinListView data={data} />
    </div>
  );
}
