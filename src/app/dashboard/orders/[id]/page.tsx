import { OrderDetailPage } from "@/components/orders/OrderPages";

export const metadata = { title: "Order" };

export default function Page({ params }: PageProps<"/dashboard/orders/[id]">) {
  return <OrderDetailPage params={params} />;
}
