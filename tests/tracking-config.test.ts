import { describe, expect, it } from "vitest";
import { toPublicConfig, eventEnabled, consentNeeded } from "@/lib/tracking-config";
import { trackingInput, isAllowedMediaUrl, productInput, discountInput } from "@/lib/admin-schemas";

describe("tracking configuration", () => {
  it("never lets a malicious or malformed id reach the storefront", () => {
    const cfg = toPublicConfig([
      { provider: "meta_pixel", enabled: true, public_id: '1234567890"><script>alert(1)</script>', config: {} },
      { provider: "ga4", enabled: true, public_id: "G-ABC123XYZ9", config: {} },
      { provider: "tiktok_pixel", enabled: false, public_id: "C1A2B3C4D5E6F7G8H9", config: {} },
      { provider: "evil", enabled: true, public_id: "1234567890", config: {} },
    ]);
    expect(Object.keys(cfg)).toEqual(["ga4"]);
  });
  it("only exposes a valid Google Ads conversion label", () => {
    const ok = toPublicConfig([{ provider: "google_ads", enabled: true, public_id: "AW-123456789", config: { conversion_label: "AbC-dEfGhIj" } }]);
    const bad = toPublicConfig([{ provider: "google_ads", enabled: true, public_id: "AW-123456789", config: { conversion_label: "');alert(1);//" } }]);
    expect(ok.google_ads?.conversionLabel).toBe("AbC-dEfGhIj");
    expect(bad.google_ads?.conversionLabel).toBeUndefined();
  });
  it("events default on, except Purchase which must be enabled explicitly", () => {
    expect(eventEnabled({}, "AddToCart")).toBe(true);
    expect(eventEnabled({ AddToCart: false }, "AddToCart")).toBe(false);
    expect(eventEnabled({}, "Purchase")).toBe(false);
    expect(eventEnabled({ Purchase: true }, "Purchase")).toBe(true);
  });
  it("no banner is needed when nothing is enabled", () => { expect(consentNeeded({})).toBe(false); expect(consentNeeded({ ga4: { id: "G-ABC123XYZ9", events: {} } })).toBe(true); });
  it("admin input: rejects scripts, unknown events, enabling without an id", () => {
    const meta = trackingInput("meta_pixel");
    expect(meta.safeParse({ enabled: true, public_id: "<script>x</script>", events: {} }).success).toBe(false);
    expect(meta.safeParse({ enabled: true, public_id: null, events: {} }).success).toBe(false);
    expect(meta.safeParse({ enabled: false, public_id: "1234567890123456", events: { Nope: true } }).success).toBe(false);
    expect(meta.safeParse({ enabled: true, public_id: "1234567890123456", events: { Lead: true, Purchase: true }, test_event_code: "TEST123" }).success).toBe(true);
    expect(trackingInput("ga4").safeParse({ enabled: true, public_id: "G-ABC123XYZ9", events: {}, test_event_code: "TEST1" }).success).toBe(false);
  });
});

describe("admin input schemas", () => {
  const base = { slug: "my-cap", name: "Cap", price: 1000, status: "draft" as const };
  it("product: compare price must be >= price; duplicate variant keys and reserved slugs rejected", () => {
    expect(productInput.safeParse({ ...base, compare_at_price: 900 }).success).toBe(false);
    expect(productInput.safeParse({ ...base, compare_at_price: 1200 }).success).toBe(true);
    const v = { key: "noir", name: "Noir" };
    expect(productInput.safeParse({ ...base, variants: [v, v] }).success).toBe(false);
    expect(productInput.safeParse({ ...base, slug: "shop" }).success).toBe(false);
    expect(productInput.safeParse({ ...base, slug: "Bad Slug" }).success).toBe(false);
  });
  it("images must be local or live in our Supabase Storage", () => {
    const sb = "https://abc.supabase.co";
    expect(isAllowedMediaUrl("/images/x.jpg", sb)).toBe(true);
    expect(isAllowedMediaUrl("https://abc.supabase.co/storage/v1/object/public/product-images/a.webp", sb)).toBe(true);
    expect(isAllowedMediaUrl("https://evil.example/a.webp", sb)).toBe(false);
    expect(isAllowedMediaUrl("//evil.example/a.webp", sb)).toBe(false);
    expect(isAllowedMediaUrl("javascript:alert(1)", sb)).toBe(false);
  });
  it("discount: percent <= 100, end after start, code format normalised to upper case", () => {
    expect(discountInput.safeParse({ code: "bienvenue10", type: "percent", value: 10 }).success).toBe(true);
    expect(discountInput.parse({ code: "bienvenue10", type: "percent", value: 10 }).code).toBe("BIENVENUE10");
    expect(discountInput.safeParse({ code: "X", type: "percent", value: 10 }).success).toBe(false);
    expect(discountInput.safeParse({ code: "BIG", type: "percent", value: 150 }).success).toBe(false);
    expect(discountInput.safeParse({ code: "BAD", type: "fixed", value: 100, starts_at: "2026-02-01T00:00:00+01:00", ends_at: "2026-01-01T00:00:00+01:00" }).success).toBe(false);
  });
});
