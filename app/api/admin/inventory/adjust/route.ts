import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { stockAdjustInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAdminApi("inventory.write");
  if (!auth.ok) return auth.res;
  const parsed = stockAdjustInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides.", issues: parsed.error.flatten() }, { status: 400 });
  const { data, error } = await auth.supabase.rpc("admin_adjust_stock", {
    p_product_id: parsed.data.product_id,
    p_variant_id: parsed.data.variant_id,
    p_delta: parsed.data.delta,
    p_reason: parsed.data.reason,
    p_note: parsed.data.note,
  });
  if (error) return rpcError(error);
  return NextResponse.json({ quantity_after: data });
}
