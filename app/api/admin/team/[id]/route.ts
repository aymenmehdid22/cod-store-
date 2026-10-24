import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi } from "@/lib/auth";
import { teamUpdate } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";
const idOk = (id: string) => z.string().uuid().safeParse(id).success;
const lastOwner = (m?: string) => !!m?.includes("LAST_OWNER");

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("team.manage");
  if (!auth.ok) return auth.res;
  if (!idOk(params.id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = teamUpdate.safeParse(await request.json().catch(() => null));
  if (!parsed.success || Object.keys(parsed.data).length === 0) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { error, count } = await auth.supabase.from("admin_users").update(parsed.data, { count: "exact" }).eq("user_id", params.id);
  if (error) return NextResponse.json({ error: lastOwner(error.message) ? "Il doit rester au moins un propriétaire." : "Mise à jour impossible." }, { status: lastOwner(error.message) ? 409 : 500 });
  if (!count) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("team.manage");
  if (!auth.ok) return auth.res;
  if (!idOk(params.id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  if (params.id === auth.admin.user.id) return NextResponse.json({ error: "Vous ne pouvez pas retirer votre propre accès." }, { status: 400 });
  const { error } = await auth.supabase.from("admin_users").delete().eq("user_id", params.id);
  if (error) return NextResponse.json({ error: lastOwner(error.message) ? "Il doit rester au moins un propriétaire." : "Suppression impossible." }, { status: lastOwner(error.message) ? 409 : 500 });
  return NextResponse.json({ success: true });
}
