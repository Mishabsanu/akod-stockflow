import { ProductDetailPage } from "@/components/products/ProductPages";

export const metadata = { title: "Product" };

export default function Page({ params }: PageProps<"/dashboard/products/[id]">) {
  return <ProductDetailPage params={params} />;
}
