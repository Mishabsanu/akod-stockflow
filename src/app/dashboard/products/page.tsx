import { ProductListPage } from "@/components/products/ProductPages";

export const metadata = { title: "Products" };

export default function Page({ searchParams }: PageProps<"/dashboard/products">) {
  return <ProductListPage searchParams={searchParams} />;
}
