import { NextRequest, NextResponse } from "next/server";
import { orderSchema, normalizeAlgerianPhone } from "@/lib/validation";
import { getServiceSupabase } from "@/lib/supabase";
import { rateLimit } from "@/lib/rate-limit";
import { appendOrderToSheet, type SheetOrder } from "@/lib/google-sheets";
import { sendMetaCapi } from "@/lib/tracking-server";
import { getRequestLocale } from "@/lib/i18n/server";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { WILAYAS } from "@/data/wilayas";

export const dynamic = "force-dynamic";

// Database exception code -> [dictionary key, HTTP status]
const RPC_ERRORS: Record<string, ["productNotFound" | "variantNotFound" | "colorUnavailable" | "outOfStock" | "discountInvalid" | "unavailable" | "invalid", number]> = {
  PRODUCT_UNAVAILABLE: ["unavailable", 409],
  VARIANT_REQUIRED: ["variantNotFound", 400],
  VARIANT_NOT_FOUND: ["variantNotFound", 400],
  VARIANT_UNAVAILABLE: ["colorUnavailable", 409],
  OUT_OF_STOCK: ["outOfStock", 409],
  DISCOUNT_INVALID: ["discountInvalid", 400],
  INVALID_QUANTITY: ["invalid", 400],
};

export async function POST(request: NextRequest) {
  const msg = getDictionary(getRequestLocale(request)).api;
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (!rateLimit("orders:" + ip, 5, 60_000)) {
      return NextResponse.json({ error: msg.tooMany }, { status: 429 });
    }

    const parsed = orderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: msg.invalid, issues: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const data = parsed.data;

    // Honeypot: bots fill this invisible field — pretend success and drop.
    if (data.website) {
      return NextResponse.json({ success: true, orderNumber: "CMD-000000" });
    }

    const phone = normalizeAlgerianPhone(data.phone);
    if (!phone) {
      return NextResponse.json({ error: msg.phone, issues: { phone: ["Format invalide"] } }, { status: 400 });
    }

    // Store the canonical (French) wilaya name regardless of the UI language.
    const wilaya = WILAYAS.find((w) => w.code === data.wilayaCode);
    if (!wilaya) return NextResponse.json({ error: msg.wilayaInvalid }, { status: 400 });

    const supabase = getServiceSupabase();

    // Price, stock, discount and shipping are all resolved INSIDE the database function, in one
    // transaction. Nothing price-like or stock-like from the client is trusted.
    const { data: rows, error } = await supabase.rpc("place_order", {
      p_items: data.items.map((i) => ({ product_id: i.productId, variant_id: i.variantId ?? null, quantity: i.quantity })),
      p_customer_name: data.customerName,
      p_phone: phone,
      p_wilaya_code: data.wilayaCode,
      p_wilaya_name: wilaya.name,
      p_delivery_type: data.deliveryType,
      p_commune: data.commune ?? null,
      p_address: data.address ?? null,
      p_stopdesk: data.stopdesk ?? null,
      p_discount_code: data.promoCode ?? null,
      p_attribution: data.attribution ?? {},
      p_idempotency_key: data.idempotencyKey ?? null,
      p_marketing_consent: data.marketingConsent === true,
    });

    if (error) {
      const code = Object.keys(RPC_ERRORS).find((c) => error.message?.includes(c));
      if (code) {
        const [key, status] = RPC_ERRORS[code];
        return NextResponse.json({ error: key === "invalid" ? msg.invalid : msg[key] }, { status });
      }
      console.error("place_order failed:", error);
      return NextResponse.json({ error: msg.server }, { status: 500 });
    }

    const placed = (rows as { order_id: string; order_number: string; total_price: number; replayed: boolean }[])?.[0];
    if (!placed) return NextResponse.json({ error: msg.server }, { status: 500 });

    // A retried request (same idempotency key) returns the original order without repeating side effects.
    if (placed.replayed) {
      return NextResponse.json({ success: true, orderNumber: placed.order_number, total: placed.total_price, replayed: true });
    }

    // ---- Order is saved. Everything below must NEVER fail the order. ----
    await (async () => {
      try {
        const { data: o } = await supabase
          .from("orders")
          .select("product_name, variant_name, unit_price, quantity, currency, fbclid, created_at")
          .eq("id", placed.order_id)
          .single();
        const sheetOrder: SheetOrder = {
          orderNumber: placed.order_number,
          createdAt: new Date().toISOString(),
          productName: o?.product_name ?? "",
          variantName: o?.variant_name ?? "",
          quantity: o?.quantity ?? 0,
          customerName: data.customerName,
          phone,
          wilayaName: wilaya.name,
          deliveryType: data.deliveryType,
          commune: data.commune ?? "",
          address: data.address ?? "",
          stopdesk: data.stopdesk ?? "",
          unitPrice: o?.unit_price ?? 0,
          totalPrice: placed.total_price,
          status: "new",
          utmSource: data.attribution?.utm_source ?? "",
          utmCampaign: data.attribution?.utm_campaign ?? "",
        };
        const results = await Promise.allSettled([
          appendOrderToSheet(sheetOrder),
          // Server-side Lead only for customers who accepted marketing cookies; same event_id as the browser event.
          data.marketingConsent === true
            ? sendMetaCapi({ eventName: "Lead", eventId: "order-" + placed.order_number, orderNumber: placed.order_number, value: placed.total_price, currency: o?.currency ?? "DZD", fbclid: o?.fbclid, createdAt: o?.created_at })
            : Promise.resolve("skipped"),
        ]);
        if (results[0].status === "fulfilled" && results[0].value === true) {
          await supabase.from("orders").update({ google_sheet_synced: true }).eq("id", placed.order_id);
        }
      } catch (e) {
        console.error("Post-order sync failed (non-blocking):", e);
      }
    })();

    return NextResponse.json({ success: true, orderNumber: placed.order_number, total: placed.total_price });
  } catch (e) {
    console.error("Order error:", e);
    return NextResponse.json({ error: msg.server }, { status: 500 });
  }
}
