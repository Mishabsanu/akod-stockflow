import { StockTransactionsPage } from "@/components/inventory/InventoryPages";

export const metadata = { title: "Stock Transactions" };

export default function Page({ searchParams }: PageProps<"/dashboard/inventory/transactions">) {
  return <StockTransactionsPage searchParams={searchParams} />;
}
