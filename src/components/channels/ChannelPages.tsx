import { ArrowLeft, Store } from "lucide-react";
import Link from "next/link";
import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { StatusBadge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatNumber } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { CHANNEL_PRODUCT_FILTERS, getChannel, listChannelProducts, listChannels } from "@/server/services/channel.service";
import { listCategories } from "@/server/services/product.service";
import { orNotFound } from "@/server/utils/pageData";
import { ChannelDetailActions } from "./ChannelDetailActions";
import { ChannelListView, NewChannelButton } from "./ChannelListView";
import { ChannelProductListView } from "./ChannelProductListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ id: string }>;

export async function ChannelListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("channel", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listChannels(parseListQuery(await searchParams));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketplaces"
        description="Create the channels you sell on and assign products to each — marketplace orders only show that channel's products"
        actions={
          <>
            <ImportExport entity="channels" title="Marketplaces" />
            {can(user, "channel", "create") && <NewChannelButton />}
          </>
        }
      />
      <ChannelListView data={data} />
    </div>
  );
}

export async function ChannelDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("channel", "view");
  if (!allowed) return <AccessDenied />;
  const id = (await params).id;
  const channel = await orNotFound(getChannel(id));
  const [data, categories] = await Promise.all([
    listChannelProducts(id, parseListQuery(await searchParams, CHANNEL_PRODUCT_FILTERS)),
    listCategories(),
  ]);
  const canEdit = can(user, "channel", "update");

  return (
    <div className="space-y-4">
      <div className="bg-white border border-line rounded-xl px-4 sm:px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Link href="/dashboard/channels" title="Back to marketplaces" className="p-2 rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200 transition shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-lg bg-brand-light border border-brand-border text-brand flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-bold text-slate-900 truncate">{channel.name}</h1>
              <span className="font-mono text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                {channel.code}
              </span>
              <StatusBadge status={channel.status} />
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {formatNumber(channel.productCount ?? 0)} product(s) assigned{channel.description ? ` · ${channel.description}` : ""}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ImportExport
            entity="channel-products"
            title={`${channel.name} Products`}
            canImport={canEdit}
            params={{ channel: channel._id }}
            importHint="Rows are matched by SKU Code: new SKUs are assigned to this marketplace, existing listings get the marketplace SKU / price."
          />
          {canEdit && <ChannelDetailActions channel={channel} />}
        </div>
      </div>
      {channel.status === "inactive" && (
        <p className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          This marketplace is inactive — it cannot be chosen for new orders until it is activated.
        </p>
      )}
      <PageHeader title="Assigned Products" description="Only these products can be added to this marketplace's orders" />
      <ChannelProductListView channelId={channel._id} data={data} categories={categories} />
    </div>
  );
}
