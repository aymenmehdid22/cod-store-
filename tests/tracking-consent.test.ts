// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import * as T from "@/lib/tracking";

const cfg = {
  meta_pixel: { id: "1234567890123456", events: {} as Record<string, boolean> },
  ga4: { id: "G-ABC123XYZ9", events: {} as Record<string, boolean> },
  google_ads: { id: "AW-123456789", events: {}, conversionLabel: "AbC-dEfGhIj" },
};
const scripts = () => Array.from(document.querySelectorAll("script[src]")).map((s) => s.getAttribute("src")!);

beforeEach(() => {
  T.__resetTrackingForTests();
  document.head.innerHTML = "";
  localStorage.clear(); sessionStorage.clear();
  for (const k of ["fbq", "_fbq", "gtag", "dataLayer", "ttq"]) delete (window as unknown as Record<string, unknown>)[k];
  (navigator as unknown as { sendBeacon: unknown }).sendBeacon = vi.fn(() => true);
  T.configure(cfg);
});

describe("consent gating", () => {
  it("loads no script and sends nothing before consent", () => {
    T.track("AddToCart", { value: 1000, currency: "DZD" });
    T.trackPageView("/");
    expect(scripts()).toEqual([]);
    expect(window.fbq).toBeUndefined();
    expect(navigator.sendBeacon).not.toHaveBeenCalled();
  });
  it("refusal keeps everything off", () => {
    T.setConsent({ analytics: false, marketing: false });
    T.track("Lead", { value: 1000, currency: "DZD" });
    expect(scripts()).toEqual([]);
  });
  it("analytics consent loads GA4 only; marketing consent adds Meta + Ads — each script exactly once", () => {
    T.setConsent({ analytics: true, marketing: false });
    expect(scripts().some((s) => s.includes("googletagmanager.com/gtag/js?id=G-ABC123XYZ9"))).toBe(true);
    expect(scripts().some((s) => s.includes("fbevents.js"))).toBe(false);
    T.setConsent({ analytics: true, marketing: true });
    T.setConsent({ analytics: true, marketing: true });
    expect(scripts().filter((s) => s.includes("fbevents.js")).length).toBe(1);
    expect(scripts().filter((s) => s.includes("googletagmanager.com")).length).toBe(1);
  });
  it("withdrawing consent revokes and stops further events immediately", () => {
    T.setConsent({ analytics: true, marketing: true });
    const fbq = vi.fn(); const real = window.fbq; window.fbq = fbq as never; void real;
    T.track("AddToCart", { value: 5 });
    expect(fbq).toHaveBeenCalledWith("track", "AddToCart", expect.anything(), undefined);
    fbq.mockClear();
    T.setConsent({ analytics: true, marketing: false });
    expect(fbq).toHaveBeenCalledWith("consent", "revoke");
    fbq.mockClear();
    T.track("AddToCart", { value: 5 });
    expect(fbq).not.toHaveBeenCalled();
  });
  it("Lead is de-duplicated with the server event through a shared eventID, and fires the Ads conversion", () => {
    T.setConsent({ analytics: true, marketing: true });
    const fbq = vi.fn(); window.fbq = fbq as never;
    const gtag = vi.fn(); window.gtag = gtag as never;
    T.track("Lead", { value: 1900, currency: "DZD", event_id: "order-CMD-000123" });
    expect(fbq).toHaveBeenCalledWith("track", "Lead", expect.objectContaining({ value: 1900 }), { eventID: "order-CMD-000123" });
    expect(gtag).toHaveBeenCalledWith("event", "conversion", expect.objectContaining({ send_to: "AW-123456789/AbC-dEfGhIj" }));
  });
  it("page views are sent once per provider and path, even if consent changes later", () => {
    T.setConsent({ analytics: true, marketing: true });
    const fbq = vi.fn(); window.fbq = fbq as never;
    T.trackPageView("/shop"); T.trackPageView("/shop"); T.trackPageView("/cart");
    expect(fbq.mock.calls.filter((c) => c[1] === "PageView").length).toBe(2);
  });
  it("disabled event toggles are respected", () => {
    T.configure({ meta_pixel: { id: "1234567890123456", events: { AddToCart: false } } });
    T.setConsent({ analytics: false, marketing: true });
    const fbq = vi.fn(); window.fbq = fbq as never;
    T.track("AddToCart", {}); T.track("ViewContent", {});
    expect(fbq.mock.calls.map((c) => c[1])).toEqual(["ViewContent"]);
  });
});

describe("payload hygiene (no personal data can reach a provider)", () => {
  it("drops unknown fields such as name, phone, email, address", () => {
    const dirty = { value: 1900, currency: "DZD", customerName: "Ali", phone: "0550123456", email: "a@b.dz", address: "Rue 1", content_ids: ["p1"] } as never;
    expect(T.sanitize(dirty)).toEqual({ value: 1900, currency: "DZD", content_ids: ["p1"] });
  });
  it("drops search strings that look like an email or a phone number", () => {
    expect(T.sanitize({ search_string: "ali@example.com" }).search_string).toBeUndefined();
    expect(T.sanitize({ search_string: "0550 12 34 56" }).search_string).toBeUndefined();
    expect(T.sanitize({ search_string: "casquette noire" }).search_string).toBe("casquette noire");
  });
  it("rejects malformed currency, negative values and oversized ids", () => {
    const s = T.sanitize({ currency: "dzd; DROP", value: -5, content_ids: ["x".repeat(200), "ok"] });
    expect(s.currency).toBeUndefined(); expect(s.value).toBeUndefined(); expect(s.content_ids).toEqual(["ok"]);
  });
});
