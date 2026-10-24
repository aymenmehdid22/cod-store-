import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { CONTENT_SCHEMAS, type ContentKey } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";
const body = z.object({ is_visible: z.boolean(), sort_order: z.number().int().min(0).max(100), content: z.unknown() });

export async function PUT(request: NextRequest, { params }: { params: { key: string } }) {
  const auth = await requireAdminApi("settings.write");
  if (!auth.ok) return auth.res;
  if (!(params.key in CONTENT_SCHEMAS)) return NextResponse.json({ error: "Section inconnue." }, { status: 404 });
  const b = body.safeParse(await request.json().catch(() => null));
  if (!b.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const content = (CONTENT_SCHEMAS[params.key as ContentKey] as z.ZodTypeAny).safeParse(b.data.content);
  if (!content.success) return NextResponse.json({ error: "Contenu invalide.", issues: content.error.flatten() }, { status: 400 });
  const { error, count } = await auth.supabase.from("content_sections").update({ is_visible: b.data.is_visible, sort_order: b.data.sort_order, content: content.data, updated_at: new Date().toISOString() }, { count: "exact" }).eq("page", "home").eq("section_key", params.key);
  if (error) return rpcError(error);
  if (!count) return NextResponse.json({ error: "Section introuvable." }, { status: 404 });
  return NextResponse.json({ success: true });
}
