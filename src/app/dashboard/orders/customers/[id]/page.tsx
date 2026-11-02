import { CustomerDetailPage } from "@/components/customers/CustomerPages";

export const metadata = { title: "Contact" };

export default function Page({ params }: PageProps<"/dashboard/orders/customers/[id]">) {
  return <CustomerDetailPage params={params} />;
}
