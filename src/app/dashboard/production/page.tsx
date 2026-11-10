import { ManufacturerListPage } from "@/components/batchCodes/BatchCodePages";

export const metadata = { title: "Manufacturers & Batch Codes" };

export default function Page({ searchParams }: PageProps<"/dashboard/production">) {
  return <ManufacturerListPage searchParams={searchParams} />;
}
