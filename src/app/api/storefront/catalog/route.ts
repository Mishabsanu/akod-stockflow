import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { connectDB } from "@/server/db";
import { errorResponse } from "@/server/http/errors";
import { getStorefrontCatalog } from "@/server/services/storefront.service";

/**
 * Public read-only catalog for the online store (akod-food): active categories and
 * storefront-visible products with prices, photos, variants and in-stock flags.
 *
 * If STOREFRONT_API_KEY is set, callers must send it as the `x-storefront-key` header.
 */
function keyOk(req: NextRequest): boolean {
  const expected = process.env.STOREFRONT_API_KEY;
  if (!expected) return true;
  const given = req.headers.get("x-storefront-key") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  try {
    if (!keyOk(req)) return NextResponse.json({ error: "Invalid storefront key" }, { status: 401 });
    await connectDB();
    const catalog = await getStorefrontCatalog();
    return NextResponse.json(catalog, {
      headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=120" },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
