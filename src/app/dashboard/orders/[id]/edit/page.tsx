import { OrderEditPage } from "@/components/orders/OrderPages";

export const metadata = { title: "Edit Order" };

export default function Page({ params }: PageProps<"/dashboard/orders/[id]/edit">) {
  return <OrderEditPage params={params} />;
}
