import { ProductEditPage } from "@/components/products/ProductPages";

export const metadata = { title: "Edit Product" };

export default function Page({ params }: PageProps<"/dashboard/products/[id]/edit">) {
  return <ProductEditPage params={params} />;
}
