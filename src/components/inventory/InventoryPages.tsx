import { X } from "lucide-react";
import Link from "next/link";
import { ImportExport } from "@/components/io/ImportExport";
import { AccessDenied } from "@/components/ui/AccessDenied";
import { PageHeader } from "@/components/ui/PageHeader";
import { can } from "@/lib/permissions";
import { getPageAccess } from "@/server/auth/session";
import { parseListQuery } from "@/server/http/query";
import {
  INVENTORY_FILTERS,
  inventorySummary,
  listInventory,
  listStockTransactions,
  TXN_FILTERS,
} from "@/server/services/inventory.service";
import { getProduct, listCategories, listSellableProducts } from "@/server/services/product.service";
import { DateRangeFilter } from "./DateRangeFilter";
import { InventoryListView } from "./InventoryListView";
import { InventorySummaryCards } from "./InventorySummaryCards";
import { StockInForm } from "./StockInForm";
import { StockTxnMiniTable } from "./StockTxnBits";
import { TransactionListView } from "./TransactionListView";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

const linkBtn =
  "inline-flex items-center justify-center gap-1.5 h-9 px-3.5 text-xs font-bold rounded-lg bg-brand hover:bg-brand-dark text-white transition";

export async function StockOverviewPage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("stock", "view");
  if (!allowed) return <AccessDenied />;
  const [data, summary, categories] = await Promise.all([
    listInventory(parseListQuery(await searchParams, INVENTORY_FILTERS)),
    inventorySummary(),
    listCategories(),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Overview"
        description="Central stock shared by marketplace, local and distributor orders"
        actions={
          <>
            <ImportExport entity="inventory" title="Inventory" />
            {can(user, "stock", "create") && (
              <Link href="/dashboard/inventory/update" className={linkBtn}>
                Stock Update
              </Link>
            )}
          </>
        }
      />
      <InventorySummaryCards summary={summary} />
      <InventoryListView data={data} categories={categories} />
    </div>
  );
}

export async function LowStockPage({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getPageAccess("stock", "view");
  if (!allowed) return <AccessDenied />;
  const query = parseListQuery(await searchParams, INVENTORY_FILTERS);
  query.filters.level = "ALERT";
  if (!query.status) query.status = "active";
  const [data, categories] = await Promise.all([listInventory(query), listCategories()]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Low Stock Alerts"
        description="Active products at or below their reorder level (out of stock first) — restock these soon"
        actions={<ImportExport entity="inventory" title="Low Stock" params={{ level: "ALERT", status: query.status }} />}
      />
      <InventoryListView data={data} categories={categories} alertsOnly />
    </div>
  );
}

export async function StockUpdatePage({ searchParams }: { searchParams: SearchParams }) {
  const { user, allowed } = await getPageAccess("stock", "create");
  if (!allowed) return <AccessDenied />;
  const sp = await searchParams;
  const [products, recent] = await Promise.all([
    listSellableProducts(),
    listStockTransactions({ page: 1, limit: 10, search: "", status: "", sort: "newest", filters: { type: "STOCK_IN" } }),
  ]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Update"
        description="Add stock manually, or upload a CSV with SKU Code, Quantity, PO Number (optional) and Date"
        actions={
          <ImportExport
            entity="stock-upload"
            title="Stock Update"
            canImport={can(user, "stock", "create")}
            showExport={false}
            importLabel="Upload CSV"
            importHint="Rows are matched by SKU Code; the quantity is added to current stock. The preview shows previous → updated stock."
          />
        }
      />
      <StockInForm products={products} preselect={first(sp.product)} />
      <section className="bg-white border border-line rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-bold text-brand uppercase tracking-wider">Recent Stock Updates</h2>
          <Link href="/dashboard/inventory/transactions?type=STOCK_IN" className="text-xs font-bold text-brand hover:underline">
            View all
          </Link>
        </div>
        <StockTxnMiniTable rows={recent.items} />
      </section>
    </div>
  );
}

export async function StockTransactionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { allowed } = await getPageAccess("stock", "view");
  if (!allowed) return <AccessDenied />;
  const query = parseListQuery(await searchParams, TXN_FILTERS);
  const [data, product] = await Promise.all([
    listStockTransactions(query),
    query.filters.product ? getProduct(query.filters.product).catch(() => null) : null,
  ]);
  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock Transactions"
        description="Every stock movement with before and after quantities — stock in, adjustments, orders, cancellations and returns"
        actions={<ImportExport entity="stock-transactions" title="Stock Transactions" />}
      />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DateRangeFilter />
        {product && (
          <Link
            href="/dashboard/inventory/transactions"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-light border border-brand-border text-brand text-xs font-bold"
          >
            {product.sku} — {product.name}
            <X className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
      <TransactionListView data={data} />
    </div>
  );
}
