import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ProductForm, { type ProductFormData } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireAdminPage("catalog.write");
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const supabase = createClient();
  const [{ data: p }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*, product_variants(*), product_images(*), product_categories(category_id)").eq("id", params.id).maybeSingle(),
    supabase.from("categories").select("id, name").order("sort_order").order("name"),
  ]);
  if (!p) notFound();

  const variants = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  const ar = (p.translations?.ar ?? {}) as { name?: string; description?: string; benefits?: string[] };
  const initial: ProductFormData = {
    id: p.id, slug: p.slug, name: p.name, description: p.description ?? "", price: String(p.price),
    compare_at_price: p.compare_at_price == null ? "" : String(p.compare_at_price), sku: p.sku ?? "", status: p.status,
    rating: p.rating == null ? "" : String(p.rating), benefits: (p.benefits as string[]).join("\n"), tags: (p.tags as string[]).join(", "),
    delivery_available: p.delivery_available, track_inventory: p.track_inventory,
    stock_quantity: String(p.stock_quantity), low_stock_threshold: String(p.low_stock_threshold),
    seo_title: p.seo_title ?? "", seo_description: p.seo_description ?? "", og_image_url: p.og_image_url ?? "",
    ar_name: ar.name ?? "", ar_description: ar.description ?? "", ar_benefits: (ar.benefits ?? []).join("\n"),
    variants: variants.map((v) => ({
      client_key: v.id, id: v.id, key: v.key, name: v.name, name_ar: v.name_ar ?? "", color_hex: v.color_hex ?? "",
      sku: v.sku ?? "", price_override: v.price_override == null ? "" : String(v.price_override),
      stock_quantity: String(v.stock_quantity), is_available: v.is_available,
    })),
    images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order).map((i) => ({
      url: i.url, storage_path: i.storage_path, alt: i.alt, variant_ref: i.variant_id ?? "",
    })),
    category_ids: p.product_categories.map((c: { category_id: string }) => c.category_id),
  };

  return (
    <div className="max-w-3xl">
      <PageHeader title={p.name} crumbs={[{ label: "Admin", href: "/admin" }, { label: "Produits", href: "/admin/products" }, { label: p.name }]} />
      <ProductForm initial={initial} categories={categories ?? []} />
    </div>
  );
}
