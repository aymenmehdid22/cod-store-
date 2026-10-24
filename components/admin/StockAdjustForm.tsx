"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const REASONS = [
  { v: "restock", l: "Réapprovisionnement (+)" },
  { v: "correction", l: "Correction d'inventaire (+/−)" },
  { v: "damage", l: "Casse / perte (−)" },
  { v: "return", l: "Retour client (+)" },
];

export default function StockAdjustForm({ productId, variantId, label, current }: { productId: string; variantId: string | null; label: string; current: number }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [delta, setDelta] = useState("");
  const [reason, setReason] = useState("restock");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.round(Number(delta));
    if (!n) { setError("Indiquez une variation non nulle."); return; }
    const signed = reason === "damage" ? -Math.abs(n) : reason === "restock" || reason === "return" ? Math.abs(n) : n;
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/inventory/adjust", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId, variant_id: variantId, delta: signed, reason, note: note || null }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setError(data.error ?? "Ajustement impossible."); return; }
    setOpen(false); setDelta(""); setNote(""); router.refresh();
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} aria-label={"Ajuster le stock de " + label} className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-white">Ajuster</button>;
  return (
    <form onSubmit={submit} className="space-y-2 rounded-xl border border-border bg-white p-3 text-start" aria-label={"Ajustement du stock de " + label}>
      <p className="text-xs text-muted">Stock actuel : <b>{current}</b></p>
      <div className="flex flex-wrap gap-2">
        <input type="number" aria-label="Quantité" className="input !mt-0 w-24 !py-1.5" placeholder="Qté" value={delta} onChange={(e) => setDelta(e.target.value)} required />
        <select aria-label="Motif" className="input !mt-0 w-56 !py-1.5" value={reason} onChange={(e) => setReason(e.target.value)}>{REASONS.map((r) => <option key={r.v} value={r.v}>{r.l}</option>)}</select>
      </div>
      <input aria-label="Note" className="input !mt-0 !py-1.5" placeholder="Note (optionnel)" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
      {error && <p role="alert" className="text-xs text-red-700">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="btn-primary !px-3 !py-1.5 !text-xs">{busy ? "…" : "Valider"}</button>
        <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted">Annuler</button>
      </div>
    </form>
  );
}
