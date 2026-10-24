import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDZD, formatDate } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import { PageHeader, Pagination, EmptyState } from "@/components/admin/ui";
import { ORDER_STATUSES, type OrderStatus } from "@/types/order";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;

export default async function AdminOrdersPage({ searchParams }: { searchParams: { q?: string; status?: string; page?: string } }) {
  const admin = await getAdmin();
  const supabase = createClient();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const status = ORDER_STATUSES.some((s) => s.value === searchParams.status) ? (searchParams.status as OrderStatus) : undefined;

  let query = supabase
    .from("orders")
    .select("id, order_number, created_at, customer_name, phone, product_name, variant_name, wilaya_code, wilaya_name, delivery_type, total_price, status", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (status) query = query.eq("status", status);
  const q = (searchParams.q ?? "").replace(/[%,()*\\]/g, "").trim().slice(0, 60);
  if (q) query = query.or("customer_name.ilike.%" + q + "%,phone.ilike.%" + q + "%,order_number.ilike.%" + q + "%");

  const { data: orders, count, error } = await query;
  const exportHref = "/api/admin/orders/export" + (status ? "?status=" + status : "");

  return (
    <div>
      <PageHeader
        title="Commandes"
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Commandes" }]}
        actions={
          can(admin?.role, "orders.export") && (
            <a href={exportHref} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-background">
              <Download className="h-4 w-4" aria-hidden /> Exporter CSV
            </a>
          )
        }
      />

      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={searchParams.q} placeholder="Rechercher (nom, téléphone, N°)…" aria-label="Rechercher" className="input mt-0 max-w-xs" />
        <select name="status" defaultValue={status ?? ""} aria-label="Statut" className="input mt-0 max-w-[180px]">
          <option value="">Tous les statuts</option>
          {ORDER_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <button type="submit" className="btn-primary !py-2.5">Filtrer</button>
      </form>

      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Impossible de charger les commandes.</p>}

      {(orders ?? []).length === 0 ? (
        <EmptyState title="Aucune commande trouvée" text={q || status ? "Essayez d'autres filtres." : "Les commandes passées sur la boutique apparaîtront ici."} />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-border text-start text-xs uppercase tracking-wide text-muted">
                {["Commande", "Date", "Client", "Téléphone", "Produit", "Wilaya", "Livraison", "Total", "Statut"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 text-start font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(orders ?? []).map((o) => (
                <tr key={o.id} className="border-b border-border last:border-0 hover:bg-background">
                  <td className="px-4 py-3 font-semibold"><Link href={"/admin/orders/" + o.id} className="hover:underline">{o.order_number}</Link></td>
                  <td className="whitespace-nowrap px-4 py-3">{formatDate(o.created_at)}</td>
                  <td className="px-4 py-3">{o.customer_name}</td>
                  <td className="whitespace-nowrap px-4 py-3" dir="ltr">{o.phone}</td>
                  <td className="px-4 py-3">{o.product_name}{o.variant_name ? " · " + o.variant_name : ""}</td>
                  <td className="px-4 py-3">{o.wilaya_code} {o.wilaya_name}</td>
                  <td className="px-4 py-3">{o.delivery_type === "home" ? "Domicile" : "Stopdesk"}</td>
                  <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDZD(o.total_price)}</td>
                  <td className="px-4 py-3"><StatusBadge status={o.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/admin/orders" params={{ q: searchParams.q, status }} />
    </div>
  );
}
