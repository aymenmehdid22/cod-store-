import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDZD, formatDate } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import CustomerEditor from "@/components/admin/CustomerEditor";
import { PageHeader } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: { id: string } }) {
  if (!/^[0-9a-f-]{36}$/i.test(params.id)) notFound();
  const admin = await getAdmin();
  const supabase = createClient();
  const [{ data: c }, { data: orders }] = await Promise.all([
    supabase.from("customers").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("orders").select("id, order_number, created_at, total_price, status, product_name").eq("customer_id", params.id).order("created_at", { ascending: false }),
  ]);
  if (!c) notFound();
  const live = (orders ?? []).filter((o) => o.status !== "cancelled" && o.status !== "returned");
  const spent = live.reduce((n, o) => n + o.total_price, 0);
  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader title={c.name} crumbs={[{ label: "Admin", href: "/admin" }, { label: "Clients", href: "/admin/customers" }, { label: c.name }]} />
      <section className="card grid gap-3 p-5 text-sm sm:grid-cols-4" aria-label="Résumé">
        <div><p className="text-xs text-muted">Téléphone</p><p dir="ltr" className="font-semibold">{c.phone}</p></div>
        <div><p className="text-xs text-muted">Wilaya</p><p className="font-semibold">{c.wilaya_name ?? "—"}</p></div>
        <div><p className="text-xs text-muted">Commandes valides</p><p className="font-semibold">{live.length}</p></div>
        <div><p className="text-xs text-muted">Total · panier moyen</p><p className="font-semibold">{formatDZD(spent, "DA")} · {live.length ? formatDZD(Math.round(spent / live.length), "DA") : "—"}</p></div>
      </section>
      <section className="card p-5" aria-labelledby="h-edit"><h2 id="h-edit" className="mb-3 text-sm font-semibold uppercase tracking-wide">Tags & notes</h2>
        <CustomerEditor id={c.id} notes={c.notes ?? ""} tags={c.tags ?? []} canEdit={can(admin?.role, "catalog.write")} /></section>
      <section className="card p-5" aria-labelledby="h-orders"><h2 id="h-orders" className="mb-3 text-sm font-semibold uppercase tracking-wide">Historique des commandes</h2>
        <ul className="divide-y divide-border text-sm">{(orders ?? []).map((o) => (
          <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2"><Link href={"/admin/orders/" + o.id} className="font-medium hover:underline">{o.order_number} · {o.product_name}</Link><span className="flex items-center gap-3"><span className="text-xs text-muted">{formatDate(o.created_at)}</span><span className="font-semibold">{formatDZD(o.total_price, "DA")}</span><StatusBadge status={o.status} /></span></li>
        ))}{(orders ?? []).length === 0 && <li className="py-2 text-muted">Aucune commande.</li>}</ul></section>
    </div>
  );
}
