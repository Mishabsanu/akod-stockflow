import { ChannelDetailPage } from "@/components/channels/ChannelPages";

export const metadata = { title: "Marketplace" };

export default function Page({ params, searchParams }: PageProps<"/dashboard/channels/[id]">) {
  return <ChannelDetailPage params={params} searchParams={searchParams} />;
}
