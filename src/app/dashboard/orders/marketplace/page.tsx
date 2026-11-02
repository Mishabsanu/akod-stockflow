import { OrderListPage } from "@/components/orders/OrderPages";

export const metadata = { title: "Marketplace Orders" };

export default function Page({ searchParams }: PageProps<"/dashboard/orders/marketplace">) {
  return <OrderListPage searchParams={searchParams} type="MARKETPLACE" />;
}
