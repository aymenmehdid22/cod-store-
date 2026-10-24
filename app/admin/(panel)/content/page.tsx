import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import ContentEditor, { type Section } from "@/components/admin/ContentEditor";

export const dynamic = "force-dynamic";

export default async function ContentPage() {
  await requireAdminPage("settings.write");
  const { data } = await createClient().from("content_sections").select("section_key, sort_order, is_visible, content").eq("page", "home").order("sort_order");
  return (
    <div className="max-w-3xl">
      <PageHeader title="Contenu de l'accueil" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Contenu" }]} />
      <p className="mb-4 text-sm text-muted">Visible sur « / » lorsque la redirection vers la fiche produit est désactivée (Réglages → Page d&apos;accueil).</p>
      <ContentEditor sections={(data ?? []) as Section[]} />
    </div>
  );
}
