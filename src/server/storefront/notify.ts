import "server-only";

/**
 * Tells the online store (akod-food) to drop its cached catalog right away, so product, offer,
 * category and stock changes show on the store within seconds.
 *
 * Needs STOREFRONT_REVALIDATE_URL (e.g. https://www.akod.in/api/revalidate) and
 * STOREFRONT_REVALIDATE_SECRET (same value as REVALIDATE_SECRET on the store). Without them it does nothing
 * and the store falls back to its timed refresh.
 */
export async function notifyStorefront(reason: string): Promise<void> {
  const url = process.env.STOREFRONT_REVALIDATE_URL;
  const secret = process.env.STOREFRONT_REVALIDATE_SECRET;
  if (!url || !secret) return;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "x-revalidate-key": secret },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) console.warn(`[storefront] refresh after ${reason} failed: ${res.status}`);
  } catch (error) {
    console.warn(`[storefront] refresh after ${reason} failed:`, error instanceof Error ? error.message : error);
  }
}

/** API paths whose writes change what the store shows (products, prices, offers, categories, stock). */
const STORE_PATHS = ["/api/products", "/api/categories", "/api/offers", "/api/stock", "/api/inventory", "/api/orders", "/api/recycle-bin", "/api/io"];

export const affectsStorefront = (method: string, pathname: string) =>
  method !== "GET" && method !== "HEAD" && STORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
