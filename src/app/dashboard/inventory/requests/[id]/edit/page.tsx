import { MrEditPage } from "@/components/materialRequests/MrPages";

export const metadata = { title: "Edit Material Request" };

export default function Page({ params }: PageProps<"/dashboard/inventory/requests/[id]/edit">) {
  return <MrEditPage params={params} />;
}
