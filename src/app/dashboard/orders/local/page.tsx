import { OrderListPage } from "@/components/orders/OrderPages";

export const metadata = { title: "Local Orders" };

export default function Page({ searchParams }: PageProps<"/dashboard/orders/local">) {
  return <OrderListPage searchParams={searchParams} type="LOCAL" />;
}
