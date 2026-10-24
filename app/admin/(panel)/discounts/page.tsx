import { createClient } from "@/lib/supabase-server";
import { requireAdminPage } from "@/lib/auth";
import { PageHeader } from "@/components/admin/ui";
import DiscountManager, { type DiscountRow } from "@/components/admin/DiscountManager";

export const dynamic = "force-dynamic";

export default async function DiscountsPage() {
  await requireAdminPage("catalog.write");
  const { data } = await createClient().from("discounts").select("id, code, type, value, min_subtotal, starts_at, ends_at, usage_limit, used_count, is_active").order("created_at", { ascending: false });
  return (
    <div>
      <PageHeader title="Promotions" crumbs={[{ label: "Admin", href: "/admin" }, { label: "Promotions" }]} />
      <DiscountManager rows={(data ?? []) as DiscountRow[]} />
      <p className="mt-3 text-xs text-muted">Les codes sont validés côté serveur à chaque commande (dates, plafond d&apos;utilisation, minimum d&apos;achat). La remise s&apos;applique au sous-total, avant la livraison.</p>
    </div>
  );
}
