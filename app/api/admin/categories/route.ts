import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { categoryInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  const parsed = categoryInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await auth.supabase.from("categories").insert(parsed.data).select("id").single();
  if (error) return rpcError(error);
  return NextResponse.json({ id: data.id }, { status: 201 });
}
