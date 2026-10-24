import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { productInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";
const idSchema = z.string().uuid();

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = productInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });

  // Files that were in the product before but are no longer referenced get removed from Storage afterwards.
  const { data: before } = await auth.supabase.from("product_images").select("storage_path").eq("product_id", params.id);
  const { data, error } = await auth.supabase.rpc("admin_save_product", { p: { ...parsed.data, id: params.id } });
  if (error) return rpcError(error);

  const kept = new Set(parsed.data.images.map((i) => i.storage_path).filter(Boolean));
  const orphans = (before ?? []).map((r) => r.storage_path as string | null).filter((p): p is string => !!p && !kept.has(p));
  if (orphans.length > 0) await auth.supabase.storage.from("product-images").remove(orphans);
  return NextResponse.json({ id: data });
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  if (!idSchema.safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const { data: paths, error } = await auth.supabase.rpc("admin_delete_product", { p_id: params.id });
  if (error) return rpcError(error);
  if (Array.isArray(paths) && paths.length > 0) await auth.supabase.storage.from("product-images").remove(paths as string[]);
  return NextResponse.json({ success: true });
}
