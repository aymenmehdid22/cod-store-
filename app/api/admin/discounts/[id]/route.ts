import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { discountInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";
const ok = (id: string) => z.string().uuid().safeParse(id).success;

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!ok(params.id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = discountInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { error, count } = await auth.supabase.from("discounts").update(parsed.data, { count: "exact" }).eq("id", params.id);
  if (error) return rpcError(error);
  if (!count) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!ok(params.id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const { error } = await auth.supabase.from("discounts").delete().eq("id", params.id);
  if (error) return rpcError(error);
  return NextResponse.json({ success: true });
}
