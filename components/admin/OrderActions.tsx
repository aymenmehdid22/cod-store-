"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { NEXT_STATUSES, ORDER_STATUSES, type OrderStatus } from "@/types/order";

const labelOf = (s: OrderStatus) => ORDER_STATUSES.find((x) => x.value === s)?.label ?? s;

export default function OrderActions({ id, status }: { id: string; status: OrderStatus }) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<OrderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const next = NEXT_STATUSES[status];

  async function change(to: OrderStatus) {
    if ((to === "cancelled" || to === "returned") &&
        !window.confirm("Passer la commande en « " + labelOf(to) + " » ? Le stock sera remis en vente et cette étape est définitive.")) return;
    setBusy(to);
    setError(null);
    try {
      const res = await fetch("/api/admin/orders/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to, note: note.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Échec de la mise à jour."); return; }
      setNote("");
      router.refresh();
    } catch {
      setError("Erreur réseau. Réessayez.");
    } finally {
      setBusy(null);
    }
  }

  if (next.length === 0) {
    return <p className="text-sm text-muted">Statut final : plus aucune transition possible.</p>;
  }
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor="status-note" className="label">Note de changement (optionnel)</label>
        <input id="status-note" className="input" value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} placeholder="Ex : client confirmé par téléphone" />
      </div>
      <div className="flex flex-wrap gap-2">
        {next.map((s) => (
          <button
            key={s}
            type="button"
            disabled={busy !== null}
            onClick={() => change(s)}
            className={"rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-60 " + (s === "cancelled" || s === "returned" ? "border border-red-200 bg-white text-red-700 hover:bg-red-50" : "bg-foreground text-white hover:bg-black")}
          >
            {busy === s ? "…" : "→ " + labelOf(s)}
          </button>
        ))}
      </div>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
    </div>
  );
}
