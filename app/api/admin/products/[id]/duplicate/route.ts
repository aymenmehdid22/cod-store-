import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Duplicates a product as a DRAFT with zero stock. Image files are shared by URL (storage_path is NOT copied),
// so deleting the copy can never delete the original's files.
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });

  const { data: p } = await auth.supabase
    .from("products")
    .select("*, product_variants(*), product_images(*), product_categories(category_id)")
    .eq("id", params.id)
    .maybeSingle();
  if (!p) return NextResponse.json({ error: "Introuvable." }, { status: 404 });

  const variants = [...p.product_variants].sort((a, b) => a.sort_order - b.sort_order);
  const keyOf = new Map<string, string>(variants.map((v, i) => [v.id as string, "v" + i]));

  for (let attempt = 1; attempt <= 5; attempt++) {
    const suffix = attempt === 1 ? "-copy" : "-copy-" + attempt;
    const payload = {
      slug: (p.slug + suffix).slice(0, 120),
      name: p.name + " (copie)",
      description: p.description, price: p.price, compare_at_price: p.compare_at_price, sku: null,
      status: "draft", rating: p.rating, benefits: p.benefits, translations: p.translations, tags: p.tags,
      delivery_available: p.delivery_available, track_inventory: p.track_inventory, stock_quantity: 0,
      low_stock_threshold: p.low_stock_threshold, seo_title: p.seo_title, seo_description: p.seo_description,
      og_image_url: p.og_image_url,
      variants: variants.map((v, i) => ({
        client_key: "v" + i, key: v.key, name: v.name, name_ar: v.name_ar, color_hex: v.color_hex, sku: null,
        price_override: v.price_override, stock_quantity: 0, is_available: v.is_available, sort_order: v.sort_order,
      })),
      images: [...p.product_images].sort((a, b) => a.sort_order - b.sort_order).map((im, i) => ({
        url: im.url, storage_path: null, alt: im.alt, sort_order: i,
        variant_client_key: im.variant_id ? keyOf.get(im.variant_id) ?? null : null,
      })),
      category_ids: p.product_categories.map((c: { category_id: string }) => c.category_id),
    };
    const { data, error } = await auth.supabase.rpc("admin_save_product", { p: payload });
    if (!error) return NextResponse.json({ id: data }, { status: 201 });
    if (error.code !== "23505") return rpcError(error); // only retry on slug collision
  }
  return NextResponse.json({ error: "Impossible de générer un slug unique." }, { status: 409 });
}
