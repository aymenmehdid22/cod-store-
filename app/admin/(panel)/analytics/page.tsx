import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { resolveRange } from "@/lib/date-range";
import { formatDZD } from "@/lib/format";
import { PageHeader, EmptyState } from "@/components/admin/ui";
import RangePicker from "@/components/admin/RangePicker";
import BarChart from "@/components/admin/BarChart";
import { ORDER_STATUSES } from "@/types/order";

export const dynamic = "force-dynamic";

type A = {
  range: { from: string; to: string };
  totals: { placed: number; gross: number; discounts: number; net: number; delivered_rev: number; new_customers: number; returning_customers: number; new_orders: number; returning_orders: number };
  aov: number | null; cancellation_rate: number | null; return_rate: number | null;
  by_status: Record<string, number>; daily: { day: string; orders: number; net: number }[];
  top_products: { name: string; units: number; revenue: number }[]; top_categories: { name: string; units: number; revenue: number }[];
  acquisition: { source: string; orders: number; net: number }[]; campaigns: { campaign: string; source: string; orders: number; net: number }[];
  funnel: { sessions: number; view_content: number; add_to_cart: number; initiate_checkout: number; lead: number };
  abandoned_checkouts: number; product_views: { name: string; views: number; adds: number }[];
  inventory: { name: string; stock: number; units_sold: number }[];
};

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="card p-4"><p className="text-xs text-muted">{label}</p><p className="mt-1 text-xl font-extrabold">{value}</p>{hint && <p className="mt-1 text-[11px] leading-snug text-muted">{hint}</p>}</div>;
}
function Table({ title, head, rows, empty }: { title: string; head: string[]; rows: (string | number)[][]; empty: string }) {
  return (
    <section className="card overflow-x-auto p-4" aria-label={title}>
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted">{empty}</p> : (
        <table className="w-full text-sm"><thead><tr className="text-xs text-muted">{head.map((h, i) => <th key={h} scope="col" className={"py-1.5 font-medium " + (i === 0 ? "text-start" : "text-end")}>{h}</th>)}</tr></thead>
          <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-border">{r.map((c, j) => <td key={j} className={"py-1.5 " + (j === 0 ? "" : "text-end")}>{c}</td>)}</tr>)}</tbody></table>
      )}
    </section>
  );
}
const pct = (a: number, b: number) => (b > 0 ? ((100 * a) / b).toFixed(1) + " %" : "—");

export default async function AnalyticsPage({ searchParams }: { searchParams: { range?: string; from?: string; to?: string } }) {
  await requireAdminPage("catalog.write");
  const r = resolveRange(searchParams);
  const { data, error } = await createClient().rpc("admin_analytics", { p_from: r.from, p_to: r.to });
  const a = data as A | null;
  const money = (n: number) => formatDZD(n, "DA");

  return (
    <div className="space-y-5">
      <PageHeader title="Analytics" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Analytics" }]} />
      <RangePicker basePath="/admin/analytics" current={r.key} from={r.from} to={r.to} />
      {error || !a ? <EmptyState title="Impossible de charger les analytics" text="Vérifiez que la migration 004 est appliquée." /> : (
        <>
          <p className="text-xs text-muted">Du {r.from} au {r.to} inclus · fuseau Africa/Algiers · chiffres issus des commandes réelles en base.</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Commandes passées" value={String(a.totals.placed)} />
            <Stat label="Ventes brutes" value={money(a.totals.gross)} hint="Somme des sous-totaux, avant remises, hors livraison." />
            <Stat label="Ventes nettes" value={money(a.totals.net)} hint="Brut − remises − commandes annulées − retournées." />
            <Stat label="Revenu encaissé (livré)" value={money(a.totals.delivered_rev)} hint="Commandes au statut Livrée uniquement (paiement à la livraison)." />
            <Stat label="Panier moyen" value={a.aov === null ? "—" : money(a.aov)} hint="Ventes nettes ÷ commandes non annulées/retournées." />
            <Stat label="Taux d'annulation" value={a.cancellation_rate === null ? "—" : a.cancellation_rate + " %"} hint="Annulées ÷ passées." />
            <Stat label="Taux de retour" value={a.return_rate === null ? "—" : a.return_rate + " %"} hint="Retournées ÷ (livrées + retournées)." />
            <Stat label="Remises accordées" value={money(a.totals.discounts)} />
          </div>
          <section className="card p-4" aria-labelledby="h-trend">
            <h2 id="h-trend" className="mb-2 text-sm font-semibold uppercase tracking-wide">Ventes nettes par jour</h2>
            <BarChart label="Ventes nettes par jour" data={a.daily.map((d) => ({ label: d.day, value: d.net }))} format={money} />
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Table title="Commandes par statut" head={["Statut", "Commandes"]} rows={ORDER_STATUSES.filter((s) => a.by_status[s.value]).map((s) => [s.label, a.by_status[s.value]])} empty="Aucune commande sur la période." />
            <Table title="Clients" head={["Segment", "Clients", "Commandes"]} rows={[["Nouveaux", a.totals.new_customers, a.totals.new_orders], ["Récurrents", a.totals.returning_customers, a.totals.returning_orders]]} empty="" />
            <Table title="Meilleurs produits" head={["Produit", "Unités", "CA"]} rows={a.top_products.map((p) => [p.name, p.units, money(p.revenue)])} empty="Aucune vente." />
            <Table title="Meilleures catégories" head={["Catégorie", "Unités", "CA"]} rows={a.top_categories.map((p) => [p.name, p.units, money(p.revenue)])} empty="Aucune vente dans une catégorie." />
            <Table title="Acquisition (source)" head={["Source", "Commandes", "Ventes nettes"]} rows={a.acquisition.map((p) => [p.source, p.orders, money(p.net)])} empty="Aucune commande." />
            <Table title="Campagnes" head={["Campagne", "Source", "Commandes", "Ventes nettes"]} rows={a.campaigns.map((p) => [p.campaign, p.source, p.orders, money(p.net)])} empty="Aucune commande avec paramètre utm_campaign." />
          </div>
          <section className="card p-4" aria-labelledby="h-funnel">
            <h2 id="h-funnel" className="text-sm font-semibold uppercase tracking-wide">Entonnoir (sessions suivies)</h2>
            <p className="mb-3 mt-1 text-xs text-muted">Basé uniquement sur les visiteurs ayant accepté la mesure d&apos;audience : une sous-estimation du trafic réel. Les commandes ci-dessus, elles, sont exhaustives.</p>
            {a.funnel.sessions === 0 ? <p className="text-sm text-muted">Aucune donnée de navigation : activez un outil dans Marketing &amp; Tracking et attendez des visites consenties.</p> : (
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                <Stat label="Sessions" value={String(a.funnel.sessions)} />
                <Stat label="Fiche produit vue" value={String(a.funnel.view_content)} hint={pct(a.funnel.view_content, a.funnel.sessions)} />
                <Stat label="Ajout au panier" value={String(a.funnel.add_to_cart)} hint={pct(a.funnel.add_to_cart, a.funnel.view_content) + " des fiches vues"} />
                <Stat label="Début de commande" value={String(a.funnel.initiate_checkout)} />
                <Stat label="Commande passée" value={String(a.funnel.lead)} hint={pct(a.funnel.lead, a.funnel.initiate_checkout) + " des débuts de commande"} />
                <Stat label="Commandes abandonnées" value={String(a.abandoned_checkouts)} hint="Sessions ayant commencé la commande sans la finir (aucune donnée personnelle collectée)." />
              </div>
            )}
          </section>
          <div className="grid gap-4 lg:grid-cols-2">
            <Table title="Vues produit & ajout au panier" head={["Produit", "Vues", "Ajouts", "Taux"]} rows={a.product_views.map((p) => [p.name, p.views, p.adds, pct(p.adds, p.views)])} empty="Pas encore de données mesurées." />
            <Table title="Performance du stock" head={["Produit", "Stock", "Vendus"]} rows={a.inventory.map((p) => [p.name, p.stock, p.units_sold])} empty="Aucun produit à stock suivi." />
          </div>
        </>
      )}
    </div>
  );
}
