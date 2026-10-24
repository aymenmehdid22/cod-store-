import type { Product, ProductImage, ProductVariant } from "@/types/product";
import { getPublicSupabase } from "@/lib/supabase-public";

type Row = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  currency: string;
  rating: number | null;
  benefits: string[] | null;
  translations: Product["translations"] | null;
  delivery_available: boolean;
  track_inventory: boolean;
  stock_quantity: number;
  seo_title: string | null;
  seo_description: string | null;
  og_image_url: string | null;
  product_variants: {
    id: string;
    key: string;
    name: string;
    name_ar: string | null;
    color_hex: string | null;
    price_override: number | null;
    stock_quantity: number;
    is_available: boolean;
    sort_order: number;
  }[];
  product_images: { id: string; variant_id: string | null; url: string; alt: string; sort_order: number }[];
};

const SELECT =
  "id, slug, name, description, price, compare_at_price, currency, rating, benefits, translations, delivery_available, track_inventory, stock_quantity, seo_title, seo_description, og_image_url, " +
  "product_variants(id, key, name, name_ar, color_hex, price_override, stock_quantity, is_available, sort_order), " +
  "product_images(id, variant_id, url, alt, sort_order)";

export type CatalogProduct = Product & { seoTitle?: string; seoDescription?: string; ogImage?: string };

/** DB row -> the Product shape the storefront components already use. */
function toProduct(r: Row): CatalogProduct {
  const variants = [...r.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  const tracked = r.track_inventory;
  const mappedVariants: ProductVariant[] = variants.map((v) => ({
    id: v.id,
    name: v.name,
    color: v.color_hex ?? undefined,
    images: [],
    available: v.is_available && (!tracked || v.stock_quantity > 0),
    stock: tracked ? v.stock_quantity : undefined,
    price: v.price_override ?? undefined,
  }));
  const images: ProductImage[] = [...r.product_images]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((i) => ({ id: i.id, url: i.url, alt: i.alt, variantId: i.variant_id ?? undefined }));

  const stock = !tracked
    ? undefined
    : variants.length > 0
      ? variants.filter((v) => v.is_available).reduce((n, v) => n + v.stock_quantity, 0)
      : r.stock_quantity;
  const soldOut = variants.length > 0 ? mappedVariants.every((v) => !v.available) : tracked && r.stock_quantity <= 0;

  const variantNamesAr: Record<string, string> = {};
  variants.forEach((v) => {
    if (v.name_ar) variantNamesAr[v.id] = v.name_ar;
  });
  const translations = { ...(r.translations ?? {}) };
  if (Object.keys(variantNamesAr).length > 0) {
    translations.ar = { ...(translations.ar ?? {}), variants: variantNamesAr };
  }

  return {
    id: r.id,
    name: r.name,
    slug: r.slug,
    description: r.description ?? undefined,
    price: r.price,
    oldPrice: r.compare_at_price ?? undefined,
    currency: "DZD",
    rating: r.rating ?? undefined,
    images,
    variants: mappedVariants,
    benefits: r.benefits ?? [],
    deliveryAvailable: r.delivery_available,
    stock,
    soldOut,
    translations,
    seoTitle: r.seo_title ?? undefined,
    seoDescription: r.seo_description ?? undefined,
    ogImage: r.og_image_url ?? undefined,
  };
}

/** RLS already restricts anon to status = 'active'; the filter is repeated for clarity. */
export async function getActiveProducts(): Promise<CatalogProduct[]> {
  const { data, error } = await getPublicSupabase()
    .from("products")
    .select(SELECT)
    .eq("status", "active")
    .order("published_at", { ascending: true });
  if (error) {
    console.error("catalog: getActiveProducts failed", error.message);
    return [];
  }
  return (data as unknown as Row[]).map(toProduct);
}

export async function getProductBySlug(slug: string): Promise<CatalogProduct | null> {
  const { data, error } = await getPublicSupabase()
    .from("products")
    .select(SELECT)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error) {
    console.error("catalog: getProductBySlug failed", error.message);
    return null;
  }
  return data ? toProduct(data as unknown as Row) : null;
}
