// Shared (server + client) definitions for tracking integrations.
// Only validated identifiers and predefined toggles are ever accepted — never free-form JavaScript.

export const PROVIDERS = ["meta_pixel", "ga4", "google_ads", "tiktok_pixel"] as const;
export type Provider = (typeof PROVIDERS)[number];

/** Mirrors the CHECK constraint `tracking_id_format` in migration 002. */
export const ID_PATTERNS: Record<Provider, RegExp> = {
  meta_pixel: /^[0-9]{10,20}$/,
  ga4: /^G-[A-Z0-9]{6,12}$/,
  google_ads: /^AW-[0-9]{6,14}$/,
  tiktok_pixel: /^[A-Z0-9]{10,30}$/,
};
export const ADS_LABEL_PATTERN = /^[A-Za-z0-9_-]{6,40}$/;
export const META_TEST_CODE_PATTERN = /^TEST[A-Z0-9]{1,12}$/;

export const PROVIDER_META: Record<Provider, { label: string; idLabel: string; example: string; category: ConsentCategory; events: { key: string; label: string; note?: string }[]; help: string }> = {
  meta_pixel: {
    label: "Meta Pixel", idLabel: "Pixel ID", example: "1234567890123456", category: "marketing",
    events: [
      { key: "PageView", label: "PageView" }, { key: "ViewContent", label: "ViewContent" }, { key: "Search", label: "Search" },
      { key: "AddToCart", label: "AddToCart" }, { key: "RemoveFromCart", label: "RemoveFromCart (personnalisé)" },
      { key: "InitiateCheckout", label: "InitiateCheckout" }, { key: "Lead", label: "Lead (commande passée)", note: "Aussi envoyé côté serveur (API Conversions) avec le même event_id pour dédoublonnage — uniquement si le client a accepté le marketing." },
      { key: "Purchase", label: "Purchase (commande LIVRÉE)", note: "Envoyé UNIQUEMENT côté serveur (API Conversions) quand la commande passe à « Livrée ». Nécessite META_ACCESS_TOKEN." },
    ],
    help: "Events Manager → Sources de données → votre pixel. Pour tester, saisissez un « code d'événement de test » : les événements serveur y apparaîtront dans l'onglet Tester les événements.",
  },
  ga4: {
    label: "Google Analytics 4", idLabel: "Measurement ID", example: "G-ABC123XYZ9", category: "analytics",
    events: [
      { key: "page_view", label: "page_view" }, { key: "view_item", label: "view_item" }, { key: "search", label: "search" },
      { key: "add_to_cart", label: "add_to_cart" }, { key: "remove_from_cart", label: "remove_from_cart" },
      { key: "begin_checkout", label: "begin_checkout" }, { key: "generate_lead", label: "generate_lead (commande passée)" },
    ],
    help: "Admin GA4 → Flux de données → Web. Vérifiez dans Rapports → Temps réel ou DebugView. Aucun événement « purchase » n'est envoyé : en paiement à la livraison, une commande passée n'est pas un revenu encaissé.",
  },
  google_ads: {
    label: "Google Ads", idLabel: "ID de conversion", example: "AW-123456789", category: "marketing",
    events: [],
    help: "Google Ads → Objectifs → Conversions → détails de la balise. Le libellé de conversion est déclenché à chaque commande passée (Lead). Vérifiez avec l'Assistant de balise Google.",
  },
  tiktok_pixel: {
    label: "TikTok Pixel", idLabel: "Pixel ID", example: "C1A2B3C4D5E6F7G8H9", category: "marketing",
    events: [
      { key: "ViewContent", label: "ViewContent" }, { key: "Search", label: "Search" }, { key: "AddToCart", label: "AddToCart" },
      { key: "InitiateCheckout", label: "InitiateCheckout" }, { key: "SubmitForm", label: "SubmitForm (commande passée)" },
    ],
    help: "TikTok Events Manager → Web Events. Vérifiez avec l'extension Pixel Helper.",
  },
};

export type ConsentCategory = "analytics" | "marketing";
export type Consent = { analytics: boolean; marketing: boolean };

export type PublicTrackingConfig = Partial<Record<Provider, { id: string; events: Record<string, boolean>; conversionLabel?: string }>>;

/** Event toggles default to ON when absent, except server-only Purchase which must be enabled explicitly. */
export function eventEnabled(events: Record<string, boolean> | undefined, key: string): boolean {
  if (key === "Purchase") return events?.[key] === true;
  return events?.[key] !== false;
}

type Row = { provider: string; enabled: boolean; public_id: string | null; config: { events?: Record<string, boolean>; conversion_label?: string | null; test_event_code?: string | null } | null };

/** DB rows -> public config. IDs are re-validated here (defence in depth) so a bad row can never reach a <script> URL. */
export function toPublicConfig(rows: Row[]): PublicTrackingConfig {
  const out: PublicTrackingConfig = {};
  for (const r of rows) {
    if (!r.enabled || !r.public_id) continue;
    if (!(PROVIDERS as readonly string[]).includes(r.provider)) continue;
    const p = r.provider as Provider;
    if (!ID_PATTERNS[p].test(r.public_id)) continue;
    const label = r.config?.conversion_label;
    out[p] = { id: r.public_id, events: r.config?.events ?? {}, ...(p === "google_ads" && label && ADS_LABEL_PATTERN.test(label) ? { conversionLabel: label } : {}) };
  }
  return out;
}

export function consentNeeded(cfg: PublicTrackingConfig): boolean {
  return PROVIDERS.some((p) => !!cfg[p]);
}
