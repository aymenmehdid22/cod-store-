import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { NEXT_STATUSES } from "@/types/order";
import { ID_PATTERNS } from "@/lib/tracking-config";
import { RESERVED_SLUGS } from "@/lib/admin-schemas";

const sql = (f: string) => readFileSync("supabase/migrations/" + f, "utf8");

describe("UI rules stay in sync with the database", () => {
  it("order status transitions: TypeScript map == order_transition_allowed() in SQL", () => {
    const m = sql("002_commerce_core.sql");
    const fn = m.slice(m.indexOf("function public.order_transition_allowed"), m.indexOf("function public.admin_set_order_status"));
    const fromSql: Record<string, string[]> = {};
    for (const [, from, tos] of fn.matchAll(/when '(\w+)'\s+then p_to in \(([^)]*)\)/g)) fromSql[from] = [...tos.matchAll(/'(\w+)'/g)].map((x) => x[1]);
    for (const [from, tos] of Object.entries(NEXT_STATUSES)) expect([...(fromSql[from] ?? [])].sort(), "from " + from).toEqual([...tos].sort());
  });
  it("tracking ID regexes: TypeScript == CHECK constraint tracking_id_format", () => {
    const m = sql("002_commerce_core.sql");
    const block = m.slice(m.indexOf("tracking_id_format"), m.indexOf("tracking_enabled_needs_id"));
    for (const [, provider, re] of block.matchAll(/provider = '(\w+)'\s+and public_id ~ '([^']+)'/g)) {
      expect(re, provider).toBe(ID_PATTERNS[provider as keyof typeof ID_PATTERNS].source);
    }
  });
  it("reserved product slugs: TypeScript == products_slug_not_reserved", () => {
    const m = sql("004_storefront_analytics_admin.sql");
    const list = [...(m.match(/slug not in \(([^)]*)\)/)?.[1] ?? "").matchAll(/'([^']+)'/g)].map((x) => x[1]);
    expect([...list].sort()).toEqual([...RESERVED_SLUGS].sort());
  });
});
