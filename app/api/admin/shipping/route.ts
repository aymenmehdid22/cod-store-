import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { shippingInput } from "@/lib/admin-schemas";
import { WILAYAS } from "@/data/wilayas";

export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi("settings.write");
  if (!auth.ok) return auth.res;
  const parsed = shippingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Données invalides." }, { status: 400 });
  const valid = new Set(WILAYAS.map((w) => w.code));
  if (parsed.data.rates.some((r) => !valid.has(r.wilaya_code))) return NextResponse.json({ error: "Wilaya inconnue." }, { status: 400 });
  const { error } = await auth.supabase.from("shipping_rates").upsert(parsed.data.rates.map((r) => ({ ...r, updated_at: new Date().toISOString() })));
  if (error) return rpcError(error);
  return NextResponse.json({ success: true });
}
