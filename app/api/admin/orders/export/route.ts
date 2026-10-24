import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, rpcError } from "@/lib/auth";
import { ORDER_STATUSES } from "@/types/order";
import { csvCell as cell } from "@/lib/csv";

export const dynamic = "force-dynamic";
const MAX_ROWS = 5000;

export async function GET(request: NextRequest) {
  const auth = await requireAdminApi("orders.export"); // customer data: owner/manager only
  if (!auth.ok) return auth.res;

  const sp = request.nextUrl.searchParams;
  let query = auth.supabase
    .from("orders")
    .select("order_number, created_at, status, customer_name, phone, wilaya_name, delivery_type, commune, address, stopdesk, product_name, variant_name, quantity, unit_price, subtotal, discount_amount, discount_code, shipping_fee, total_price, currency, utm_source, utm_campaign")
    .order("created_at", { ascending: false })
    .limit(MAX_ROWS);
  const status = sp.get("status");
  if (status && ORDER_STATUSES.some((s) => s.value === status)) query = query.eq("status", status);
  const from = sp.get("from");
  const to = sp.get("to");
  if (from && /^\d{4}-\d{2}-\d{2}$/.test(from)) query = query.gte("created_at", from);
  if (to && /^\d{4}-\d{2}-\d{2}$/.test(to)) query = query.lt("created_at", to + "T23:59:59.999Z");

  const { data, error } = await query;
  if (error) return rpcError(error);
  const rows = data ?? [];

  const { error: logError } = await auth.supabase.rpc("admin_log_export", { p_entity: "orders", p_rows: rows.length });
  if (logError) return rpcError(logError);

  const header = ["N° commande","Date","Statut","Client","Téléphone","Wilaya","Livraison","Commune","Adresse","Stopdesk","Produit","Variante","Quantité","Prix unitaire","Sous-total","Remise","Code promo","Frais de livraison","Total","Devise","Source","Campagne"];
  const lines = [header.map(cell).join(",")];
  for (const r of rows) {
    lines.push([r.order_number, r.created_at, r.status, r.customer_name, r.phone, r.wilaya_name, r.delivery_type, r.commune, r.address, r.stopdesk, r.product_name, r.variant_name, r.quantity, r.unit_price, r.subtotal, r.discount_amount, r.discount_code, r.shipping_fee, r.total_price, r.currency, r.utm_source, r.utm_campaign].map(cell).join(","));
  }
  const csv = "\uFEFF" + lines.join("\r\n"); // BOM so Excel reads UTF-8 (accents, Arabic)
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="commandes-' + new Date().toISOString().slice(0, 10) + '.csv"',
      "Cache-Control": "no-store",
    },
  });
}
