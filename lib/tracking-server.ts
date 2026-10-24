import { createHash } from "crypto";
import { getPublicSupabase } from "@/lib/supabase-public";
import { getServiceSupabase } from "@/lib/supabase";
import { toPublicConfig, eventEnabled, META_TEST_CODE_PATTERN, type PublicTrackingConfig } from "@/lib/tracking-config";

/** Enabled integrations as the storefront may see them (RLS lets anon read enabled rows only). */
export async function getTrackingConfig(): Promise<PublicTrackingConfig> {
  const { data, error } = await getPublicSupabase()
    .from("tracking_integrations")
    .select("provider, enabled, public_id, config")
    .eq("enabled", true);
  if (error) {
    console.error("tracking config:", error.message);
    return {};
  }
  return toPublicConfig(data ?? []);
}

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

type CapiEvent = { eventName: "Lead" | "Purchase"; eventId: string; orderNumber: string; value: number; currency: string; fbclid?: string | null; createdAt?: string };

/** Meta Conversions API. Credentials: META_ACCESS_TOKEN (env, server only). Pixel ID + toggles come from the admin.
 *  NO personal data is sent: user_data is limited to a SHA-256 of the (random) order number and the fbc click id. */
export async function sendMetaCapi(ev: CapiEvent): Promise<"sent" | "skipped" | "failed"> {
  try {
    const token = process.env.META_ACCESS_TOKEN;
    if (!token) return "skipped";
    const { data } = await getServiceSupabase().from("tracking_integrations").select("enabled, public_id, config").eq("provider", "meta_pixel").maybeSingle();
    if (!data?.enabled || !data.public_id) return "skipped";
    if (!eventEnabled(data.config?.events, ev.eventName)) return "skipped";

    const testCode = data.config?.test_event_code;
    const userData: Record<string, string> = { external_id: createHash("sha256").update(ev.orderNumber).digest("hex") };
    if (ev.fbclid) userData.fbc = "fb.1." + (ev.createdAt ? new Date(ev.createdAt).getTime() : Date.now()) + "." + ev.fbclid;

    const body = {
      data: [{
        event_name: ev.eventName, event_time: Math.floor(Date.now() / 1000), event_id: ev.eventId,
        action_source: "website", event_source_url: SITE_URL + "/", user_data: userData,
        custom_data: { value: ev.value, currency: ev.currency, content_name: "COD Order", content_type: "product" },
      }],
      ...(testCode && META_TEST_CODE_PATTERN.test(testCode) ? { test_event_code: testCode } : {}),
    };
    const res = await fetch("https://graph.facebook.com/v20.0/" + data.public_id + "/events", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("Meta CAPI error:", res.status, await res.text());
      return "failed";
    }
    return "sent";
  } catch (e) {
    console.error("Meta CAPI error:", e);
    return "failed";
  }
}

/** Purchase = the order was DELIVERED (cash collected). Sent at most once per order, and only if the customer
 *  consented to marketing when ordering. The claim (purchase_event_sent_at) is taken BEFORE sending so a double
 *  click or retry cannot duplicate it; it is released if Meta did not accept the event. */
export async function sendPurchaseForDeliveredOrder(orderId: string): Promise<"sent" | "skipped" | "failed"> {
  const db = getServiceSupabase();
  const { data: claimed } = await db
    .from("orders")
    .update({ purchase_event_sent_at: new Date().toISOString() })
    .eq("id", orderId).eq("status", "delivered").eq("marketing_consent", true).is("purchase_event_sent_at", null)
    .select("order_number, total_price, currency, fbclid, created_at")
    .maybeSingle();
  if (!claimed) return "skipped";
  const result = await sendMetaCapi({
    eventName: "Purchase", eventId: "purchase-" + claimed.order_number, orderNumber: claimed.order_number,
    value: claimed.total_price, currency: claimed.currency, fbclid: claimed.fbclid, createdAt: claimed.created_at,
  });
  if (result !== "sent") await db.from("orders").update({ purchase_event_sent_at: null }).eq("id", orderId);
  return result;
}
