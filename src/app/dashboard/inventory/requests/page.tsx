import { MrListPage } from "@/components/materialRequests/MrPages";

export const metadata = { title: "Material Requests" };

export default function Page({ searchParams }: PageProps<"/dashboard/inventory/requests">) {
  return <MrListPage searchParams={searchParams} />;
}
