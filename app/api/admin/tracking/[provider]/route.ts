import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { isProvider, trackingInput } from "@/lib/admin-schemas";

export const dynamic = "force-dynamic";

// Owner only. Saves an identifier + predefined event toggles — nothing executable. The storefront reads the config at
// each page load, so a visitor's open tab needs a refresh to pick up a change.
export async function PUT(request: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireAdminApi("tracking.write");
  if (!auth.ok) return auth.res;
  if (!isProvider(params.provider)) return NextResponse.json({ error: "Intégration inconnue." }, { status: 404 });
  const parsed = trackingInput(params.provider).safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Configuration invalide.", issues: parsed.error.flatten() }, { status: 400 });
  const d = parsed.data;
  const config: Record<string, unknown> = { events: d.events };
  if (d.conversion_label) config.conversion_label = d.conversion_label;
  if (d.test_event_code) config.test_event_code = d.test_event_code;
  const { error } = await auth.supabase.from("tracking_integrations")
    .update({ enabled: d.enabled, public_id: d.public_id, config, updated_by: auth.admin.user.id, updated_at: new Date().toISOString() })
    .eq("provider", params.provider);
  if (error) return rpcError(error);
  return NextResponse.json({ success: true });
}

// Reset: disabled, identifier removed, default toggles.
export async function DELETE(_req: NextRequest, { params }: { params: { provider: string } }) {
  const auth = await requireAdminApi("tracking.write");
  if (!auth.ok) return auth.res;
  if (!isProvider(params.provider)) return NextResponse.json({ error: "Intégration inconnue." }, { status: 404 });
  const { error } = await auth.supabase.from("tracking_integrations")
    .update({ enabled: false, public_id: null, config: {}, updated_by: auth.admin.user.id, updated_at: new Date().toISOString() })
    .eq("provider", params.provider);
  if (error) return rpcError(error);
  return NextResponse.json({ success: true });
}
