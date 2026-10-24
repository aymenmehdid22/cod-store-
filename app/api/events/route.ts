import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { rateLimit } from "@/lib/rate-limit";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// First-party, anonymous, aggregate-only events. The browser only calls this after analytics consent.
// No IP, user agent, name, phone or address is stored. Purchase is never accepted from the browser.
const schema = z.object({
  event: z.enum(["PageView", "ViewContent", "Search", "AddToCart", "RemoveFromCart", "InitiateCheckout", "Lead"]),
  session: z.string().regex(/^[A-Za-z0-9-]{8,64}$/),
  path: z.string().max(200).startsWith("/").optional(),
  product_id: z.string().uuid().optional(),
  value: z.number().int().min(0).max(100_000_000).optional(),
  referrer: z.string().max(100).optional(),
  utm_source: z.string().max(120).optional(),
  utm_medium: z.string().max(120).optional(),
  utm_campaign: z.string().max(120).optional(),
});

export async function POST(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit("events:" + ip, 120, 60_000)) return new NextResponse(null, { status: 204 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 400 });
  const d = parsed.data;
  const { error } = await getServiceSupabase().from("analytics_events").insert({
    event_name: d.event, session_id: d.session, path: d.path?.split("?")[0], product_ref: d.product_id ?? null,
    value: d.value ?? null, referrer: d.referrer ?? null, utm_source: d.utm_source ?? null, utm_medium: d.utm_medium ?? null, utm_campaign: d.utm_campaign ?? null,
  });
  if (error) console.error("events insert:", error.message);
  return new NextResponse(null, { status: 204 });
}
