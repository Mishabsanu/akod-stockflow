import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import * as Yup from "yup";
import { todayIST } from "@/lib/indiaDate";
import { connectDB } from "@/server/db";
import { AppError, errorResponse } from "@/server/http/errors";
import { createWebsiteOrder } from "@/server/services/order.service";
import { getStorefrontCatalog } from "@/server/services/storefront.service";
import { storeChannel } from "@/server/storefront/channel";

/** Same rule as the store's cart. */
const FREE_DELIVERY_ABOVE = 499;
const DELIVERY_FEE = 60;

const text = (max: number) => Yup.string().trim().max(max).default("");

const schema = Yup.object({
  items: Yup.array(
    Yup.object({
      id: Yup.string().matches(/^[a-f0-9]{24}$/i).required(),
      qty: Yup.number().integer().min(1).max(99).required(),
    })
  )
    .min(1)
    .max(30)
    .required(),
  customer: Yup.object({
    name: text(150).min(2).required(),
    phone: Yup.string().trim().matches(/^[6-9]\d{9}$/, "Enter a 10-digit mobile number").required(),
    address: text(300).min(4).required(),
    landmark: text(120),
    city: text(80).min(2).required(),
    district: text(80).min(2).required(),
    state: text(60).required(),
    pincode: Yup.string().trim().matches(/^[1-9]\d{5}$/, "Enter a 6-digit PIN code").required(),
    note: text(500),
  }).required(),
});

function keyOk(req: NextRequest): boolean {
  const expected = process.env.STOREFRONT_API_KEY;
  if (!expected) return true;
  const a = Buffer.from(req.headers.get("x-storefront-key") ?? "");
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Light per-IP limit so the endpoint cannot be flooded (best effort per server instance). */
const recent = new Map<string, number[]>();
function tooMany(ip: string) {
  const now = Date.now();
  const list = (recent.get(ip) ?? []).filter((t) => now - t < 10 * 60 * 1000);
  list.push(now);
  recent.set(ip, list);
  return list.length > 8;
}

/**
 * POST — an order sent from the online store's cart. Prices come from the live AKOD IN catalog
 * (never from the browser); the order is saved as a PENDING marketplace order for AKOD IN.
 */
export async function POST(req: NextRequest) {
  try {
    if (!keyOk(req)) return NextResponse.json({ error: "Invalid storefront key" }, { status: 401 });
    const ip = req.headers.get("x-customer-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (tooMany(ip)) return NextResponse.json({ error: "Too many orders, please try again in a few minutes" }, { status: 429 });

    const body = await schema.validate(await req.json(), { abortEarly: true, stripUnknown: true });
    await connectDB();
    const channel = await storeChannel();
    if (!channel || channel.status !== "active") throw new AppError("The online store is not taking orders right now", 503);

    // Price every line from the store's own catalog
    const catalog = await getStorefrontCatalog();
    const sellable = new Map<string, { name: string; price: number; inStock: boolean }>();
    for (const p of catalog.products) {
      if (p.variants.length) for (const v of p.variants) sellable.set(v.id, { name: `${p.name} (${v.name})`, price: v.price, inStock: v.inStock });
      else sellable.set(p.id, { name: p.name, price: p.price, inStock: p.inStock });
    }
    const merged = new Map<string, number>();
    for (const i of body.items) merged.set(i.id, Math.min(99, (merged.get(i.id) ?? 0) + i.qty));
    const lines = [...merged].map(([id, qty]) => {
      const s = sellable.get(id);
      if (!s) throw new AppError("A product in your cart is no longer sold on the store. Please remove it and try again.", 422);
      return { product: id, quantity: qty, price: s.price };
    });
    const subtotal = lines.reduce((t, l) => t + l.price * l.quantity, 0);
    const shipping = subtotal >= FREE_DELIVERY_ABOVE ? 0 : DELIVERY_FEE;

    const c = body.customer;
    const address = [c.address, c.landmark && `Landmark: ${c.landmark}`, `${c.city}, ${c.district}`, `${c.state} – ${c.pincode}`]
      .filter(Boolean)
      .join(", ");

    const order = await createWebsiteOrder(
      {
        orderType: "MARKETPLACE",
        channel: String(channel._id),
        orderReference: "Website (www.akod.in)",
        customer: "",
        customerName: c.name,
        customerPhone: c.phone,
        customerAddress: address.slice(0, 500),
        orderDate: todayIST(),
        dueDate: "",
        items: lines,
        discount: 0,
        shipping,
        taxPercent: 0,
        upfrontPayment: 0,
        upfrontPaymentMethod: "",
        upfrontPaymentRef: "",
        notes: [`Ordered on www.akod.in · sent on WhatsApp`, c.note && `Customer note: ${c.note}`].filter(Boolean).join("\n"),
        confirm: false,
      },
      "Website (AKOD IN)"
    );
    return NextResponse.json({ orderNo: order.orderNo, subtotal, shipping, total: subtotal + shipping });
  } catch (error) {
    return errorResponse(error);
  }
}
