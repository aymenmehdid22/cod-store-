import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { categoryInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";
const idSchema = z.string().uuid();

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = categoryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { error, count } = await auth.supabase.from("categories").update(parsed.data, { count: "exact" }).eq("id", params.id);
  if (error) return rpcError(error);
  if (!count) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}

// product_categories.category_id is ON DELETE RESTRICT: a category that still has products cannot be deleted.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const { error } = await auth.supabase.from("categories").delete().eq("id", params.id);
  if (error) {
    if (error.code === "23503") {
      return NextResponse.json({ error: "Cette catégorie contient des produits : retirez-les d'abord." }, { status: 409 });
    }
    return rpcError(error);
  }
  return NextResponse.json({ success: true });
}
