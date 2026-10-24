// Client-side tracking facade. UI code calls track(...) only — never fbq/gtag/ttq directly.
// Guarantees: nothing loads or fires before consent for the provider's category; scripts are added at most once;
// event payloads are whitelisted (no PII can pass); consent withdrawal stops events immediately.
import { ID_PATTERNS, PROVIDER_META, eventEnabled, type Consent, type PublicTrackingConfig, type Provider } from "./tracking-config";
import { getAttribution } from "./analytics";

export type TrackEvent = "PageView" | "ViewContent" | "Search" | "AddToCart" | "RemoveFromCart" | "InitiateCheckout" | "Lead";
export type TrackData = {
  value?: number; currency?: string; content_ids?: string[]; content_name?: string; search_string?: string;
  num_items?: number; event_id?: string; product_id?: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window { fbq?: any; _fbq?: any; dataLayer?: any[]; gtag?: (...a: any[]) => void; ttq?: any; TiktokAnalyticsObject?: string; [k: `ga-disable-${string}`]: boolean }
}

export const CONSENT_KEY = "cod_consent_v1";
const EMAIL_RE = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE_RE = /(?:\+?\d[\s.-]?){8,}/;

/** Keeps only whitelisted, non-personal fields. A search string that looks like an email/phone number is dropped. */
export function sanitize(d: TrackData = {}): TrackData {
  const out: TrackData = {};
  if (typeof d.value === "number" && Number.isFinite(d.value) && d.value >= 0) out.value = Math.round(d.value);
  if (typeof d.currency === "string" && /^[A-Z]{3}$/.test(d.currency)) out.currency = d.currency;
  if (Array.isArray(d.content_ids)) out.content_ids = d.content_ids.filter((x) => typeof x === "string" && x.length <= 64).slice(0, 20);
  if (typeof d.content_name === "string") out.content_name = d.content_name.slice(0, 120);
  if (typeof d.search_string === "string" && !EMAIL_RE.test(d.search_string) && !PHONE_RE.test(d.search_string)) out.search_string = d.search_string.slice(0, 80);
  if (typeof d.num_items === "number" && d.num_items > 0 && d.num_items <= 100) out.num_items = Math.round(d.num_items);
  if (typeof d.event_id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(d.event_id)) out.event_id = d.event_id;
  if (typeof d.product_id === "string" && /^[0-9a-f-]{36}$/i.test(d.product_id)) out.product_id = d.product_id;
  return out;
}

let cfg: PublicTrackingConfig = {};
let consent: Consent | null = null;
const loaded: Partial<Record<Provider, boolean>> = {};
const pageViews = new Set<string>(); // "provider:path" — a page view is sent once per provider per path
let session: string | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
export const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function configure(next: PublicTrackingConfig) { cfg = next; }
export function getConsent(): Consent | null { return consent; }

export function readStoredConsent(): Consent | null {
  try {
    const raw = JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null");
    if (raw && typeof raw.analytics === "boolean" && typeof raw.marketing === "boolean") return { analytics: raw.analytics, marketing: raw.marketing };
  } catch { /* ignore */ }
  return null;
}

function allowed(p: Provider): boolean {
  return !!cfg[p] && !!consent && consent[PROVIDER_META[p].category];
}

function sessionId(): string {
  if (session) return session;
  try {
    session = sessionStorage.getItem("cod_sid");
    if (!session) { session = crypto.randomUUID(); sessionStorage.setItem("cod_sid", session); }
  } catch { session = crypto.randomUUID(); }
  return session;
}

function addScript(src: string) {
  if (document.querySelector('script[src="' + src + '"]')) return; // never initialise twice
  const s = document.createElement("script"); s.async = true; s.src = src; document.head.appendChild(s);
}

function loadMeta(id: string) {
  if (loaded.meta_pixel || window.fbq) { loaded.meta_pixel = true; return; }
  const n: any = (window.fbq = function (...args: any[]) { n.callMethod ? n.callMethod.apply(n, args) : n.queue.push(args); });
  if (!window._fbq) window._fbq = n;
  n.push = n; n.loaded = true; n.version = "2.0"; n.queue = [];
  addScript("https://connect.facebook.net/en_US/fbevents.js");
  window.fbq("init", id);
  loaded.meta_pixel = true;
}

let gtagScriptAdded = false;
function ensureGtag(firstId: string) {
  window.dataLayer = window.dataLayer || [];
  if (!window.gtag) {
    window.gtag = function () { window.dataLayer!.push(arguments); }; // gtag.js requires `arguments`, not a rest array
    window.gtag("consent", "default", { ad_storage: "denied", analytics_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
    window.gtag("js", new Date());
  }
  // One gtag.js for ALL Google products: further IDs (GA4, Ads) are added with gtag('config', id), never with a second script.
  if (!gtagScriptAdded) { gtagScriptAdded = true; addScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(firstId)); }
}

function loadGa4(id: string) {
  if (loaded.ga4) { window[("ga-disable-" + id) as `ga-disable-${string}`] = false; window.gtag?.("consent", "update", { analytics_storage: "granted" }); return; }
  ensureGtag(id);
  window[("ga-disable-" + id) as `ga-disable-${string}`] = false;
  window.gtag!("consent", "update", { analytics_storage: "granted" });
  window.gtag!("config", id, { send_page_view: false, anonymize_ip: true });
  loaded.ga4 = true;
}

function loadAds(id: string) {
  if (loaded.google_ads) { window.gtag?.("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" }); return; }
  ensureGtag(id);
  window.gtag!("consent", "update", { ad_storage: "granted", ad_user_data: "granted", ad_personalization: "granted" });
  window.gtag!("config", id, { send_page_view: false });
  loaded.google_ads = true;
}

function loadTikTok(id: string) {
  if (loaded.tiktok_pixel || window.ttq) { loaded.tiktok_pixel = true; return; }
  const w: any = window; const t = "ttq"; w.TiktokAnalyticsObject = t;
  const ttq: any = (w[t] = w[t] || []);
  ttq.methods = ["page", "track", "identify", "instances", "debug", "on", "off", "once", "ready", "alias", "group", "enableCookie", "disableCookie", "holdConsent", "revokeConsent", "grantConsent"];
  ttq.setAndDefer = (o: any, m: string) => { o[m] = (...a: any[]) => o.push([m, ...a]); };
  ttq.methods.forEach((m: string) => ttq.setAndDefer(ttq, m));
  ttq.instance = (name: string) => { const inst = ttq._i[name] || []; ttq.methods.forEach((m: string) => ttq.setAndDefer(inst, m)); return inst; };
  ttq.load = (sdk: string) => {
    const url = "https://analytics.tiktok.com/i18n/pixel/events.js";
    ttq._i = ttq._i || {}; ttq._i[sdk] = []; ttq._i[sdk]._u = url; ttq._t = ttq._t || {}; ttq._t[sdk] = +new Date(); ttq._o = ttq._o || {}; ttq._o[sdk] = {};
    addScript(url + "?sdkid=" + encodeURIComponent(sdk) + "&lib=" + t);
  };
  ttq.load(id);
  loaded.tiktok_pixel = true;
}

/** Load newly-permitted providers and silence the ones whose consent was withdrawn. */
function applyConsent() {
  const c = cfg;
  if (allowed("meta_pixel")) { loadMeta(c.meta_pixel!.id); window.fbq?.("consent", "grant"); } else if (loaded.meta_pixel) window.fbq?.("consent", "revoke");
  if (allowed("ga4")) loadGa4(c.ga4!.id);
  else if (loaded.ga4 && c.ga4) { window[("ga-disable-" + c.ga4.id) as `ga-disable-${string}`] = true; window.gtag?.("consent", "update", { analytics_storage: "denied" }); }
  if (allowed("google_ads")) loadAds(c.google_ads!.id);
  else if (loaded.google_ads) window.gtag?.("consent", "update", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied" });
  if (allowed("tiktok_pixel")) { loadTikTok(c.tiktok_pixel!.id); window.ttq?.grantConsent?.(); } else if (loaded.tiktok_pixel) window.ttq?.revokeConsent?.();
}

export function setConsent(next: Consent | null, persist = true) {
  const withdrawn = !!consent && ((consent.analytics && !next?.analytics) || (consent.marketing && !next?.marketing));
  consent = next;
  if (persist) {
    try { next ? localStorage.setItem(CONSENT_KEY, JSON.stringify({ ...next, at: Date.now() })) : localStorage.removeItem(CONSENT_KEY); } catch { /* ignore */ }
  }
  if (withdrawn) { try { localStorage.removeItem("cod_attribution"); } catch { /* ignore */ } }
  applyConsent();
  notify();
}

/** Page views are de-duplicated per provider and path (route changes, consent granted late, React strict-mode). */
export function trackPageView(path: string) {
  const tag = (p: Provider) => p + ":" + path;
  const mark = (p: Provider) => { if (!allowed(p) || pageViews.has(tag(p))) return false; pageViews.add(tag(p)); return true; };
  if (mark("meta_pixel") && eventEnabled(cfg.meta_pixel!.events, "PageView")) window.fbq?.("track", "PageView");
  if (mark("ga4") && eventEnabled(cfg.ga4!.events, "page_view")) window.gtag?.("event", "page_view", { page_path: path });
  if (mark("tiktok_pixel")) window.ttq?.page?.();
  if (consent?.analytics && !pageViews.has("first:" + path)) { pageViews.add("first:" + path); post("PageView", {}, path); }
}

function post(ev: TrackEvent, d: TrackData, path = window.location.pathname) {
  try {
    const a = getAttribution();
    const body = JSON.stringify({
      event: ev, session: sessionId(), path: path.slice(0, 200), product_id: d.product_id, value: d.value,
      referrer: document.referrer ? new URL(document.referrer).hostname : undefined,
      utm_source: a.utm_source, utm_medium: a.utm_medium, utm_campaign: a.utm_campaign,
    });
    if (!navigator.sendBeacon?.("/api/events", new Blob([body], { type: "application/json" }))) {
      void fetch("/api/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
    }
  } catch { /* analytics must never break the shop */ }
}

const GA_NAME: Record<TrackEvent, string> = { PageView: "page_view", ViewContent: "view_item", Search: "search", AddToCart: "add_to_cart", RemoveFromCart: "remove_from_cart", InitiateCheckout: "begin_checkout", Lead: "generate_lead" };
const TT_NAME: Partial<Record<TrackEvent, string>> = { ViewContent: "ViewContent", Search: "Search", AddToCart: "AddToCart", InitiateCheckout: "InitiateCheckout", Lead: "SubmitForm" };

export function track(ev: TrackEvent, raw: TrackData = {}) {
  if (typeof window === "undefined" || ev === "PageView") return;
  const d = sanitize(raw);
  const { event_id, product_id, ...params } = d;
  if (consent?.analytics) post(ev, d);

  if (allowed("meta_pixel") && eventEnabled(cfg.meta_pixel!.events, ev)) {
    const custom = ev === "RemoveFromCart";
    window.fbq?.(custom ? "trackCustom" : "track", ev, { ...params, content_type: "product" }, event_id ? { eventID: event_id } : undefined);
  }
  if (allowed("ga4") && eventEnabled(cfg.ga4!.events, GA_NAME[ev])) {
    window.gtag?.("event", GA_NAME[ev], {
      value: params.value, currency: params.currency, search_term: params.search_string,
      items: params.content_ids?.map((id) => ({ item_id: id, item_name: params.content_name })),
    });
  }
  const ads = cfg.google_ads;
  if (ev === "Lead" && allowed("google_ads") && ads?.conversionLabel) {
    window.gtag?.("event", "conversion", { send_to: ads.id + "/" + ads.conversionLabel, value: params.value, currency: params.currency, transaction_id: event_id });
  }
  const tt = TT_NAME[ev];
  if (tt && allowed("tiktok_pixel") && eventEnabled(cfg.tiktok_pixel!.events, tt)) {
    window.ttq?.track?.(tt, { value: params.value, currency: params.currency, content_id: params.content_ids?.[0], content_name: params.content_name, query: params.search_string });
  }
}

/** Test helper: reset module state. */
export function __resetTrackingForTests() {
  cfg = {}; consent = null; pageViews.clear(); session = null; listeners.clear(); gtagScriptAdded = false;
  (Object.keys(loaded) as Provider[]).forEach((k) => delete loaded[k]);
}
export { ID_PATTERNS };
