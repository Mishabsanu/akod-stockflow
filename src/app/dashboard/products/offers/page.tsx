import { OfferListPage } from "@/components/offers/OfferPages";

export const metadata = { title: "Offers" };

export default function Page({ searchParams }: PageProps<"/dashboard/products/offers">) {
  return <OfferListPage searchParams={searchParams} />;
}
