import { createClient } from "@/lib/supabase-server";
import { getAdmin } from "@/lib/auth";
import { can } from "@/lib/permissions";
import { PageHeader } from "@/components/admin/ui";
import TrackingManager, { type TrackingRow } from "@/components/admin/TrackingManager";
import { requireAdminPage } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MarketingPage() {
  await requireAdminPage("catalog.write");
  const admin = await getAdmin();
  const { data } = await createClient().from("tracking_integrations").select("provider, enabled, public_id, config");
  return (
    <div className="space-y-4">
      <PageHeader title="Marketing & Tracking" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Marketing & Tracking" }]} />
      <div className="card space-y-1.5 p-4 text-sm">
        <p className="font-semibold">Comment ça fonctionne</p>
        <ul className="list-disc space-y-1 ps-5 text-muted">
          <li>Aucun code à coller : saisissez un identifiant validé, les événements prédéfinis sont gérés par la boutique.</li>
          <li>Rien ne se charge ni ne s&apos;envoie avant le consentement du visiteur (bannière cookies). Si le consentement est retiré, les événements s&apos;arrêtent aussitôt ; rechargez la page pour décharger complètement les scripts.</li>
          <li>Aucun nom, téléphone, email ni adresse n&apos;est envoyé aux outils. Les paramètres d&apos;événements sont filtrés avant envoi.</li>
          <li><b>Lead</b> = commande passée. <b>Purchase</b> = commande <b>livrée</b> (paiement encaissé), envoyé une seule fois côté serveur à Meta. Une commande passée n&apos;est jamais comptée comme revenu.</li>
          <li>Les changements s&apos;appliquent au chargement suivant des pages (un onglet déjà ouvert doit être rechargé).</li>
          <li>Limites : les bloqueurs de publicité, les refus de consentement et le multi-appareil font que les outils voient moins que la réalité ; vos commandes en base restent la référence.</li>
        </ul>
      </div>
      <TrackingManager rows={(data ?? []) as TrackingRow[]} capiTokenSet={!!process.env.META_ACCESS_TOKEN} canEdit={can(admin?.role, "tracking.write")} />
    </div>
  );
}
