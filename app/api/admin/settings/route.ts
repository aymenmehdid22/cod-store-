import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { SETTING_SCHEMAS, type SettingKey } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";
const envelope = z.object({ key: z.string(), value: z.unknown() });

// Whitelisted keys only, each with its own schema. All of them are public (storefront-visible) by design.
export async function PUT(request: NextRequest) {
  const auth = await requireAdminApi("settings.write");
  if (!auth.ok) return auth.res;
  const env = envelope.safeParse(await request.json().catch(() => null));
  if (!env.success || !(env.data.key in SETTING_SCHEMAS)) return NextResponse.json({ error: "Réglage inconnu." }, { status: 400 });
  const key = env.data.key as SettingKey;
  const parsed = (SETTING_SCHEMAS[key] as z.ZodTypeAny).safeParse(env.data.value);
  if (!parsed.success) return NextResponse.json({ error: "Valeur invalide.", issues: parsed.error.flatten() }, { status: 400 });
  const { error } = await auth.supabase.from("store_settings").upsert({ key, value: parsed.data, is_public: true, updated_by: auth.admin.user.id, updated_at: new Date().toISOString() });
  if (error) return rpcError(error);
  return NextResponse.json({ success: true });
}
