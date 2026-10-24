import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { formatDZD, formatDate } from "@/lib/format";
import StatusBadge from "@/components/admin/StatusBadge";
import OrderActions from "@/components/admin/OrderActions";
import OrderNoteForm from "@/components/admin/OrderNoteForm";
import { PageHeader } from "@/components/admin/ui";
import { ORDER_STATUSES, type Order, type OrderStatus } from "@/types/order";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted">{label}</span>
      <span className="text-end font-medium">{value ?? "—"}</span>
    </div>
  );
}
const statusLabel = (s: string | null) => ORDER_STATUSES.find((x) => x.value === s)?.label ?? s ?? "—";

export default async function AdminOrderDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data: order }, { data: items }, { data: history }, { data: notes }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", params.id).maybeSingle(),
    supabase.from("order_items").select("*").eq("order_id", params.id),
    supabase.from("order_status_history").select("*").eq("order_id", params.id).order("created_at", { ascending: true }),
    supabase.from("order_notes").select("*").eq("order_id", params.id).order("created_at", { ascending: false }),
  ]);
  if (!order) notFound();
  const o = order as Order;

  return (
    <div className="max-w-3xl space-y-4">
      <PageHeader
        title={o.order_number}
        crumbs={[{ label: "Admin", href: "/admin" }, { label: "Commandes", href: "/admin/orders" }, { label: o.order_number }]}
        actions={<StatusBadge status={o.status} />}
      />
      <p className="-mt-3 text-sm text-muted">{formatDate(o.created_at)} · Paiement à la livraison</p>

      <section className="card divide-y divide-border p-5" aria-labelledby="h-client">
        <h2 id="h-client" className="pb-2 text-sm font-semibold uppercase tracking-wide">Client</h2>
        <Row label="Nom" value={o.customer_name} />
        <Row label="Téléphone" value={<span dir="ltr">{o.phone}</span>} />
        <Row label="Wilaya" value={o.wilaya_code + " — " + o.wilaya_name} />
        <Row label="Livraison" value={o.delivery_type === "home" ? "À domicile" : "Stopdesk"} />
        {o.delivery_type === "home" ? (<><Row label="Commune" value={o.commune} /><Row label="Adresse" value={o.address} /></>) : (<Row label="Stopdesk" value={o.stopdesk} />)}
      </section>

      <section className="card divide-y divide-border p-5" aria-labelledby="h-items">
        <h2 id="h-items" className="pb-2 text-sm font-semibold uppercase tracking-wide">Articles</h2>
        {(items ?? []).map((i) => (
          <Row key={i.id} label={i.product_name + (i.variant_name ? " · " + i.variant_name : "") + " × " + i.quantity} value={formatDZD(i.line_total)} />
        ))}
        <Row label="Sous-total" value={formatDZD(o.subtotal ?? o.unit_price * o.quantity)} />
        {o.discount_amount > 0 && <Row label={"Remise" + (o.discount_code ? " (" + o.discount_code + ")" : "")} value={"− " + formatDZD(o.discount_amount)} />}
        <Row label="Livraison" value={o.shipping_fee > 0 ? formatDZD(o.shipping_fee) : "Selon confirmation"} />
        <Row label="Total à encaisser" value={<span className="font-extrabold">{formatDZD(o.total_price)}</span>} />
        <p className="pt-2 text-xs text-muted">Prix figés à la commande : modifier le catalogue ne change pas cette commande.</p>
      </section>

      <section className="card p-5" aria-labelledby="h-status">
        <h2 id="h-status" className="mb-3 text-sm font-semibold uppercase tracking-wide">Statut</h2>
        <OrderActions id={o.id} status={o.status as OrderStatus} />
      </section>

      <section className="card p-5" aria-labelledby="h-history">
        <h2 id="h-history" className="mb-3 text-sm font-semibold uppercase tracking-wide">Historique</h2>
        <ol className="space-y-2 text-sm">
          {(history ?? []).map((h) => (
            <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b border-border pb-2 last:border-0">
              <span><span className="font-medium">{h.from_status ? statusLabel(h.from_status) + " → " : ""}{statusLabel(h.to_status)}</span>{h.note ? <span className="text-muted"> — {h.note}</span> : null}</span>
              <span className="text-muted">{formatDate(h.created_at)}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5" aria-labelledby="h-notes">
        <h2 id="h-notes" className="mb-3 text-sm font-semibold uppercase tracking-wide">Notes internes</h2>
        <OrderNoteForm id={o.id} />
        <ul className="mt-4 space-y-2 text-sm">
          {(notes ?? []).map((n) => (
            <li key={n.id} className="rounded-xl bg-background p-3"><p className="whitespace-pre-wrap">{n.body}</p><p className="mt-1 text-xs text-muted">{formatDate(n.created_at)}</p></li>
          ))}
          {(notes ?? []).length === 0 && <li className="text-muted">Aucune note.</li>}
        </ul>
      </section>

      <section className="card divide-y divide-border p-5" aria-labelledby="h-attr">
        <h2 id="h-attr" className="pb-2 text-sm font-semibold uppercase tracking-wide">Attribution</h2>
        <Row label="Source" value={o.utm_source} />
        <Row label="Campagne" value={o.utm_campaign} />
        <Row label="fbclid" value={o.fbclid ? "présent" : null} />
        <Row label="Google Sheets" value={o.google_sheet_synced ? "Synchronisé" : "Non synchronisé"} />
      </section>
      <Link href="/admin/orders" className="inline-block text-sm text-muted hover:text-black hover:underline">← Retour aux commandes</Link>
    </div>
  );
}
