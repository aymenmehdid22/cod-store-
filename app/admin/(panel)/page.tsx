import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { resolveRange } from "@/lib/date-range";
import { formatDZD, formatDate } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import RangePicker from "@/components/admin/RangePicker";
import BarChart from "@/components/admin/BarChart";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({ searchParams }: { searchParams: { range?: string; from?: string; to?: string; error?: string } }) {
  const admin = await getAdmin();
  const supabase = createClient();
  const staff = can(admin?.role, "catalog.write");
  const r = resolveRange(searchParams);
  const money = (n: number) => formatDZD(n, "DA");

  const [analytics, recent, products] = await Promise.all([
    staff ? supabase.rpc("admin_analytics", { p_from: r.from, p_to: r.to }) : Promise.resolve({ data: null, error: null }),
    supabase.from("orders").select("id, order_number, created_at, customer_name, total_price, status").order("created_at", { ascending: false }).limit(8),
    staff ? supabase.from("products").select("id, name, track_inventory, stock_quantity, low_stock_threshold, product_variants(stock_quantity)").eq("status", "active") : Promise.resolve({ data: [] }),
  ]);
  const a = analytics.data as { totals: { placed: number; net: number; delivered_rev: number; live_orders: number }; aov: number | null; daily: { day: string; net: number }[]; top_products: { name: string; units: number; revenue: number }[]; by_status: Record<string, number> } | null;
  const low = (products.data ?? []).map((p) => {
    const v = (p.product_variants as { stock_quantity: number }[]) ?? [];
    const stock = v.length ? v.reduce((n, x) => n + x.stock_quantity, 0) : p.stock_quantity;
    return { id: p.id, name: p.name, stock, tracked: p.track_inventory, threshold: p.low_stock_threshold };
  }).filter((p) => p.tracked && p.stock <= p.threshold);

  return (
    <div className="space-y-5">
      <PageHeader title="Aperçu" crumbs={[{ label: "Admin" }, { label: "Aperçu" }]} />
      {searchParams.error === "forbidden" && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Votre rôle n&apos;a pas accès à cette page.</p>}
      {staff && <RangePicker basePath="/admin" current={r.key} from={r.from} to={r.to} />}
      {a && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[["Commandes", String(a.totals.placed)], ["Ventes nettes", money(a.totals.net)], ["Revenu encaissé (livré)", money(a.totals.delivered_rev)], ["Panier moyen", a.aov === null ? "—" : money(a.aov)]].map(([l, v]) => (
              <div key={l} className="card p-4"><p className="text-xs text-muted">{l}</p><p className="mt-1 text-xl font-extrabold">{v}</p></div>
            ))}
          </div>
          <section className="card p-4" aria-labelledby="h-sales"><h2 id="h-sales" className="mb-2 text-sm font-semibold uppercase tracking-wide">Ventes nettes par jour</h2>
            <BarChart label="Ventes nettes par jour" data={a.daily.map((d) => ({ label: d.day, value: d.net }))} format={money} /></section>
          <p className="text-xs text-muted">Définitions et conversion mesurée : <Link href="/admin/analytics" className="underline">Analytics</Link>.</p>
        </>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card p-4" aria-labelledby="h-recent">
          <div className="mb-2 flex items-center justify-between"><h2 id="h-recent" className="text-sm font-semibold uppercase tracking-wide">Dernières commandes</h2><Link href="/admin/orders" className="text-xs underline">Tout voir</Link></div>
          {(recent.data ?? []).length === 0 ? <p className="text-sm text-muted">Aucune commande.</p> : (
            <ul className="divide-y divide-border text-sm">{(recent.data ?? []).map((o) => (
              <li key={o.id} className="flex items-center justify-between gap-2 py-2"><Link href={"/admin/orders/" + o.id} className="min-w-0 truncate font-medium hover:underline">{o.order_number} · {o.customer_name}</Link><span className="flex shrink-0 items-center gap-2"><span className="text-xs text-muted">{formatDate(o.created_at)}</span><StatusBadge status={o.status} /></span></li>
            ))}</ul>
          )}
        </section>
        {staff && (
          <section className="card p-4" aria-labelledby="h-low">
            <h2 id="h-low" className="mb-2 text-sm font-semibold uppercase tracking-wide">Stock bas</h2>
            {low.length === 0 ? <p className="text-sm text-muted">Aucun produit sous son seuil d&apos;alerte.</p> : (
              <ul className="divide-y divide-border text-sm">{low.map((p) => <li key={p.id} className="flex justify-between py-2"><Link href="/admin/inventory" className="hover:underline">{p.name}</Link><span className={p.stock === 0 ? "font-semibold text-red-600" : "font-semibold text-amber-600"}>{p.stock}</span></li>)}</ul>
            )}
          </section>
        )}
        {a && a.top_products.length > 0 && (
          <section className="card p-4" aria-labelledby="h-top"><h2 id="h-top" className="mb-2 text-sm font-semibold uppercase tracking-wide">Meilleures ventes</h2>
            <ul className="divide-y divide-border text-sm">{a.top_products.slice(0, 5).map((p) => <li key={p.name} className="flex justify-between py-2"><span>{p.name}</span><span className="text-muted">{p.units} · {money(p.revenue)}</span></li>)}</ul></section>
        )}
      </div>
    </div>
  );
}
