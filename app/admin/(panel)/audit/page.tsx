import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { PageHeader, Pagination, EmptyState } from "@/components/admin/ui";
import { formatDate } from "@/lib/format";

export const dynamic = "force-dynamic";
const PAGE_SIZE = 50;

export default async function AuditPage({ searchParams }: { searchParams: { entity?: string; page?: string } }) {
  await requireAdminPage("audit.read");
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const entity = /^[a-z_]{1,40}$/.test(searchParams.entity ?? "") ? searchParams.entity : undefined;
  let q = createClient().from("audit_logs").select("id, actor_id, actor_role, action, entity, entity_id, details, created_at", { count: "exact" }).order("created_at", { ascending: false }).range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);
  if (entity) q = q.eq("entity", entity);
  const [{ data, count }, { data: users }] = await Promise.all([q, getServiceSupabase().auth.admin.listUsers({ perPage: 1000 })]);
  const email = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  return (
    <div>
      <PageHeader title="Journal d'audit" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Audit" }]} />
      <form method="GET" className="mb-4 flex gap-2"><input name="entity" defaultValue={entity} placeholder="Filtrer par entité (order, product, discounts…)" aria-label="Entité" className="input mt-0 max-w-sm" /><button type="submit" className="btn-primary !py-2.5">Filtrer</button></form>
      {(data ?? []).length === 0 ? <EmptyState title="Aucune entrée" /> : (
        <div className="card overflow-x-auto"><table className="w-full min-w-[760px] text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">{["Date", "Acteur", "Action", "Entité", "Détails"].map((h) => <th key={h} scope="col" className="px-4 py-3 text-start font-medium">{h}</th>)}</tr></thead>
          <tbody>{(data ?? []).map((l) => (
            <tr key={l.id} className="border-b border-border align-top last:border-0">
              <td className="whitespace-nowrap px-4 py-2.5">{formatDate(l.created_at)}</td>
              <td className="px-4 py-2.5">{l.actor_id ? email.get(l.actor_id) ?? l.actor_id.slice(0, 8) : "système"}<span className="block text-xs text-muted">{l.actor_role}</span></td>
              <td className="px-4 py-2.5 font-medium">{l.action}</td>
              <td className="px-4 py-2.5">{l.entity}<span className="block text-xs text-muted" dir="ltr">{l.entity_id ?? ""}</span></td>
              <td className="px-4 py-2.5 text-xs text-muted" dir="ltr">{Object.keys(l.details ?? {}).length ? JSON.stringify(l.details) : ""}</td>
            </tr>))}</tbody></table></div>
      )}
      <Pagination page={page} pageSize={PAGE_SIZE} total={count ?? 0} basePath="/admin/audit" params={{ entity }} />
    </div>
  );
}
