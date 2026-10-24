import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader, Pagination, EmptyState } from "@/components/admin/ui";
import ProductsTable, { type ProductRow } from "@/components/admin/ProductsTable";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 20;

export default async function ProductsPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string } }) {
  await requireAdminPage("catalog.write");
  const supabase = createClient();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const status = ["draft", "active", "archived"].includes(searchParams.status ?? "") ? searchParams.status : undefined;

  let query = supabase
    .from("products")
    .select("id, slug, name, price, status, sku, track_inventory, stock_quantity, low_stock_threshold, updated_at, product_variants(stock_quantity, is_available), product_images(url, sort_order)", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const q = (searchParams.q ?? "").replace(/[%,()*\\]/g, "").trim().slice(0, 60);
  if (q) query = query.or("name.ilike.%" + q + "%,slug.ilike.%" + q + "%,sku.ilike.%" + q + "%");

  const { data, count, error } = await query;
  const rows: ProductRow[] = (data ?? []).map((p) => {
    const variants = p.product_variants as { stock_quantity: number }[];
    const stock = !p.track_inventory ? null : variants.length > 0 ? variants.reduce((n, v) => n + v.stock_quantity, 0) : p.stock_quantity;
    const imgs = [...(p.product_images as { url: string; sort_order: number }[])].sort((a, b) => a.sort_order - b.sort_order);
    return { id: p.id, slug: p.slug, name: p.name, price: p.price, status: p.status, sku: p.sku, stock, low: stock !== null && stock <= p.low_stock_threshold, image: imgs[0]?.url ?? null, updated_at: p.updated_at };
  });

  return (
    <div>
      <PageHeader
        title="Produits"
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Produits" }]}
        actions={<Link href="/admin/products/new" className="btn-primary inline-flex items-center gap-1.5 !px-4 !py-2.5"><Plus className="h-4 w-4" aria-hidden /> Nouveau produit</Link>}
      />
      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Rechercher (nom, slug, SKU)…" aria-label="Rechercher" className="input mt-0 max-w-xs" />
        <select name="status" defaultValue={status ?? ""} aria-label="Statut" className="input mt-0 max-w-[170px]">
          <option value="">Tous les statuts</option>
          <option value="active">Actifs</option>
          <option value="draft">Brouillons</option>
          <option value="archived">Archivés</option>
        </select>
        <button type="submit" className="btn-primary !py-2.5">Filtrer</button>
      </form>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Impossible de charger les produits.</p>}
      {rows.length === 0 ? (
        <EmptyState title="Aucun produit" text={q || status ? "Aucun résultat pour ces filtres." : "Créez votre premier produit : il apparaîtra sur la boutique dès sa publication."} action={!q && !status && <Link href="/admin/products/new" className="btn-primary inline-block !px-4 !py-2.5">Nouveau produit</Link>} />
      ) : (
        <ProductsTable rows={rows} canWrite />
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/admin/products" params={{ q: searchParams.q, status }} />
    </div>
  );
}
