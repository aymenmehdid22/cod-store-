import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import CategoriesManager, { type CategoryRow } from "@/components/admin/CategoriesManager";

export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  await requireAdminPage("catalog.write");
  const supabase = createClient();
  const { data } = await supabase.from("categories").select("*, product_categories(count)").order("sort_order").order("name");
  const rows: CategoryRow[] = (data ?? []).map((c) => ({
    id: c.id, kind: c.kind, slug: c.slug, name: c.name, name_ar: c.name_ar, description: c.description, description_ar: c.description_ar,
    image_url: c.image_url, sort_order: c.sort_order, is_active: c.is_active, seo_title: c.seo_title, seo_description: c.seo_description,
    product_count: (c.product_categories as { count: number }[])?.[0]?.count ?? 0,
  }));
  return (
    <div>
      <PageHeader title="Catégories & collections" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Catégories" }]} />
      <CategoriesManager rows={rows} />
    </div>
  );
}
