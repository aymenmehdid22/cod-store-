// Date ranges are calendar days in Africa/Algiers (the store's timezone), inclusive — matching admin_analytics().
export const STORE_TZ = "Africa/Algiers";
export type RangeKey = "today" | "7d" | "30d" | "90d" | "custom";
export const RANGE_LABELS: Record<RangeKey, string> = { today: "Aujourd'hui", "7d": "7 derniers jours", "30d": "30 derniers jours", "90d": "90 derniers jours", custom: "Personnalisé" };

export function todayInStore(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const isIso = (s: string | undefined): s is string => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(s + "T00:00:00Z").getTime());

export function resolveRange(sp: { range?: string; from?: string; to?: string }, now = new Date()): { key: RangeKey; from: string; to: string } {
  const today = todayInStore(now);
  const key = (["today", "7d", "30d", "90d", "custom"] as const).find((k) => k === sp.range) ?? "30d";
  if (key === "today") return { key, from: today, to: today };
  if (key === "7d") return { key, from: addDays(today, -6), to: today };
  if (key === "90d") return { key, from: addDays(today, -89), to: today };
  if (key === "custom" && isIso(sp.from) && isIso(sp.to)) {
    let from = sp.from, to = sp.to;
    if (to < from) [from, to] = [to, from];
    if (addDays(from, 399) < to) to = addDays(from, 399); // database caps ranges at 400 days
    if (to > today) to = today;
    if (from > to) from = to;
    return { key, from, to };
  }
  return { key: "30d", from: addDays(today, -29), to: today };
}
