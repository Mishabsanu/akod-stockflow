import { OrderListPage } from "@/components/orders/OrderPages";

export const metadata = { title: "All Orders" };

export default function Page({ searchParams }: PageProps<"/dashboard/orders">) {
  return <OrderListPage searchParams={searchParams} />;
}
