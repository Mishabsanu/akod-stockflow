import { StockUpdatePage } from "@/components/inventory/InventoryPages";

export const metadata = { title: "Stock Update" };

export default function Page({ searchParams }: PageProps<"/dashboard/inventory/update">) {
  return <StockUpdatePage searchParams={searchParams} />;
}
