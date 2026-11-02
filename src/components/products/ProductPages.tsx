import { Package } from "lucide-react";
import Link from "next/link";
import { ImportExport } from "@/components/io/ImportExport";
import { StockActionButtons } from "@/components/inventory/StockActionButtons";
import { StockLevelBadge, stockLevel } from "@/components/inventory/StockLevelBadge";
import { StockTxnMiniTable } from "@/components/inventory/StockTxnBits";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { AddLink } from "@/components/ui/AddLink";
import { StatusBadge } from "@/components/ui/Badge";
import { DetailCard, DetailItem, DetailSection } from "@/components/ui/DetailCard";
import { PageHeader } from "@/components/ui/PageHeader";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import { channelsForProduct } from "@/server/services/channel.service";
import { recentTransactionsFor } from "@/server/services/inventory.service";
import { getProduct, listCategories, listProducts } from "@/server/services/product.service";
import { orNotFound } from "@/server/utils/pageData";
import { getCompanySettings } from "@/server/services/setting.service";
import { ProductForm } from "./ProductForm";
import { ProductListView } from "./ProductListView";
import { PRODUCT_UI } from "./productConfig";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type Params = Promise<{ id: string }>;

export async function ProductListPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("product", "view");
  if (!allowed) return <AccessDenied />;
  const [data, categories] = await Promise.all([listProducts(parseListQuery(await searchParams, ["category"])), listCategories()]);

  return (
    <div className="space-y-4">
      <PageHeader
        title={PRODUCT_UI.plural}
        description={PRODUCT_UI.description}
        actions={
          <>
            <ImportExport
              entity="products"
              title="Products"
              canImport={can(user, "product", "create") && can(user, "product", "update")}
              importHint="Rows are matched by SKU Code: existing SKUs are updated, new SKUs are created."
            />
            {can(user, "product", "create") && <AddLink href={`${PRODUCT_UI.basePath}/new`} label="Add Product" />}
          </>
        }
      />
      <ProductListView data={data} categories={categories} />
    </div>
  );
}

export async function ProductCreatePage() {
  const { allowed } = await getPageAccess("product", "create");
  if (!allowed) return <AccessDenied />;
  const [categories, settings] = await Promise.all([listCategories(), getCompanySettings()]);
  return <ProductForm categories={categories} defaultReorderLevel={settings.defaultReorderLevel} />;
}

export async function ProductEditPage({ params }: { params: Params }) {
  const { allowed } = await getPageAccess("product", "update");
  if (!allowed) return <AccessDenied />;
  const [product, categories] = await Promise.all([orNotFound(getProduct((await params).id)), listCategories()]);
  return <ProductForm initial={product} categories={categories} />;
}

export async function ProductDetailPage({ params }: { params: Params }) {
  const { user, allowed } = await getPageAccess("product", "view");
  if (!allowed) return <AccessDenied />;
  const id = (await params).id;
  const product = await orNotFound(getProduct(id));
  const canStock = can(user, "stock", "view");
  const [txns, channels] = await Promise.all([canStock ? recentTransactionsFor(id, 10) : [], channelsForProduct(id)]);
  const stock = product.stock ?? 0;
  const margin = product.sellingPrice - product.costPrice;

  return (
    <div className="space-y-4">
      <DetailCard
        title={product.name}
        subtitle={product.sku}
        badge={<StatusBadge status={product.status} />}
        icon={<Package className="w-4.5 h-4.5" />}
        backHref={PRODUCT_UI.basePath}
        editHref={can(user, "product", "update") ? `${PRODUCT_UI.basePath}/${product._id}/edit` : undefined}
      >
        <DetailSection title="Stock">
          <DetailItem label="Available Stock" value={<span className="text-base font-black text-slate-900">{formatNumber(stock)}</span>} />
          <DetailItem label="Stock Level" value={<StockLevelBadge level={stockLevel(stock, product.reorderLevel)} />} />
          <DetailItem label="Reorder Level" value={formatNumber(product.reorderLevel)} />
          <DetailItem label="Stock Value (at cost)" value={formatCurrency(stock * product.costPrice)} />
        </DetailSection>

        <DetailSection title="Product Details">
          <DetailItem label="SKU Code" value={product.sku} mono />
          <DetailItem label="Name" value={product.name} />
          <DetailItem label="Category" value={product.category} />
          <DetailItem label="Barcode" value={product.barcode} mono />
          <DetailItem label="Description" value={product.description} />
        </DetailSection>

        <DetailSection title="Pricing">
          <DetailItem label="Selling Price" value={formatCurrency(product.sellingPrice)} />
          <DetailItem label="Cost Price" value={formatCurrency(product.costPrice)} />
          <DetailItem
            label="Margin"
            value={`${formatCurrency(margin)}${product.sellingPrice > 0 ? ` (${((margin / product.sellingPrice) * 100).toFixed(1)}%)` : ""}`}
          />
        </DetailSection>

        <DetailSection title={`Marketplaces (${channels.length})`}>
          {channels.length === 0 ? (
            <p className="text-xs text-slate-500">Not assigned to any marketplace yet — assign it from Channels.</p>
          ) : (
            channels.map((c) => (
              <DetailItem
                key={c._id}
                label={c.code}
                value={
                  <Link href={`/dashboard/channels/${c._id}`} className="text-brand hover:underline">
                    {c.name}
                    {c.channelPrice ? ` · ${formatCurrency(c.channelPrice)}` : ""}
                    {c.channelSku ? ` · ${c.channelSku}` : ""}
                    {c.status === "inactive" ? " (inactive)" : ""}
                  </Link>
                }
              />
            ))
          )}
        </DetailSection>

        <DetailSection title="Audit">
          <DetailItem label="Created" value={formatDateTime(product.createdAt)} />
          <DetailItem label="Last Updated" value={formatDateTime(product.updatedAt)} />
        </DetailSection>
      </DetailCard>

      {canStock && (
        <section className="bg-white border border-line rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Recent Stock Movements</h2>
            <div className="flex flex-wrap items-center gap-2">
              <StockActionButtons
                target={{ _id: product._id, sku: product.sku, name: product.name, quantity: stock }}
                disabledAdd={product.status !== "active"}
              />
              <Link
                href={`/dashboard/inventory/transactions?product=${product._id}`}
                className="text-xs font-bold text-brand hover:underline px-1"
              >
                View all
              </Link>
            </div>
          </div>
          <StockTxnMiniTable rows={txns} />
        </section>
      )}
    </div>
  );
}
