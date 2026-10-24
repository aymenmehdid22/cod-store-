import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ProductForm, { EMPTY_PRODUCT } from "@/components/admin/ProductForm";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  await requireAdminPage("catalog.write");
  const { data: categories } = await createClient().from("categories").select("id, name").order("sort_order").order("name");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Nouveau produit" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Produits", href: "/admin/products" }, { label: "Nouveau" }]} />
      <ProductForm initial={EMPTY_PRODUCT} categories={categories ?? []} />
    </div>
  );
}
