import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";

export const dynamic = "force-dynamic";
const schema = z.object({ body: z.string().trim().min(1).max(2000) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAdminApi("orders.update");
  if (!auth.ok) return auth.res;
  if (!z.string().uuid().safeParse(params.id).success) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Note vide ou trop longue." }, { status: 400 });
  // RLS requires author_id = auth.uid() and an admin role.
  const { error } = await auth.supabase.from("order_notes").insert({ order_id: params.id, author_id: auth.admin.user.id, body: parsed.data.body });
  if (error) return rpcError(error);
  return NextResponse.json({ success: true }, { status: 201 });
}
