import { LowStockPage } from "@/components/inventory/InventoryPages";

export const metadata = { title: "Low Stock" };

export default function Page({ searchParams }: PageProps<"/dashboard/inventory/low-stock">) {
  return <LowStockPage searchParams={searchParams} />;
}
