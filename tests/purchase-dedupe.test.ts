import { beforeEach, describe, expect, it, vi } from "vitest";

// In-memory stand-in for the orders table, honouring the claim semantics of sendPurchaseForDeliveredOrder().
type Row = { id: string; status: string; marketing_consent: boolean; purchase_event_sent_at: string | null; order_number: string; total_price: number; currency: string; fbclid: string | null; created_at: string };
let row: Row;
const metaRow = { enabled: true, public_id: "1234567890123456", config: { events: { Purchase: true } } };

vi.mock("@/lib/supabase", () => ({
  getServiceSupabase: () => ({
    from: (table: string) => {
      if (table === "tracking_integrations") return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: metaRow }) }) }) };
      let patch: Partial<Row> = {}; const f: Record<string, unknown> = {}; let isNull: string | null = null;
      const chain: Record<string, unknown> = {
        update: (p: Partial<Row>) => { patch = p; return chain; },
        eq: (k: string, v: unknown) => { f[k] = v; return chain; },
        is: (k: string) => { isNull = k; return chain; },
        select: () => chain,
        maybeSingle: async () => {
          const matches = row.id === f.id && Object.entries(f).every(([k, v]) => (row as unknown as Record<string, unknown>)[k] === v) && (!isNull || (row as unknown as Record<string, unknown>)[isNull] === null);
          if (!matches) return { data: null };
          Object.assign(row, patch); return { data: { ...row } };
        },
        then: (res: (v: unknown) => void) => { if (row.id === f.id) Object.assign(row, patch); res({ data: null }); },
      };
      return chain;
    },
  }),
}));
vi.mock("@/lib/supabase-public", () => ({ getPublicSupabase: () => ({}) }));

beforeEach(() => {
  process.env.META_ACCESS_TOKEN = "test-token";
  row = { id: "o1", status: "delivered", marketing_consent: true, purchase_event_sent_at: null, order_number: "CMD-000001", total_price: 1900, currency: "DZD", fbclid: null, created_at: "2026-10-01T10:00:00Z" };
});

describe("Purchase conversion (sent only when an order is DELIVERED)", () => {
  it("is sent once, even if the order is marked delivered/refreshed twice", async () => {
    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { sendPurchaseForDeliveredOrder } = await import("@/lib/tracking-server");
    expect(await sendPurchaseForDeliveredOrder("o1")).toBe("sent");
    expect(await sendPurchaseForDeliveredOrder("o1")).toBe("skipped");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, { body: string }])[1].body);
    expect(body.data[0].event_name).toBe("Purchase");
    expect(body.data[0].event_id).toBe("purchase-CMD-000001");
    expect(Object.keys(body.data[0].user_data)).toEqual(["external_id"]); // pseudonymous hash of the order number only
    expect(JSON.stringify(body)).not.toMatch(/phone|email|customer|address|wilaya/i); // no personal data
  });
  it("is never sent for a customer who did not consent to marketing", async () => {
    row.marketing_consent = false;
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { sendPurchaseForDeliveredOrder } = await import("@/lib/tracking-server");
    expect(await sendPurchaseForDeliveredOrder("o1")).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("is never sent for an order that is not delivered", async () => {
    row.status = "shipped";
    const fetchMock = vi.fn(); vi.stubGlobal("fetch", fetchMock);
    const { sendPurchaseForDeliveredOrder } = await import("@/lib/tracking-server");
    expect(await sendPurchaseForDeliveredOrder("o1")).toBe("skipped");
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("releases the claim when Meta rejects the event, so it can be retried", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 400 })));
    const { sendPurchaseForDeliveredOrder } = await import("@/lib/tracking-server");
    expect(await sendPurchaseForDeliveredOrder("o1")).toBe("failed");
    expect(row.purchase_event_sent_at).toBeNull();
  });
});
