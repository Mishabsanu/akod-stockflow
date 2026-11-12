import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { Product } from "@/server/models/Product";
import { listCategoryNames } from "@/server/services/category.service";
import { listOfferPage } from "@/server/services/offer.service";
import { NewOfferButton, OfferListView, type OfferOptions } from "./OfferListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Pickers for the offer form: active categories and top-level products. */
async function offerOptions(): Promise<OfferOptions> {
  const [categories, products] = await Promise.all([
    listCategoryNames({ activeOnly: true }),
    Product.find({ parent: null, status: "active" }).sort({ name: 1 }).select("name sku category").limit(2000).lean(),
  ]);
  return {
    categories,
    products: products.map((p) => ({ id: String(p._id), name: p.name, sku: p.sku, category: p.category ?? "" })),
  };
}

export async function OfferListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("offer", "view");
  if (!allowed) return <AccessDenied />;
  const [data, options] = await Promise.all([listOfferPage(parseListQuery(await searchParams)), offerOptions()]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Offers"
        description="Discounts on the online store — for all products, chosen categories or chosen products, with optional dates"
        actions={can(user, "offer", "create") ? <NewOfferButton options={options} /> : undefined}
      />
      <OfferListView data={data} options={options} />
    </div>
  );
}
