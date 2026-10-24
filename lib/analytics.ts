// Attribution (UTM / fbclid). Captured into sessionStorage on landing (needed to attribute an order placed in the
// same session); promoted to localStorage (first-touch across visits) only once the visitor has given consent.
const KEY = "cod_attribution";

export type Attribution = { fbclid?: string; utm_source?: string; utm_medium?: string; utm_campaign?: string; utm_content?: string };

const clean = (v: string | null) => (v ? v.slice(0, 120) : undefined);

function read(storage: Storage): Attribution | null {
  try { return JSON.parse(storage.getItem(KEY) ?? "null"); } catch { return null; }
}

export function captureAttribution(consented = false): void {
  if (typeof window === "undefined") return;
  try {
    const existing = read(window.sessionStorage) ?? read(window.localStorage);
    let data = existing;
    if (!existing) {
      const p = new URLSearchParams(window.location.search);
      const found: Attribution = {
        fbclid: clean(p.get("fbclid")), utm_source: clean(p.get("utm_source")), utm_medium: clean(p.get("utm_medium")),
        utm_campaign: clean(p.get("utm_campaign")), utm_content: clean(p.get("utm_content")),
      };
      if (found.fbclid || found.utm_source) { data = found; window.sessionStorage.setItem(KEY, JSON.stringify(found)); }
    }
    if (data && consented && !read(window.localStorage)) window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch { /* storage unavailable — attribution is best-effort */ }
}

export function clearPersistentAttribution(): void {
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}

export function getAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try { return read(window.sessionStorage) ?? read(window.localStorage) ?? {}; } catch { return {}; }
}
