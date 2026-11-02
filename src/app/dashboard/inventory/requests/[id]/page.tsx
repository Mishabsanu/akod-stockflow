import { MrDetailPage } from "@/components/materialRequests/MrPages";

export const metadata = { title: "Material Request" };

export default function Page({ params }: PageProps<"/dashboard/inventory/requests/[id]">) {
  return <MrDetailPage params={params} />;
}
