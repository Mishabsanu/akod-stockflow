import { ManufacturerDetailPage } from "@/components/batchCodes/BatchCodePages";

export const metadata = { title: "Batch Number" };

export default function Page({ params }: PageProps<"/dashboard/production/[id]">) {
  return <ManufacturerDetailPage params={params} />;
}
