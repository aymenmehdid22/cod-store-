import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { productInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  const parsed = productInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { id: _ignored, ...payload } = parsed.data;
  const { data, error } = await auth.supabase.rpc("admin_save_product", { p: payload });
  if (error) return rpcError(error);
  return NextResponse.json({ id: data }, { status: 201 });
}
