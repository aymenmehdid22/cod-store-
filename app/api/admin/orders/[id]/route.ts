import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { statusInput } from "@/lib/admin-schemas";
import { sendPurchaseForDeliveredOrder } from "@/lib/tracking-server";

export const dynamic = "force-dynamic";

// Status changes go through the admin_set_order_status() database function, which enforces the allowed
// transitions, restocks cancelled/returned orders exactly once, and writes history + audit rows.
// The previous implementation wrote with the service-role key after checking only "is signed in".
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("orders.update");
  if (!auth.ok) return auth.res;
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = statusInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Statut invalide." }, { status: 400 });
  const { error } = await auth.supabase.rpc("admin_set_order_status", {
    p_order_id: params.id,
    p_to: parsed.data.status,
    p_note: parsed.data.note ?? null,
  });
  if (error) return rpcError(error);
  // Delivered = cash collected: the only moment a Purchase conversion is reported (server-side, once, consent-gated).
  if (parsed.data.status === "delivered") {
    try { await sendPurchaseForDeliveredOrder(params.id); } catch (e) { console.error("purchase event:", e); }
  }
  return NextResponse.json({ success: true, status: parsed.data.status });
}
