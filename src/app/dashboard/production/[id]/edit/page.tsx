import { ManufacturerEditPage } from "@/components/batchCodes/BatchCodePages";

export const metadata = { title: "Edit Batch Number" };

export default function Page({ params }: PageProps<"/dashboard/production/[id]/edit">) {
  return <ManufacturerEditPage params={params} />;
}
