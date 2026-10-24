import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { pageInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("settings.write");
  if (!auth.ok) return auth.res;
  const parsed = pageInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { error } = await auth.supabase.from("store_pages").insert(parsed.data);
  if (error) return rpcError(error);
  return NextResponse.json({ success: true }, { status: 201 });
}
