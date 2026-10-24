import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";

export const dynamic = "force-dynamic";
const schema = z.object({ ids: z.array(z.string().uuid()).min(1).max(200), status: z.enum(["draft", "active", "archived"]) });

// Single and bulk status change (publish / archive / back to draft).
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("catalog.write");
  if (!auth.ok) return auth.res;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("admin_set_products_status", { p_ids: parsed.data.ids, p_status: parsed.data.status });
  if (error) return rpcError(error);
  return NextResponse.json({ updated: data });
}
