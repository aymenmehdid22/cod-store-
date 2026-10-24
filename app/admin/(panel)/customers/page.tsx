import Link from "next/link";
import { createClient } from "@/lib/supabase-server";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { formatDZD, formatDate } from "@/lib/format";
import { PageHeader, Pagination, EmptyState } from "@/components/admin/ui";
import { Download } from "lucide-react";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 25;
const SEGMENTS: Record<string, string> = { prospect: "Sans commande valide", new: "Nouveau (1 commande)", returning: "Récurrent (2)", loyal: "Fidèle (3+)", lapsed: "Inactif (90 j+)" };

export default async function CustomersPage({ searchParams }: { searchParams: { q?: string; segment?: string; page?: string } }) {
  const admin = await getAdmin();
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const segment = searchParams.segment && SEGMENTS[searchParams.segment] ? searchParams.segment : "";
  const q = (searchParams.q ?? "").slice(0, 60);
  const { data, error } = await createClient().rpc("admin_customers", { p_q: q, p_segment: segment, p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE });
  const rows = (data ?? []) as { id: string; name: string; phone: string; wilaya_name: string | null; tags: string[]; orders: number; total_spent: number; aov: number | null; last_order_at: string | null; segment: string; lapsed: boolean; total_count: number }[];
  const total = rows[0]?.total_count ?? 0;
  const exportHref = "/api/admin/customers/export?" + new URLSearchParams({ ...(q && { q }), ...(segment && { segment }) }).toString();

  return (
    <div>
      <PageHeader title="Clients" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Clients" }]}
        actions={can(admin?.role, "orders.export") && <a href={exportHref} className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-background"><Download className="h-4 w-4" aria-hidden /> Exporter CSV</a>} />
      <form method="GET" className="mb-4 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder="Nom ou téléphone…" aria-label="Rechercher" className="input mt-0 max-w-xs" />
        <select name="segment" defaultValue={segment} aria-label="Segment" className="input mt-0 max-w-[220px]"><option value="">Tous les segments</option>{Object.entries(SEGMENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <button type="submit" className="btn-primary !py-2.5">Filtrer</button>
      </form>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Impossible de charger les clients.</p>}
      {rows.length === 0 ? <EmptyState title="Aucun client" text="Les clients sont créés automatiquement à chaque commande." /> : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">{["Client", "Wilaya", "Segment", "Commandes", "Total dépensé", "Panier moyen", "Dernière commande"].map((h) => <th key={h} scope="col" className="px-4 py-3 text-start font-medium">{h}</th>)}</tr></thead>
            <tbody>{rows.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3"><Link href={"/admin/customers/" + c.id} className="font-semibold hover:underline">{c.name}</Link><div className="text-xs text-muted" dir="ltr">{c.phone}</div>{c.tags?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{c.tags.map((t) => <span key={t} className="rounded-full bg-background px-2 py-0.5 text-[11px]">{t}</span>)}</div>}</td>
                <td className="px-4 py-3">{c.wilaya_name ?? "—"}</td>
                <td className="px-4 py-3">{SEGMENTS[c.segment]}{c.lapsed && <span className="ms-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">inactif</span>}</td>
                <td className="px-4 py-3">{c.orders}</td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDZD(c.total_spent, "DA")}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.aov === null ? "—" : formatDZD(c.aov, "DA")}</td>
                <td className="whitespace-nowrap px-4 py-3">{c.last_order_at ? formatDate(c.last_order_at) : "—"}</td>
              </tr>))}</tbody>
          </table>
        </div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={Number(total)} basePath="/admin/customers" params={{ q, segment }} />
      <p className="mt-3 text-xs text-muted">Total dépensé et commandes excluent les commandes annulées ou retournées.</p>
    </div>
  );
}
