import { StockOverviewPage } from "@/components/inventory/InventoryPages";

export const metadata = { title: "Stock Overview" };

export default function Page({ searchParams }: PageProps<"/dashboard/inventory">) {
  return <StockOverviewPage searchParams={searchParams} />;
}
