import { z } from "zod";

export const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
/** Top-level URL segments owned by the app: a product slug equal to one of them would be unreachable. Mirrors products_slug_not_reserved (migration 004). */
export const RESERVED_SLUGS = ["admin", "api", "shop", "cart", "checkout", "category", "p", "order-confirmation", "sitemap", "robots", "favicon"] as const;
const nullableText = (max: number) => z.string().trim().max(max).nullish().transform((v) => (v ? v : null));
const nullableInt = z.number().int().min(0).max(100_000_000).nullish().transform((v) => v ?? null);
/** Images must be local (/path) or live in our Supabase Storage — next/image only optimises those hosts. */
export function isAllowedMediaUrl(url: string, supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL): boolean {
  if (/^\/(?!\/)/.test(url)) return true;
  if (!supabaseUrl) return /^https:\/\//.test(url);
  try {
    const u = new URL(url), base = new URL(supabaseUrl);
    return u.host === base.host && u.pathname.startsWith("/storage/v1/object/public/");
  } catch { return false; }
}
const mediaUrl = z.string().max(2000).refine((u) => isAllowedMediaUrl(u), "URL d'image non autorisée (utilisez l'upload).");
const nullableMedia = mediaUrl.nullish().transform((v) => v ?? null);

export const variantInput = z.object({
  id: z.string().uuid().optional(),
  client_key: z.string().max(60).optional(),
  key: z.string().regex(SLUG_RE).max(60),
  name: z.string().trim().min(1).max(100),
  name_ar: nullableText(100),
  color_hex: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullish().transform((v) => v ?? null),
  sku: nullableText(64),
  price_override: nullableInt,
  stock_quantity: z.number().int().min(0).max(1_000_000).default(0),
  is_available: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

export const imageInput = z.object({
  url: mediaUrl,
  storage_path: nullableText(500),
  alt: z.string().trim().max(200).default(""),
  variant_id: z.string().uuid().nullish().transform((v) => v ?? null),
  variant_client_key: z.string().max(60).nullish().transform((v) => v ?? null),
  sort_order: z.number().int().min(0).default(0),
});

export const productInput = z
  .object({
    id: z.string().uuid().optional(),
    slug: z.string().regex(SLUG_RE, "Slug invalide (minuscules, chiffres et tirets)").max(120).refine((v) => !(RESERVED_SLUGS as readonly string[]).includes(v), "Ce slug est réservé par la boutique."),
    name: z.string().trim().min(1).max(200),
    description: nullableText(5000),
    price: z.number().int().min(0).max(10_000_000),
    compare_at_price: nullableInt,
    sku: nullableText(64),
    status: z.enum(["draft", "active", "archived"]),
    rating: z.number().min(0).max(5).nullish().transform((v) => v ?? null),
    benefits: z.array(z.string().trim().min(1).max(200)).max(10).default([]),
    translations: z
      .object({
        ar: z
          .object({
            name: z.string().trim().max(200).optional(),
            description: z.string().trim().max(5000).optional(),
            benefits: z.array(z.string().trim().min(1).max(200)).max(10).optional(),
          })
          .optional(),
      })
      .default({}),
    tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
    delivery_available: z.boolean().default(true),
    track_inventory: z.boolean().default(true),
    stock_quantity: z.number().int().min(0).max(1_000_000).default(0),
    low_stock_threshold: z.number().int().min(0).max(100_000).default(5),
    seo_title: nullableText(70),
    seo_description: nullableText(200),
    og_image_url: nullableMedia,
    variants: z.array(variantInput).max(30).default([]),
    images: z.array(imageInput).max(20).default([]),
    category_ids: z.array(z.string().uuid()).max(30).default([]),
  })
  .refine((p) => p.compare_at_price === null || p.compare_at_price >= p.price, {
    message: "Le prix barré doit être supérieur ou égal au prix.",
    path: ["compare_at_price"],
  })
  .refine((p) => new Set(p.variants.map((v) => v.key)).size === p.variants.length, {
    message: "Deux variantes ont le même identifiant.",
    path: ["variants"],
  });

export type ProductInput = z.input<typeof productInput>;

export const categoryInput = z.object({
  kind: z.enum(["category", "collection"]).default("category"),
  slug: z.string().regex(SLUG_RE).max(120),
  name: z.string().trim().min(1).max(120),
  name_ar: nullableText(120),
  description: nullableText(1000),
  description_ar: nullableText(1000),
  image_url: nullableMedia,
  sort_order: z.number().int().min(0).max(10_000).default(0),
  is_active: z.boolean().default(true),
  seo_title: nullableText(70),
  seo_description: nullableText(200),
});

export const stockAdjustInput = z.object({
  product_id: z.string().uuid(),
  variant_id: z.string().uuid().nullish().transform((v) => v ?? null),
  delta: z.number().int().refine((n) => n !== 0, "Variation nulle").refine((n) => Math.abs(n) <= 100_000),
  reason: z.enum(["restock", "correction", "damage", "return"]),
  note: z.string().trim().max(300).nullish().transform((v) => v ?? null),
});

export const statusInput = z.object({
  status: z.enum(["confirmed", "processing", "shipped", "delivered", "cancelled", "returned"]),
  note: z.string().trim().max(300).optional(),
});

export const customerInput = z.object({
  notes: nullableText(2000),
  tags: z.array(z.string().trim().min(1).max(30)).max(15).default([]),
});

export const discountInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "Code : 3 à 32 caractères A-Z, 0-9, _ ou -"),
    type: z.enum(["percent", "fixed"]),
    value: z.number().int().min(1).max(10_000_000),
    min_subtotal: z.number().int().min(0).max(100_000_000).default(0),
    starts_at: z.string().datetime({ offset: true }).nullish().transform((v) => v ?? null),
    ends_at: z.string().datetime({ offset: true }).nullish().transform((v) => v ?? null),
    usage_limit: z.number().int().min(1).max(10_000_000).nullish().transform((v) => v ?? null),
    is_active: z.boolean().default(true),
  })
  .refine((d) => d.type !== "percent" || d.value <= 100, { message: "Un pourcentage ne peut pas dépasser 100.", path: ["value"] })
  .refine((d) => !d.starts_at || !d.ends_at || d.ends_at > d.starts_at, { message: "La fin doit être après le début.", path: ["ends_at"] });

import { ID_PATTERNS, ADS_LABEL_PATTERN, META_TEST_CODE_PATTERN, PROVIDERS, PROVIDER_META, type Provider } from "./tracking-config";

/** Tracking integration input: only a validated identifier + predefined toggles. No script, no free-form HTML, ever. */
export function trackingInput(provider: Provider) {
  const eventKeys = PROVIDER_META[provider].events.map((e) => e.key);
  return z
    .object({
      enabled: z.boolean(),
      public_id: z.string().trim().nullish().transform((v) => (v ? v : null)),
      events: z.record(z.string(), z.boolean()).default({}),
      conversion_label: z.string().trim().nullish().transform((v) => (v ? v : null)),
      test_event_code: z.string().trim().nullish().transform((v) => (v ? v : null)),
    })
    .superRefine((d, ctx) => {
      if (d.public_id && !ID_PATTERNS[provider].test(d.public_id)) ctx.addIssue({ code: "custom", path: ["public_id"], message: "Format d'identifiant invalide pour " + PROVIDER_META[provider].label + " (ex. " + PROVIDER_META[provider].example + ")." });
      if (d.enabled && !d.public_id) ctx.addIssue({ code: "custom", path: ["public_id"], message: "Renseignez l'identifiant avant d'activer." });
      for (const k of Object.keys(d.events)) if (!eventKeys.includes(k)) ctx.addIssue({ code: "custom", path: ["events", k], message: "Événement inconnu : " + k });
      if (d.conversion_label && (provider !== "google_ads" || !ADS_LABEL_PATTERN.test(d.conversion_label))) ctx.addIssue({ code: "custom", path: ["conversion_label"], message: "Libellé de conversion invalide." });
      if (d.test_event_code && (provider !== "meta_pixel" || !META_TEST_CODE_PATTERN.test(d.test_event_code))) ctx.addIssue({ code: "custom", path: ["test_event_code"], message: "Code de test invalide (ex. TEST12345)." });
    });
}
export const isProvider = (p: string): p is Provider => (PROVIDERS as readonly string[]).includes(p);

const phone = z.string().trim().regex(/^\+?[0-9 ()-]{6,20}$/, "Numéro invalide").nullish().transform((v) => v || null);
const httpsUrl = z.string().trim().url().regex(/^https:\/\//, "URL https requise").max(300).nullish().transform((v) => v || null);

export const SETTING_SCHEMAS = {
  "store.name": z.string().trim().min(1).max(80),
  "store.logo_url": nullableMedia,
  "store.favicon_url": nullableMedia,
  "store.contact": z.object({ phone, whatsapp: phone, email: z.string().trim().email().max(120).nullish().transform((v) => v || null) }),
  "store.social": z.object({ instagram: httpsUrl, facebook: httpsUrl, tiktok: httpsUrl }),
  "store.announcement": z.object({ enabled: z.boolean(), text_fr: z.string().trim().max(160).default(""), text_ar: z.string().trim().max(160).default("") }),
  "store.seo": z.object({ title_suffix: z.string().trim().max(60).default(""), description: z.string().trim().max(200).default(""), og_image: nullableMedia }),
  "shipping.free_over": z.number().int().min(1).max(100_000_000).nullable(),
  "home.layout": z.object({ single_product_redirect: z.boolean(), featured_count: z.number().int().min(1).max(24) }),
} as const;
export type SettingKey = keyof typeof SETTING_SCHEMAS;

const loc = z.object({ title: z.string().trim().max(120).default(""), subtitle: z.string().trim().max(240).default(""), cta: z.string().trim().max(40).default("") });
export const CONTENT_SCHEMAS = {
  hero: z.object({ image_url: nullableMedia, fr: loc, ar: loc }),
  featured: z.object({ fr: loc.pick({ title: true }), ar: loc.pick({ title: true }) }),
  categories: z.object({ fr: loc.pick({ title: true }), ar: loc.pick({ title: true }) }),
  trust: z.object({ items: z.array(z.object({ fr: z.string().trim().min(1).max(80), ar: z.string().trim().max(80).default("") })).max(6) }),
} as const;
export type ContentKey = keyof typeof CONTENT_SCHEMAS;

export const pageInput = z.object({
  slug: z.string().regex(SLUG_RE).max(60),
  title: z.string().trim().min(1).max(120),
  title_ar: nullableText(120),
  body: z.string().max(20000).default(""),
  body_ar: nullableText(20000),
  is_published: z.boolean().default(true),
  show_in_footer: z.boolean().default(true),
  sort_order: z.number().int().min(0).max(1000).default(0),
});

export const shippingInput = z.object({
  rates: z.array(z.object({ wilaya_code: z.string().regex(/^\d{2}$/), home_fee: z.number().int().min(0).max(1_000_000), stopdesk_fee: z.number().int().min(0).max(1_000_000), is_active: z.boolean() })).min(1).max(58),
});

export const teamInvite = z.object({ email: z.string().trim().toLowerCase().email().max(120), role: z.enum(["owner", "manager", "order_operator"]), display_name: z.string().trim().max(80).optional() });
export const teamUpdate = z.object({ role: z.enum(["owner", "manager", "order_operator"]).optional(), display_name: z.string().trim().max(80).optional() });
