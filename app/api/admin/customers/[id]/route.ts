import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { customerInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write"); // notes/tags: owner or manager (also enforced by RLS)
  if (!auth.ok) return auth.res;
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = customerInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { error, count } = await auth.supabase.from("customers").update(parsed.data, { count: "exact" }).eq("id", params.id);
  if (error) return rpcError(error);
  if (!count) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
