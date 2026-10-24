import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { getServiceSupabase } from "@/lib/supabase";
import { PageHeader } from "@/components/admin/ui";
import TeamManager, { type Member } from "@/components/admin/TeamManager";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const me = await requireAdminPage("team.manage");
  const [{ data: rows }, { data: users }] = await Promise.all([
    createClient().from("admin_users").select("user_id, role, display_name, created_at").order("created_at"),
    getServiceSupabase().auth.admin.listUsers({ perPage: 1000 }),
  ]);
  const email = new Map((users?.users ?? []).map((u) => [u.id, u.email ?? "—"]));
  const members: Member[] = (rows ?? []).map((r) => ({ ...r, email: email.get(r.user_id) ?? "—" })) as Member[];
  return (
    <div className="max-w-3xl">
      <PageHeader title="Équipe" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Équipe" }]} />
      <TeamManager members={members} selfId={me.user.id} />
    </div>
  );
}
