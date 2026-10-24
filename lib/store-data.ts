import { cache } from "react";
import { getPublicSupabase } from "@/lib/supabase-public";

export type StoreSettings = {
  name: string; logoUrl: string | null; faviconUrl: string | null;
  contact: { phone: string | null; email: string | null; whatsapp: string | null };
  social: { instagram: string | null; facebook: string | null; tiktok: string | null };
  announcement: { enabled: boolean; text_fr: string; text_ar: string };
  seo: { title_suffix: string; description: string; og_image: string | null };
  freeOver: number | null;
  home: { single_product_redirect: boolean; featured_count: number };
};

export const DEFAULT_SETTINGS: StoreSettings = {
  name: "COD Store", logoUrl: null, faviconUrl: null,
  contact: { phone: null, email: null, whatsapp: null }, social: { instagram: null, facebook: null, tiktok: null },
  announcement: { enabled: false, text_fr: "", text_ar: "" },
  seo: { title_suffix: "COD Store", description: "", og_image: null }, freeOver: null,
  home: { single_product_redirect: true, featured_count: 8 },
};

const str = (v: unknown, d: string) => (typeof v === "string" ? v : d);
const nstr = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Pure mapping (unit-tested): rows from store_settings -> typed settings, tolerant of missing/invalid values. */
export function mapSettings(rows: { key: string; value: unknown }[]): StoreSettings {
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const o = (k: string) => (m.get(k) && typeof m.get(k) === "object" ? (m.get(k) as Record<string, unknown>) : {});
  const c = o("store.contact"), so = o("store.social"), a = o("store.announcement"), seo = o("store.seo"), h = o("home.layout");
  const free = m.get("shipping.free_over");
  return {
    name: str(m.get("store.name"), DEFAULT_SETTINGS.name),
    logoUrl: nstr(m.get("store.logo_url")), faviconUrl: nstr(m.get("store.favicon_url")),
    contact: { phone: nstr(c.phone), email: nstr(c.email), whatsapp: nstr(c.whatsapp) },
    social: { instagram: nstr(so.instagram), facebook: nstr(so.facebook), tiktok: nstr(so.tiktok) },
    announcement: { enabled: a.enabled === true, text_fr: str(a.text_fr, ""), text_ar: str(a.text_ar, "") },
    seo: { title_suffix: str(seo.title_suffix, DEFAULT_SETTINGS.seo.title_suffix), description: str(seo.description, ""), og_image: nstr(seo.og_image) },
    freeOver: typeof free === "number" && free > 0 ? free : null,
    home: { single_product_redirect: h.single_product_redirect !== false, featured_count: typeof h.featured_count === "number" ? Math.max(1, Math.min(24, h.featured_count)) : 8 },
  };
}

export const getSettings = cache(async (): Promise<StoreSettings> => {
  const { data, error } = await getPublicSupabase().from("store_settings").select("key, value").eq("is_public", true);
  if (error) { console.error("settings:", error.message); return DEFAULT_SETTINGS; }
  return mapSettings(data ?? []);
});

export type StorePage = { slug: string; title: string; title_ar: string | null; body: string; body_ar: string | null; show_in_footer: boolean; sort_order: number };

export const getFooterPages = cache(async (): Promise<Pick<StorePage, "slug" | "title" | "title_ar">[]> => {
  const { data } = await getPublicSupabase().from("store_pages").select("slug, title, title_ar").eq("is_published", true).eq("show_in_footer", true).order("sort_order");
  return data ?? [];
});

export async function getStorePage(slug: string): Promise<StorePage | null> {
  const { data } = await getPublicSupabase().from("store_pages").select("slug, title, title_ar, body, body_ar, show_in_footer, sort_order").eq("slug", slug).eq("is_published", true).maybeSingle();
  return data ?? null;
}

export type HomeSection = { section_key: string; sort_order: number; content: Record<string, unknown> };
export async function getHomeSections(): Promise<HomeSection[]> {
  const { data } = await getPublicSupabase().from("content_sections").select("section_key, sort_order, content").eq("page", "home").eq("is_visible", true).order("sort_order");
  return (data ?? []) as HomeSection[];
}

export type CategoryCard = { id: string; slug: string; name: string; name_ar: string | null; description: string | null; description_ar: string | null; image_url: string | null; seo_title: string | null; seo_description: string | null };
export async function getCategories(): Promise<CategoryCard[]> {
  const { data } = await getPublicSupabase().from("categories").select("id, slug, name, name_ar, description, description_ar, image_url, seo_title, seo_description").eq("is_active", true).order("sort_order").order("name");
  return data ?? [];
}
export async function getCategoryBySlug(slug: string): Promise<CategoryCard | null> {
  const { data } = await getPublicSupabase().from("categories").select("id, slug, name, name_ar, description, description_ar, image_url, seo_title, seo_description").eq("slug", slug).eq("is_active", true).maybeSingle();
  return data ?? null;
}

export type CardProduct = { id: string; slug: string; name: string; name_ar: string | null; price: number; compare_at_price: number | null; image: string | null; soldOut: boolean };
export type Sort = "new" | "price_asc" | "price_desc" | "name";
export const PAGE_SIZE = 12;

/** Pure: sanitises a user search string before it is placed in a PostgREST .or() filter. */
export function cleanSearch(q: string | undefined): string {
  return (q ?? "").replace(/[%,()*\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}

export async function listProducts(opts: { q?: string; categoryId?: string; sort?: Sort; page?: number; limit?: number }): Promise<{ items: CardProduct[]; total: number }> {
  const page = Math.max(1, opts.page ?? 1), limit = opts.limit ?? PAGE_SIZE;
  let query = getPublicSupabase()
    .from("products")
    .select("id, slug, name, translations, price, compare_at_price, track_inventory, stock_quantity, published_at, product_variants(stock_quantity, is_available), product_images(url, sort_order)" + (opts.categoryId ? ", product_categories!inner(category_id)" : ""), { count: "exact" })
    .eq("status", "active");
  if (opts.categoryId) query = query.eq("product_categories.category_id", opts.categoryId);
  const q = cleanSearch(opts.q);
  if (q) query = query.or("name.ilike.%" + q + "%,description.ilike.%" + q + "%");
  const sort = opts.sort ?? "new";
  query = sort === "price_asc" ? query.order("price", { ascending: true }) : sort === "price_desc" ? query.order("price", { ascending: false }) : sort === "name" ? query.order("name") : query.order("published_at", { ascending: false });
  const { data, count, error } = await query.range((page - 1) * limit, page * limit - 1);
  if (error) { console.error("listProducts:", error.message); return { items: [], total: 0 }; }
  type Row = { id: string; slug: string; name: string; translations: { ar?: { name?: string } } | null; price: number; compare_at_price: number | null; track_inventory: boolean; stock_quantity: number; product_variants: { stock_quantity: number; is_available: boolean }[]; product_images: { url: string; sort_order: number }[] };
  const items = ((data ?? []) as unknown as Row[]).map((r) => {
    const sold = r.product_variants.length > 0 ? r.product_variants.every((v) => !v.is_available || (r.track_inventory && v.stock_quantity <= 0)) : r.track_inventory && r.stock_quantity <= 0;
    const img = [...r.product_images].sort((a, b) => a.sort_order - b.sort_order)[0]?.url ?? null;
    return { id: r.id, slug: r.slug, name: r.name, name_ar: r.translations?.ar?.name ?? null, price: r.price, compare_at_price: r.compare_at_price, image: img, soldOut: sold };
  });
  return { items, total: count ?? 0 };
}
