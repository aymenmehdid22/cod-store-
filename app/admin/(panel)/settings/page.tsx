import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import SettingsForm from "@/components/admin/SettingsForm";
import { mapSettings } from "@/lib/store-data";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requireAdminPage("settings.write");
  const { data } = await createClient().from("store_settings").select("key, value");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Réglages" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Réglages" }]} />
      <SettingsForm initial={mapSettings(data ?? [])} />
    </div>
  );
}
