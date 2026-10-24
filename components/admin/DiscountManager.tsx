"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Field } from "./ui";
import { formatDZD, formatDate } from "@/lib/format";

export type DiscountRow = { id: string; code: string; type: "percent" | "fixed"; value: number; min_subtotal: number; starts_at: string | null; ends_at: string | null; usage_limit: number | null; used_count: number; is_active: boolean };
type Draft = { id?: string; code: string; type: "percent" | "fixed"; value: string; min_subtotal: string; starts_at: string; ends_at: string; usage_limit: string; is_active: boolean };

// Algeria is UTC+1 all year (no DST): local inputs are converted with an explicit +01:00 offset.
const toInput = (iso: string | null) => (iso ? new Date(iso).toLocaleString("sv-SE", { timeZone: "Africa/Algiers" }).replace(" ", "T").slice(0, 16) : "");
const toIso = (v: string) => (v ? new Date(v + ":00+01:00").toISOString() : null);

export function discountState(d: Pick<DiscountRow, "is_active" | "starts_at" | "ends_at" | "usage_limit" | "used_count">, now = Date.now()): { label: string; cls: string } {
  if (!d.is_active) return { label: "Désactivé", cls: "bg-gray-100 text-gray-700" };
  if (d.ends_at && new Date(d.ends_at).getTime() < now) return { label: "Expiré", cls: "bg-amber-50 text-amber-700" };
  if (d.usage_limit !== null && d.used_count >= d.usage_limit) return { label: "Épuisé", cls: "bg-amber-50 text-amber-700" };
  if (d.starts_at && new Date(d.starts_at).getTime() > now) return { label: "Programmé", cls: "bg-blue-50 text-blue-700" };
  return { label: "Actif", cls: "bg-green-50 text-green-700" };
}

export default function DiscountManager({ rows }: { rows: DiscountRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  const blank: Draft = { code: "", type: "percent", value: "10", min_subtotal: "0", starts_at: "", ends_at: "", usage_limit: "", is_active: true };
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true); setErrors([]);
    const res = await fetch(draft.id ? "/api/admin/discounts/" + draft.id : "/api/admin/discounts", {
      method: draft.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: draft.code, type: draft.type, value: Math.round(Number(draft.value)), min_subtotal: Math.round(Number(draft.min_subtotal) || 0), starts_at: toIso(draft.starts_at), ends_at: toIso(draft.ends_at), usage_limit: draft.usage_limit ? Math.round(Number(draft.usage_limit)) : null, is_active: draft.is_active }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      const m: string[] = [...(data.issues?.formErrors ?? []), ...Object.values((data.issues?.fieldErrors ?? {}) as Record<string, string[]>).flat()];
      setErrors(m.length ? m : [data.error ?? "Enregistrement impossible."]); return;
    }
    setDraft(null); router.refresh();
  }
  async function remove(r: DiscountRow) {
    if (!window.confirm("Supprimer le code " + r.code + " ? Les commandes déjà passées gardent leur remise. Pour l'arrêter, désactivez-le plutôt.")) return;
    const res = await fetch("/api/admin/discounts/" + r.id, { method: "DELETE" }).catch(() => null);
    if (!res || !res.ok) { setErrors(["Suppression impossible."]); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button type="button" onClick={() => { setDraft(blank); setErrors([]); }} className="btn-primary !px-4 !py-2.5">Nouveau code</button></div>
      {errors.length > 0 && <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"><ul className="list-disc ps-4">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul></div>}
      {draft && (
        <form onSubmit={save} className="card space-y-4 p-5" aria-label="Formulaire de code promo">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Code" htmlFor="d-code"><input id="d-code" dir="ltr" className="input uppercase" required value={draft.code} onChange={(e) => setDraft({ ...draft, code: e.target.value.toUpperCase() })} /></Field>
            <Field label="Type" htmlFor="d-type"><select id="d-type" className="input" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as Draft["type"] })}><option value="percent">Pourcentage</option><option value="fixed">Montant fixe (DA)</option></select></Field>
            <Field label={draft.type === "percent" ? "Valeur (%)" : "Valeur (DA)"} htmlFor="d-val"><input id="d-val" type="number" min={1} max={draft.type === "percent" ? 100 : undefined} required className="input" value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></Field>
            <Field label="Achat minimum (DA)" htmlFor="d-min"><input id="d-min" type="number" min={0} className="input" value={draft.min_subtotal} onChange={(e) => setDraft({ ...draft, min_subtotal: e.target.value })} /></Field>
            <Field label="Début (heure d'Alger)" htmlFor="d-start"><input id="d-start" type="datetime-local" className="input" value={draft.starts_at} onChange={(e) => setDraft({ ...draft, starts_at: e.target.value })} /></Field>
            <Field label="Fin (heure d'Alger)" htmlFor="d-end"><input id="d-end" type="datetime-local" className="input" value={draft.ends_at} onChange={(e) => setDraft({ ...draft, ends_at: e.target.value })} /></Field>
            <Field label="Limite d'utilisations" htmlFor="d-lim" hint="Vide = illimité."><input id="d-lim" type="number" min={1} className="input" value={draft.usage_limit} onChange={(e) => setDraft({ ...draft, usage_limit: e.target.value })} /></Field>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Actif</label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setDraft(null)} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-black">Annuler</button><button type="submit" disabled={busy} className="btn-primary !px-5 !py-2">{busy ? "…" : "Enregistrer"}</button></div>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">{["Code", "Remise", "Minimum", "Validité", "Utilisations", "État", ""].map((h, i) => <th key={i} scope="col" className="px-4 py-3 text-start font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => { const st = discountState(r); return (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3 font-bold" dir="ltr">{r.code}</td>
                <td className="px-4 py-3">{r.type === "percent" ? r.value + " %" : formatDZD(r.value, "DA")}</td>
                <td className="px-4 py-3">{r.min_subtotal ? formatDZD(r.min_subtotal, "DA") : "—"}</td>
                <td className="px-4 py-3 text-xs">{r.starts_at ? formatDate(r.starts_at) : "…"} → {r.ends_at ? formatDate(r.ends_at) : "…"}</td>
                <td className="px-4 py-3">{r.used_count}{r.usage_limit ? " / " + r.usage_limit : ""}</td>
                <td className="px-4 py-3"><span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + st.cls}>{st.label}</span></td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1">
                  <button onClick={() => { setDraft({ id: r.id, code: r.code, type: r.type, value: String(r.value), min_subtotal: String(r.min_subtotal), starts_at: toInput(r.starts_at), ends_at: toInput(r.ends_at), usage_limit: r.usage_limit ? String(r.usage_limit) : "", is_active: r.is_active }); setErrors([]); }} aria-label={"Modifier " + r.code} className="rounded-lg p-2 hover:bg-white"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => remove(r)} aria-label={"Supprimer " + r.code} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>); })}
            {rows.length === 0 && <tr><td colSpan={7} className="px-4 py-10 text-center text-muted">Aucun code promo.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
