import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { teamInvite } from "@/lib/admin-schemas";
import { getServiceSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

// Owner only. Roles live in public.admin_users (never in user metadata). The service-role key is used ONLY to
// look up / invite the Auth user; the role row itself is written with the owner's own session (RLS: owner-only).
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("team.manage");
  if (!auth.ok) return auth.res;
  const parsed = teamInvite.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Email ou rôle invalide." }, { status: 400 });
  const { email, role, display_name } = parsed.data;

  const svc = getServiceSupabase();
  const { data: list, error: listError } = await svc.auth.admin.listUsers({ perPage: 1000 });
  if (listError) { console.error("listUsers:", listError.message); return NextResponse.json({ error: "Annuaire utilisateurs indisponible." }, { status: 502 }); }
  let userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
  let invited = false;
  if (!userId) {
    const { data, error } = await svc.auth.admin.inviteUserByEmail(email);
    if (error || !data.user) { console.error("invite:", error?.message); return NextResponse.json({ error: "Invitation impossible : vérifiez la configuration e-mail (SMTP) de Supabase Auth." }, { status: 502 }); }
    userId = data.user.id; invited = true;
  }
  const { error } = await auth.supabase.from("admin_users").insert({ user_id: userId, role, display_name: display_name ?? null, created_by: auth.admin.user.id });
  if (error) return rpcError(error);
  return NextResponse.json({ success: true, invited }, { status: 201 });
}
