import { PaymentListPage } from "@/components/finance/payments/PaymentPages";

export const metadata = { title: "Payments" };

export default function Page({ searchParams }: PageProps<"/dashboard/finance/payments">) {
  return <PaymentListPage searchParams={searchParams} />;
}
