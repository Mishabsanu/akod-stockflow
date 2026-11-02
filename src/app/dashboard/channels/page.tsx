import { ChannelListPage } from "@/components/channels/ChannelPages";

export const metadata = { title: "Marketplaces" };

export default function Page({ searchParams }: PageProps<"/dashboard/channels">) {
  return <ChannelListPage searchParams={searchParams} />;
}
