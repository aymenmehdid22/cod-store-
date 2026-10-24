import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getServiceSupabase } from "@/lib/supabase";
import { getRequestLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic";

const schema = z.object({
  items: z.array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(10) })).min(1).max(10),
  wilayaCode: z.string().regex(/^\d{2}$/).optional(),
  deliveryType: z.enum(["home", "stopdesk"]).default("home"),
  promoCode: z.string().trim().max(32).optional(),
});

// What the customer will pay (subtotal, discount, shipping, total) — computed by the database with the same
// functions place_order() uses, so the number shown is the number charged.
export async function POST(request: NextRequest) {
  const msg = getDictionary(getRequestLocale(request)).api;
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit("quote:" + ip, 60, 60_000)) return NextResponse.json({ error: msg.tooMany }, { status: 429 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: msg.invalid }, { status: 400 });
  const d = parsed.data;
  const { data, error } = await getServiceSupabase().rpc("quote_order", {
    p_items: d.items.map((i) => ({ product_id: i.productId, variant_id: i.variantId ?? null, quantity: i.quantity })),
    p_wilaya: d.wilayaCode ?? "", p_delivery: d.deliveryType, p_code: d.promoCode ?? null,
  });
  if (error) {
    const m = error.message ?? "";
    if (m.includes("DISCOUNT_INVALID")) return NextResponse.json({ error: msg.discountInvalid, code: "DISCOUNT_INVALID" }, { status: 400 });
    if (m.includes("OUT_OF_STOCK")) return NextResponse.json({ error: msg.outOfStock, code: "OUT_OF_STOCK" }, { status: 409 });
    if (m.includes("UNAVAILABLE") || m.includes("VARIANT")) return NextResponse.json({ error: msg.unavailable, code: "UNAVAILABLE" }, { status: 409 });
    console.error("quote_order:", error);
    return NextResponse.json({ error: msg.server }, { status: 500 });
  }
  return NextResponse.json(data);
}
