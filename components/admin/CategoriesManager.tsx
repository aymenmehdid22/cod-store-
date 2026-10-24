"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import { Field } from "./ui";

export type CategoryRow = {
  id: string; kind: "category" | "collection"; slug: string; name: string; name_ar: string | null; description: string | null;
  description_ar: string | null; image_url: string | null; sort_order: number; is_active: boolean; seo_title: string | null;
  seo_description: string | null; product_count: number;
};
type Draft = Omit<CategoryRow, "id" | "product_count"> & { id?: string };

const blank: Draft = { kind: "category", slug: "", name: "", name_ar: "", description: "", description_ar: "", image_url: "", sort_order: 0, is_active: true, seo_title: "", seo_description: "" };
const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");

export default function CategoriesManager({ rows }: { rows: CategoryRow[] }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [slugTouched, setSlugTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const body = (d: Draft) => ({
    kind: d.kind, slug: d.slug, name: d.name, name_ar: d.name_ar || null, description: d.description || null,
    description_ar: d.description_ar || null, image_url: d.image_url || null, sort_order: d.sort_order, is_active: d.is_active,
    seo_title: d.seo_title || null, seo_description: d.seo_description || null,
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setBusy(true); setError(null);
    const res = await fetch(draft.id ? "/api/admin/categories/" + draft.id : "/api/admin/categories", {
      method: draft.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body(draft)),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setError(data.error ?? "Enregistrement impossible."); return; }
    setDraft(null); router.refresh();
  }

  async function remove(r: CategoryRow) {
    if (r.product_count > 0) { setError("« " + r.name + " » contient " + r.product_count + " produit(s) : retirez-les avant de la supprimer."); return; }
    if (!window.confirm("Supprimer « " + r.name + " » ?")) return;
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/categories/" + r.id, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { const d = res ? await res.json().catch(() => ({})) : {}; setError(d.error ?? "Suppression impossible."); return; }
    router.refresh();
  }

  // Reordering swaps sort_order values between two neighbours.
  async function move(i: number, d: -1 | 1) {
    const a = rows[i], b = rows[i + d];
    if (!b) return;
    setBusy(true); setError(null);
    const put = (r: CategoryRow, order: number) => fetch("/api/admin/categories/" + r.id, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body({ ...r, sort_order: order })) });
    const ao = a.sort_order === b.sort_order ? a.sort_order + d : a.sort_order;
    const results = await Promise.all([put(a, b.sort_order === ao ? ao + d : b.sort_order), put(b, ao)]).catch(() => null);
    setBusy(false);
    if (!results || results.some((r) => !r.ok)) setError("Réorganisation impossible.");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      <div className="flex justify-end">
        <button type="button" onClick={() => { setDraft({ ...blank, sort_order: rows.length }); setSlugTouched(false); setError(null); }} className="btn-primary !px-4 !py-2.5">Nouvelle catégorie</button>
      </div>

      {draft && (
        <form onSubmit={save} className="card space-y-4 p-5" aria-label="Formulaire catégorie">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Nom" htmlFor="c-name"><input id="c-name" className="input" required value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value, slug: slugTouched ? draft.slug : slugify(e.target.value) })} /></Field>
            <Field label="Slug" htmlFor="c-slug"><input id="c-slug" dir="ltr" className="input" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={draft.slug} onChange={(e) => { setSlugTouched(true); setDraft({ ...draft, slug: e.target.value }); }} /></Field>
            <Field label="Type" htmlFor="c-kind"><select id="c-kind" className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Draft["kind"] })}><option value="category">Catégorie</option><option value="collection">Collection</option></select></Field>
            <Field label="Nom (arabe)" htmlFor="c-ar"><input id="c-ar" dir="rtl" className="input" value={draft.name_ar ?? ""} onChange={(e) => setDraft({ ...draft, name_ar: e.target.value })} /></Field>
            <Field label="Image (URL)" htmlFor="c-img"><input id="c-img" dir="ltr" className="input" placeholder="https://…" value={draft.image_url ?? ""} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} /></Field>
            <Field label="Ordre" htmlFor="c-ord"><input id="c-ord" type="number" min={0} className="input" value={draft.sort_order} onChange={(e) => setDraft({ ...draft, sort_order: Math.max(0, Number(e.target.value) || 0) })} /></Field>
          </div>
          <Field label="Description" htmlFor="c-desc"><textarea id="c-desc" className="input min-h-[70px]" value={draft.description ?? ""} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titre SEO" htmlFor="c-st"><input id="c-st" className="input" maxLength={70} value={draft.seo_title ?? ""} onChange={(e) => setDraft({ ...draft, seo_title: e.target.value })} /></Field>
            <Field label="Meta description" htmlFor="c-sd"><input id="c-sd" className="input" maxLength={200} value={draft.seo_description ?? ""} onChange={(e) => setDraft({ ...draft, seo_description: e.target.value })} /></Field>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={draft.is_active} onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })} /> Visible sur la boutique</label>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setDraft(null)} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-black">Annuler</button>
            <button type="submit" disabled={busy} className="btn-primary !px-5 !py-2">{busy ? "…" : "Enregistrer"}</button>
          </div>
        </form>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th scope="col" className="px-4 py-3 text-start font-medium">Nom</th><th scope="col" className="px-4 py-3 text-start font-medium">Type</th>
            <th scope="col" className="px-4 py-3 text-start font-medium">Produits</th><th scope="col" className="px-4 py-3 text-start font-medium">Visible</th>
            <th scope="col" className="px-4 py-3 text-end font-medium">Actions</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background">
                <td className="px-4 py-3"><span className="font-semibold">{r.name}</span> <span className="text-xs text-muted" dir="ltr">/{r.slug}</span></td>
                <td className="px-4 py-3">{r.kind === "collection" ? "Collection" : "Catégorie"}</td>
                <td className="px-4 py-3">{r.product_count}</td>
                <td className="px-4 py-3">{r.is_active ? "Oui" : "Non"}</td>
                <td className="px-4 py-3"><div className="flex justify-end gap-1">
                  <button disabled={busy || i === 0} onClick={() => move(i, -1)} aria-label={"Monter " + r.name} className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button disabled={busy || i === rows.length - 1} onClick={() => move(i, 1)} aria-label={"Descendre " + r.name} className="rounded-lg p-2 hover:bg-white disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button onClick={() => { setDraft({ ...r }); setSlugTouched(true); setError(null); }} aria-label={"Modifier " + r.name} className="rounded-lg p-2 hover:bg-white"><Pencil className="h-4 w-4" /></button>
                  <button disabled={busy} onClick={() => remove(r)} aria-label={"Supprimer " + r.name} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Aucune catégorie. Créez-en une pour organiser vos produits.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
