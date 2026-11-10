import "server-only";
import { STOCK_TXN_LABELS, type InventoryRow, type StockTransaction } from "@/lib/commerceTypes";
import { isDay, todayIST } from "@/lib/indiaDate";
import { AppError } from "../http/errors";
import { parseListQuery } from "../http/query";
import { Inventory } from "../models/Inventory";
import { Product } from "../models/Product";
import { allInventory, allStockTransactions, INVENTORY_FILTERS, stockIn, TXN_FILTERS } from "../services/inventory.service";
import type { IoEntity } from "./types";

const LEVEL_LABELS = { IN_STOCK: "In stock", LOW_STOCK: "Low stock", OUT_OF_STOCK: "Out of stock" };

/** Stock Overview export (same filters as the screen). */
export const inventoryIo: IoEntity<InventoryRow> = {
  title: "Inventory",
  module: "stock",
  fileName: "Inventory",
  rows: (params) => allInventory(parseListQuery(params, INVENTORY_FILTERS)),
  columns: [
    { header: "SKU Code", value: (r) => r.product.sku, width: 22 },
    { header: "Product Name", value: (r) => r.product.name, width: 36 },
    { header: "Category", value: (r) => r.product.category || "", width: 18 },
    { header: "Available Stock", value: (r) => r.quantity, width: 15 },
    { header: "Reorder Level", value: (r) => r.product.reorderLevel, width: 14 },
    { header: "Stock Level", value: (r) => LEVEL_LABELS[r.level], width: 14 },
    { header: "Cost Price", value: (r) => r.product.costPrice, width: 12 },
    { header: "Stock Value", value: (r) => r.stockValue, width: 14 },
    { header: "Status", value: (r) => r.product.status, width: 10 },
  ],
};

/** Stock Transaction history export. */
export const stockTransactionsIo: IoEntity<StockTransaction> = {
  title: "Stock Transactions",
  module: "stock",
  fileName: "Stock_Transactions",
  rows: (params) => allStockTransactions(parseListQuery(params, TXN_FILTERS)),
  columns: [
    { header: "Txn No", value: (t) => t.txnNo, width: 14 },
    { header: "Date", value: (t) => t.txnDate, width: 12 },
    { header: "Type", value: (t) => STOCK_TXN_LABELS[t.type], width: 18 },
    { header: "SKU Code", value: (t) => t.product?.sku ?? "", width: 20 },
    { header: "Product Name", value: (t) => t.product?.name ?? "", width: 32 },
    { header: "Change", value: (t) => t.change, width: 10 },
    { header: "Before", value: (t) => t.before, width: 10 },
    { header: "After", value: (t) => t.after, width: 10 },
    { header: "PO Number", value: (t) => t.poNumber || "", width: 16 },
    { header: "Reference", value: (t) => t.reference || "", width: 16 },
    { header: "Reason / Note", value: (t) => t.reason || "", width: 28 },
    { header: "Source", value: (t) => t.source, width: 10 },
    { header: "By", value: (t) => t.createdBy?.name ?? "", width: 18 },
  ],
};

/** 25-12-2026, 25/12/2026, 2026-12-25 or an Excel date → "YYYY-MM-DD". Blank → today. */
function readDay(value: unknown): string {
  if (value === undefined || value === null || String(value).trim() === "") return todayIST();
  const s = String(value).trim();
  if (isDay(s as unknown)) return s;
  const m = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (m) {
    const day = `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    if (isDay(day)) return day;
  }
  if (/^\d{5}$/.test(s)) {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  throw new AppError(`Date "${s}" is not a date — use YYYY-MM-DD or DD-MM-YYYY`);
}

interface UploadRow {
  sku: string;
  quantity: number;
  poNumber: string;
  txnDate: string;
}

/**
 * Stock Update CSV: SKU Code, Quantity, PO Number (optional), Date.
 * Adds the quantity to the product's central stock; the preview shows previous → updated stock.
 */
export const stockUploadIo: IoEntity<UploadRow> = {
  title: "Stock Update",
  module: "stock",
  importNeeds: ["create"],
  fileName: "Stock_Update",
  requiredField: "sku",
  rows: async () => [],
  columns: [
    { header: "SKU Code", field: "sku", value: (r) => r.sku, width: 22, aliases: ["sku", "skucode"] },
    { header: "Quantity", field: "quantity", value: (r) => r.quantity, numeric: true, width: 12, aliases: ["qty", "stock"] },
    { header: "PO Number", field: "poNumber", value: (r) => r.poNumber, width: 16, aliases: ["po", "pono", "purchaseorder"] },
    { header: "Date", field: "txnDate", value: (r) => r.txnDate, width: 14, aliases: ["transaction date", "txndate", "txn date"] },
  ],
  async importRow(record, user, ctx) {
    const sku = String(record.sku ?? "").trim().toUpperCase();
    if (!sku) throw new AppError("SKU Code is required");
    const qty = record.quantity;
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < 1) {
      throw new AppError("Quantity must be a whole number of at least 1");
    }
    if (qty > 10000000) throw new AppError("Quantity is too large");
    const txnDate = readDay(record.txnDate);
    const poNumber = String(record.poNumber ?? "").trim().slice(0, 60);

    const product = await Product.findOne({ sku }).select("sku name status hasVariants").lean();
    if (!product) throw new AppError(`SKU ${sku} not found — add the product first`);
    if (product.hasVariants) throw new AppError(`${sku} has variants — use the variant SKU`);
    if (product.status !== "active") throw new AppError(`${sku} is inactive`);

    const po = poNumber ? ` · PO ${poNumber}` : "";
    if (ctx.dryRun) {
      // Running total so the same SKU twice in one file previews correctly
      const key = `stock:${product._id}`;
      const before =
        (ctx.scratch.get(key) as number | undefined) ??
        ((await Inventory.findOne({ product: product._id }).select("quantity").lean())?.quantity ?? 0);
      ctx.scratch.set(key, before + qty);
      return { outcome: "updated", label: sku, detail: `Stock ${before} → ${before + qty} (+${qty})${po}` };
    }
    const res = await stockIn({ product: String(product._id), quantity: qty, poNumber, txnDate, reason: "" }, user, "csv");
    return { outcome: "updated", label: sku, detail: `Stock ${res.before} → ${res.after} (+${qty})${po}` };
  },
};
