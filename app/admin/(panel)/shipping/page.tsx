import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ShippingEditor from "@/components/admin/ShippingEditor";
import { WILAYAS } from "@/data/wilayas";
import { mapSettings } from "@/lib/store-data";

export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  await requireAdminPage("settings.write");
  const supabase = createClient();
  const [{ data: rates }, { data: settings }] = await Promise.all([
    supabase.from("shipping_rates").select("wilaya_code, home_fee, stopdesk_fee, is_active"),
    supabase.from("store_settings").select("key, value").eq("key", "shipping.free_over"),
  ]);
  const byCode = new Map((rates ?? []).map((r) => [r.wilaya_code, r]));
  const initial = WILAYAS.map((w) => { const r = byCode.get(w.code); return { code: w.code, name: w.name, home_fee: r ? String(r.home_fee) : "0", stopdesk_fee: r ? String(r.stopdesk_fee) : "0", is_active: r ? r.is_active : false }; });
  return (
    <div className="max-w-4xl">
      <PageHeader title="Livraison" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Livraison" }]} />
      <ShippingEditor initial={initial} freeOver={mapSettings(settings ?? []).freeOver} />
    </div>
  );
}
