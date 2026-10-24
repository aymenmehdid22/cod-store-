import { describe, expect, it, vi } from "vitest";

// React's server-only cache() is provided by Next at build time; outside Next it is a plain pass-through.
vi.mock("react", async (orig) => ({ ...(await orig<typeof import("react")>()), cache: <T,>(fn: T) => fn }));
import { csvCell } from "@/lib/csv";
import { resolveRange, addDays, todayInStore } from "@/lib/date-range";
import { addLine, setLineQty, parseCart, lineKey, type CartLine } from "@/lib/cart";
import { cleanSearch, mapSettings, DEFAULT_SETTINGS } from "@/lib/store-data";
import { parseBlocks } from "@/components/store/RichText";
import { discountState } from "@/components/admin/DiscountManager";

describe("CSV export", () => {
  it("neutralises spreadsheet formulas and escapes quotes", () => {
    expect(csvCell("=HYPERLINK(\"http://evil\")")).toBe('"\'=HYPERLINK(""http://evil"")"');
    for (const bad of ["+1+1", "-2", "@SUM(A1)", "\tx"]) expect(csvCell(bad).startsWith("\"'")).toBe(true);
    expect(csvCell(null)).toBe('""'); expect(csvCell(1900)).toBe('"1900"'); expect(csvCell("Alger, 16")).toBe('"Alger, 16"');
  });
});

describe("date ranges (Africa/Algiers calendar days)", () => {
  const now = new Date("2026-10-24T23:30:00Z"); // 00:30 on the 25th in Algiers (UTC+1)
  it("uses the store's day, not UTC", () => { expect(todayInStore(now)).toBe("2026-10-25"); });
  it("presets", () => {
    expect(resolveRange({ range: "today" }, now)).toMatchObject({ from: "2026-10-25", to: "2026-10-25" });
    expect(resolveRange({ range: "7d" }, now)).toMatchObject({ from: "2026-10-19", to: "2026-10-25" });
    expect(resolveRange({}, now)).toMatchObject({ key: "30d", from: "2026-09-26" });
    expect(resolveRange({ range: "90d" }, now).from).toBe("2026-07-28");
  });
  it("custom range: swaps reversed dates, clamps the future and the 400-day cap, falls back on garbage", () => {
    expect(resolveRange({ range: "custom", from: "2026-10-10", to: "2026-10-01" }, now)).toMatchObject({ from: "2026-10-01", to: "2026-10-10" });
    expect(resolveRange({ range: "custom", from: "2026-10-01", to: "2027-05-01" }, now).to).toBe("2026-10-25");
    expect(resolveRange({ range: "custom", from: "2024-01-01", to: "2026-10-25" }, now).to).toBe(addDays("2024-01-01", 399));
    expect(resolveRange({ range: "custom", from: "nope", to: "x" }, now).key).toBe("30d");
  });
});

describe("cart", () => {
  const item = { productId: "p1", variantId: "v1", slug: "cap", name: "Cap", unitPrice: 1900, quantity: 2, max: 5 };
  it("merges identical lines and caps quantity at stock/10", () => {
    let c: CartLine[] = addLine([], item);
    c = addLine(c, { ...item, quantity: 9 });
    expect(c).toHaveLength(1); expect(c[0].quantity).toBe(5);
    expect(addLine([], { ...item, max: 99, quantity: 50 })[0].quantity).toBe(10);
  });
  it("different variants are different lines; at most 10 lines", () => {
    let c = addLine([], item); c = addLine(c, { ...item, variantId: "v2" });
    expect(c).toHaveLength(2);
    let many: CartLine[] = []; for (let i = 0; i < 12; i++) many = addLine(many, { ...item, productId: "p" + i });
    expect(many).toHaveLength(10);
  });
  it("setLineQty clamps to [1, max]", () => {
    const c = addLine([], item); const k = lineKey("p1", "v1");
    expect(setLineQty(c, k, 0)[0].quantity).toBe(1); expect(setLineQty(c, k, 99)[0].quantity).toBe(5); expect(setLineQty(c, k, 3)[0].quantity).toBe(3);
  });
  it("parseCart survives corrupted storage", () => {
    expect(parseCart("not json")).toEqual([]); expect(parseCart('{"a":1}')).toEqual([]);
    expect(parseCart(JSON.stringify([{ productId: "p", quantity: 99, unitPrice: 10 }, { bad: true }]))).toHaveLength(1);
  });
});

describe("storefront data helpers", () => {
  it("cleanSearch strips PostgREST filter syntax characters", () => {
    expect(cleanSearch("a%,b(c)*d:e\\f")).toBe("a b c d e f"); expect(cleanSearch(undefined)).toBe(""); expect(cleanSearch("x".repeat(200)).length).toBe(60);
  });
  it("mapSettings tolerates missing or malformed values", () => {
    expect(mapSettings([])).toEqual(DEFAULT_SETTINGS);
    const s = mapSettings([{ key: "store.name", value: 42 }, { key: "shipping.free_over", value: "x" }, { key: "home.layout", value: { featured_count: 999, single_product_redirect: false } }, { key: "store.contact", value: "oops" }]);
    expect(s.name).toBe("COD Store"); expect(s.freeOver).toBeNull(); expect(s.home).toEqual({ single_product_redirect: false, featured_count: 24 }); expect(s.contact.phone).toBeNull();
  });
  it("RichText never interprets HTML and parses headings/lists/paragraphs", () => {
    const b = parseBlocks("## Titre\nTexte <b>gras</b>\n\n- un\n- deux");
    expect(b.map((x) => x.type)).toEqual(["h2", "p", "ul"]); expect(b[1].lines[0]).toBe("Texte <b>gras</b>"); expect(b[2].lines).toEqual(["un", "deux"]);
  });
});

describe("discount state labels", () => {
  const base = { is_active: true, starts_at: null, ends_at: null, usage_limit: null, used_count: 0 };
  const now = Date.parse("2026-10-24T12:00:00Z");
  it("active / disabled / expired / scheduled / exhausted", () => {
    expect(discountState(base, now).label).toBe("Actif");
    expect(discountState({ ...base, is_active: false }, now).label).toBe("Désactivé");
    expect(discountState({ ...base, ends_at: "2026-10-01T00:00:00Z" }, now).label).toBe("Expiré");
    expect(discountState({ ...base, starts_at: "2026-11-01T00:00:00Z" }, now).label).toBe("Programmé");
    expect(discountState({ ...base, usage_limit: 5, used_count: 5 }, now).label).toBe("Épuisé");
  });
});
