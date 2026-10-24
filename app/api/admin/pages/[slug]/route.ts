import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { pageInput, SLUG_RE } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireAdminApi("settings.write");
  if (!auth.ok) return auth.res;
  if (!SLUG_RE.test(params.slug)) return NextResponse.json({ error: "Slug invalide." }, { status: 400 });
  const parsed = pageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { slug: _s, ...rest } = parsed.data; // the slug (URL) is not editable once created
  const { error, count } = await auth.supabase.from("store_pages").update({ ...rest, updated_at: new Date().toISOString() }, { count: "exact" }).eq("slug", params.slug);
  if (error) return rpcError(error);
  if (!count) return NextResponse.json({ error: "Introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const auth = await requireAdminApi("settings.write");
  if (!auth.ok) return auth.res;
  if (!SLUG_RE.test(params.slug)) return NextResponse.json({ error: "Slug invalide." }, { status: 400 });
  const { error } = await auth.supabase.from("store_pages").delete().eq("slug", params.slug);
  if (error) return rpcError(error);
  return NextResponse.json({ success: true });
}
