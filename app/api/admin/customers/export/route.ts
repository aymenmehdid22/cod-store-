import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { csvCell } from "@/lib/csv";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("orders.export"); // personal data: owner/manager only
  if (!auth.ok) return auth.res;
  const sp = request.nextUrl.searchParams;
  const segment = ["prospect", "new", "returning", "loyal", "lapsed"].includes(sp.get("segment") ?? "") ? sp.get("segment") : null;
  const { data, error } = await auth.supabase.rpc("admin_customers", { p_q: (sp.get("q") ?? "").slice(0, 60), p_segment: segment, p_limit: 5000, p_offset: 0 });
  if (error) return rpcError(error);
  const rows = (data ?? []) as { name: string; phone: string; wilaya_name: string | null; tags: string[]; orders: number; total_spent: number; aov: number | null; first_order_at: string | null; last_order_at: string | null; segment: string; lapsed: boolean }[];
  const { error: logError } = await auth.supabase.rpc("admin_log_export", { p_entity: "customers", p_rows: rows.length });
  if (logError) return rpcError(logError);
  const lines = [["Nom", "Téléphone", "Wilaya", "Segment", "Inactif 90j", "Commandes", "Total dépensé", "Panier moyen", "Première commande", "Dernière commande", "Tags"].map(csvCell).join(",")];
  for (const r of rows) lines.push([r.name, r.phone, r.wilaya_name, r.segment, r.lapsed ? "oui" : "non", r.orders, r.total_spent, r.aov, r.first_order_at, r.last_order_at, (r.tags ?? []).join("|")].map(csvCell).join(","));
  return new NextResponse("\uFEFF" + lines.join("\r\n"), {
    headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="clients-' + new Date().toISOString().slice(0, 10) + '.csv"', "Cache-Control": "no-store" },
  });
}
