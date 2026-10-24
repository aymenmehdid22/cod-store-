import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import PagesManager, { type PageRow } from "@/components/admin/PagesManager";

export const dynamic = "force-dynamic";

export default async function PagesAdmin() {
  await requireAdminPage("settings.write");
  const { data } = await createClient().from("store_pages").select("slug, title, title_ar, body, body_ar, is_published, show_in_footer, sort_order").order("sort_order");
  return (
    <div>
      <PageHeader title="Pages d'information" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Pages" }]} />
      <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Les textes fournis (livraison, retours, FAQ, confidentialité, CGV) sont des <b>modèles à relire et adapter</b> à votre activité avant la mise en production.</p>
      <PagesManager rows={(data ?? []) as PageRow[]} />
    </div>
  );
}
