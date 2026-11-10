import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { listCategoryPage } from "@/server/services/category.service";
import { CategoryListView, NewCategoryButton } from "./CategoryListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function CategoryListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("category", "view");
  if (!allowed) return <AccessDenied />;
  const data = await listCategoryPage(parseListQuery(await searchParams));
  return (
    <div className="space-y-4">
      <PageHeader
        title="Categories"
        description="Product categories — used on the product form, list filters and reports"
        actions={can(user, "category", "create") ? <NewCategoryButton /> : undefined}
      />
      <CategoryListView data={data} />
    </div>
  );
}
