"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { putJson } from "@/lib/upload-client";

export type RateRow = { code: string; name: string; home_fee: string; stopdesk_fee: string; is_active: boolean };

export default function ShippingEditor({ initial, freeOver }: { initial: RateRow[]; freeOver: number | null }) {
  const router = useRouter();
  const [rows, setRows] = useState(initial);
  const [free, setFree] = useState(freeOver ? String(freeOver) : "");
  const [bulk, setBulk] = useState({ home: "", desk: "" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const patch = (i: number, p: Partial<RateRow>) => setRows((r) => r.map((x, j) => (j === i ? { ...x, ...p } : x)));

  async function save() {
    setBusy(true); setMsg(null);
    const r1 = await putJson("/api/admin/shipping", { rates: rows.map((r) => ({ wilaya_code: r.code, home_fee: Math.max(0, Math.round(Number(r.home_fee) || 0)), stopdesk_fee: Math.max(0, Math.round(Number(r.stopdesk_fee) || 0)), is_active: r.is_active })) });
    const r2 = r1.ok ? await putJson("/api/admin/settings", { key: "shipping.free_over", value: free.trim() ? Math.round(Number(free)) : null }) : r1;
    setBusy(false);
    setMsg(r2.ok ? { ok: true, text: "Tarifs enregistrés." } : { ok: false, text: r2.message ?? "Erreur." });
    if (r2.ok) router.refresh();
  }
  return (
    <div className="space-y-4">
      <section className="card grid gap-4 p-5 sm:grid-cols-3" aria-label="Actions groupées">
        <div><label htmlFor="b-h" className="label">Appliquer à toutes : domicile (DA)</label><input id="b-h" type="number" min={0} className="input" value={bulk.home} onChange={(e) => setBulk({ ...bulk, home: e.target.value })} /></div>
        <div><label htmlFor="b-d" className="label">Appliquer à toutes : Stopdesk (DA)</label><input id="b-d" type="number" min={0} className="input" value={bulk.desk} onChange={(e) => setBulk({ ...bulk, desk: e.target.value })} /></div>
        <div className="flex items-end"><button type="button" onClick={() => setRows((r) => r.map((x) => ({ ...x, home_fee: bulk.home !== "" ? bulk.home : x.home_fee, stopdesk_fee: bulk.desk !== "" ? bulk.desk : x.stopdesk_fee })))} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm hover:bg-background">Appliquer</button></div>
        <div className="sm:col-span-3"><label htmlFor="free" className="label">Livraison offerte à partir de (DA, après remise)</label><input id="free" type="number" min={1} className="input max-w-xs" value={free} onChange={(e) => setFree(e.target.value)} placeholder="vide = jamais" /></div>
      </section>
      <p className="text-xs text-muted">Une wilaya sans tarif actif est facturée 0 DA de livraison. Les frais s&apos;affichent dans le récapitulatif dès que le client choisit sa wilaya et sont figés sur la commande.</p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted"><th scope="col" className="px-4 py-3 text-start font-medium">Wilaya</th><th scope="col" className="px-4 py-3 text-start font-medium">Domicile (DA)</th><th scope="col" className="px-4 py-3 text-start font-medium">Stopdesk (DA)</th><th scope="col" className="px-4 py-3 text-start font-medium">Actif</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.code} className="border-b border-border last:border-0">
              <td className="px-4 py-2 font-medium">{r.code} — {r.name}</td>
              <td className="px-4 py-2"><input type="number" min={0} aria-label={"Domicile " + r.name} className="input !mt-0 w-28 !py-1.5" value={r.home_fee} onChange={(e) => patch(i, { home_fee: e.target.value })} /></td>
              <td className="px-4 py-2"><input type="number" min={0} aria-label={"Stopdesk " + r.name} className="input !mt-0 w-28 !py-1.5" value={r.stopdesk_fee} onChange={(e) => patch(i, { stopdesk_fee: e.target.value })} /></td>
              <td className="px-4 py-2"><input type="checkbox" aria-label={"Actif " + r.name} checked={r.is_active} onChange={(e) => patch(i, { is_active: e.target.checked })} /></td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        {msg && <p role={msg.ok ? "status" : "alert"} className={"me-auto text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
        <button type="button" disabled={busy} onClick={save} className="btn-primary !px-6 !py-2.5">{busy ? "…" : "Enregistrer"}</button>
      </div>
    </div>
  );
}
