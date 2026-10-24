import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import StockAdjustForm from "@/components/admin/StockAdjustForm";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  initial: "Stock initial", restock: "Réappro.", correction: "Correction", damage: "Casse / perte", return: "Retour",
  order_placed: "Commande", order_cancelled: "Commande annulée", order_returned: "Commande retournée",
};

export default async function InventoryPage() {
  await requireAdminPage("inventory.write");
  const supabase = createClient();
  const [{ data: products }, { data: moves }] = await Promise.all([
    supabase.from("products").select("id, name, status, track_inventory, stock_quantity, low_stock_threshold, product_variants(id, name, stock_quantity, sort_order)").neq("status", "archived").order("name"),
    supabase.from("inventory_movements").select("id, product_id, variant_id, delta, quantity_after, reason, note, created_at, products(name), product_variants(name)").order("created_at", { ascending: false }).limit(40),
  ]);

  type Line = { key: string; productId: string; variantId: string | null; label: string; qty: number; low: number; status: string };
  const lines: Line[] = [];
  for (const p of products ?? []) {
    if (!p.track_inventory) continue;
    const vs = [...(p.product_variants as { id: string; name: string; stock_quantity: number; sort_order: number }[])].sort((a, b) => a.sort_order - b.sort_order);
    if (vs.length === 0) lines.push({ key: p.id, productId: p.id, variantId: null, label: p.name, qty: p.stock_quantity, low: p.low_stock_threshold, status: p.status });
    else vs.forEach((v) => lines.push({ key: v.id, productId: p.id, variantId: v.id, label: p.name + " — " + v.name, qty: v.stock_quantity, low: p.low_stock_threshold, status: p.status }));
  }
  const lowCount = lines.filter((l) => l.qty <= l.low).length;

  return (
    <div className="space-y-6">
      <PageHeader title="Inventaire" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Inventaire" }]} />
      {lowCount > 0 && <p role="status" className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">{lowCount} article(s) en stock bas ou épuisé.</p>}

      {lines.length === 0 ? <EmptyState title="Aucun article suivi" text="Les produits dont le stock est suivi apparaîtront ici." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              <th scope="col" className="px-4 py-3 text-start font-medium">Article</th><th scope="col" className="px-4 py-3 text-start font-medium">Stock</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Seuil</th><th scope="col" className="px-4 py-3 text-end font-medium">Action</th></tr></thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.key} className="border-b border-border align-top last:border-0">
                  <td className="px-4 py-3 font-medium">{l.label}{l.status !== "active" && <span className="ms-2 text-xs text-muted">({l.status === "draft" ? "brouillon" : l.status})</span>}</td>
                  <td className={"px-4 py-3 font-semibold " + (l.qty === 0 ? "text-red-600" : l.qty <= l.low ? "text-amber-600" : "")}>{l.qty}{l.qty === 0 ? " · épuisé" : l.qty <= l.low ? " · bas" : ""}</td>
                  <td className="px-4 py-3 text-muted">{l.low}</td>
                  <td className="px-4 py-3"><div className="flex justify-end"><StockAdjustForm productId={l.productId} variantId={l.variantId} label={l.label} current={l.qty} /></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <section aria-labelledby="h-moves">
        <h2 id="h-moves" className="mb-3 text-sm font-semibold uppercase tracking-wide">Derniers mouvements</h2>
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px] text-sm">
            <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              {["Date", "Article", "Variation", "Stock après", "Motif"].map((h) => <th key={h} scope="col" className="px-4 py-3 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {(moves ?? []).map((m) => {
                const prod = (m.products as unknown as { name: string } | null)?.name ?? "(produit supprimé)";
                const vari = (m.product_variants as unknown as { name: string } | null)?.name;
                return (
                  <tr key={m.id} className="border-b border-border last:border-0">
                    <td className="whitespace-nowrap px-4 py-2.5">{formatDate(m.created_at)}</td>
                    <td className="px-4 py-2.5">{prod}{vari ? " — " + vari : ""}</td>
                    <td className={"px-4 py-2.5 font-semibold " + (m.delta > 0 ? "text-green-700" : "text-red-600")}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                    <td className="px-4 py-2.5">{m.quantity_after}</td>
                    <td className="px-4 py-2.5 text-muted">{REASON_LABEL[m.reason] ?? m.reason}{m.note ? " — " + m.note : ""}</td>
                  </tr>
                );
              })}
              {(moves ?? []).length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted">Aucun mouvement enregistré.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
