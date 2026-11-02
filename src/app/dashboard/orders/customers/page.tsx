import { CustomerListPage } from "@/components/customers/CustomerPages";

export const metadata = { title: "Customers & Distributors" };

export default function Page({ searchParams }: PageProps<"/dashboard/orders/customers">) {
  return <CustomerListPage searchParams={searchParams} />;
}
