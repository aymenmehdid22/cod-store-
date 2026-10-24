// Verifies that what the admin form sends (after zod parsing) is accepted by public.admin_save_product().
// Usage: npx tsx scripts/contract-test.ts | psql -v ON_ERROR_STOP=1 <db>   (db = migrated scratch database)
import { productInput } from "../lib/admin-schemas";

const raw = {
  slug: "contract-cap", name: "Contract cap", description: null, price: 1500, compare_at_price: null, sku: null,
  status: "active", rating: null, benefits: ["Livraison"], tags: [], translations: { ar: { name: "قبعة" } },
  delivery_available: true, track_inventory: true, stock_quantity: 0, low_stock_threshold: 5,
  seo_title: null, seo_description: null, og_image_url: null,
  variants: [
    { client_key: "n1", key: "noir", name: "Noir", name_ar: null, color_hex: "#161616", sku: null, price_override: null, stock_quantity: 4, is_available: true, sort_order: 0 },
  ],
  images: [{ url: "https://x.supabase.co/storage/v1/object/public/product-images/products/a.webp", storage_path: "products/a.webp", alt: "", variant_client_key: "n1", sort_order: 0 }],
  category_ids: [],
};
const bad = productInput.safeParse({ ...raw, compare_at_price: 10 });
if (bad.success) throw new Error("compare_at_price < price must be rejected");
const ok = productInput.parse(raw);
const sql = "select pg_temp.chk((select public.admin_save_product($j$" + JSON.stringify(ok) + "$j$::jsonb)));";
console.log("set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',true);");
console.log("create or replace function pg_temp.chk(i uuid) returns text language plpgsql as $$ begin if (select count(*) from product_variants where product_id=i)=1 and (select variant_id is not null from product_images where product_id=i) and (select quantity_after from inventory_movements where product_id=i)=4 then return 'CONTRACT OK'; end if; raise exception 'contract mismatch'; end $$;");
console.log(sql);
