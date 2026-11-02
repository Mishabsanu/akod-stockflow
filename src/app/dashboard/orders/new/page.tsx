import { OrderCreatePage } from "@/components/orders/OrderPages";

export const metadata = { title: "New Order" };

export default function Page({ searchParams }: PageProps<"/dashboard/orders/new">) {
  return <OrderCreatePage searchParams={searchParams} />;
}
