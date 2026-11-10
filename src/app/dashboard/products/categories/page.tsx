import { CategoryListPage } from "@/components/categories/CategoryPages";

export const metadata = { title: "Categories" };

export default function Page({ searchParams }: PageProps<"/dashboard/products/categories">) {
  return <CategoryListPage searchParams={searchParams} />;
}
