import { OrderListPage } from "@/components/orders/OrderPages";

export const metadata = { title: "Distributor Orders" };

export default function Page({ searchParams }: PageProps<"/dashboard/orders/distributor">) {
  return <OrderListPage searchParams={searchParams} type="DISTRIBUTOR" />;
}
