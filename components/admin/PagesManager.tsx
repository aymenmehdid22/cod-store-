"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { Field } from "./ui";
import { putJson } from "@/lib/upload-client";

export type PageRow = { slug: string; title: string; title_ar: string | null; body: string; body_ar: string | null; is_published: boolean; show_in_footer: boolean; sort_order: number };
const blank: PageRow = { slug: "", title: "", title_ar: "", body: "", body_ar: "", is_published: true, show_in_footer: true, sort_order: 10 };
const slugify = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60);

export default function PagesManager({ rows }: { rows: PageRow[] }) {
  const router = useRouter();
  const [d, setD] = useState<(PageRow & { isNew?: boolean }) | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!d) return;
    setBusy(true); setErr(null);
    const body = { slug: d.slug, title: d.title, title_ar: d.title_ar || null, body: d.body, body_ar: d.body_ar || null, is_published: d.is_published, show_in_footer: d.show_in_footer, sort_order: d.sort_order };
    const r = d.isNew ? await putJson("/api/admin/pages", body, "POST") : await putJson("/api/admin/pages/" + d.slug, body);
    setBusy(false);
    if (!r.ok) { setErr(r.message ?? "Erreur."); return; }
    setD(null); router.refresh();
  }
  async function remove(p: PageRow) {
    if (!window.confirm("Supprimer la page « " + p.title + " » ? Son adresse /p/" + p.slug + " cessera de fonctionner.")) return;
    const r = await putJson("/api/admin/pages/" + p.slug, {}, "DELETE");
    if (!r.ok) { setErr(r.message ?? "Suppression impossible."); return; }
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button type="button" onClick={() => { setD({ ...blank, isNew: true }); setErr(null); }} className="btn-primary !px-4 !py-2.5">Nouvelle page</button></div>
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {d && (
        <form onSubmit={save} className="card space-y-4 p-5" aria-label="Formulaire de page">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Titre (français)" htmlFor="p-t"><input id="p-t" className="input" required maxLength={120} value={d.title} onChange={(e) => setD({ ...d, title: e.target.value, slug: d.isNew && !d.slug ? slugify(e.target.value) : d.slug })} /></Field>
            <Field label="Titre (arabe)" htmlFor="p-ta"><input id="p-ta" dir="rtl" className="input" maxLength={120} value={d.title_ar ?? ""} onChange={(e) => setD({ ...d, title_ar: e.target.value })} /></Field>
            <Field label="Adresse (slug)" htmlFor="p-s" hint={"/p/" + (d.slug || "…")}><input id="p-s" dir="ltr" className="input" required disabled={!d.isNew} pattern="[a-z0-9]+(-[a-z0-9]+)*" value={d.slug} onChange={(e) => setD({ ...d, slug: e.target.value })} /></Field>
          </div>
          <Field label="Contenu (français)" htmlFor="p-b" hint="Texte simple : « ## Titre » pour un intertitre, « - » pour une liste, ligne vide pour un paragraphe. Le HTML n'est pas interprété."><textarea id="p-b" className="input min-h-[180px] font-mono text-xs" maxLength={20000} value={d.body} onChange={(e) => setD({ ...d, body: e.target.value })} /></Field>
          <Field label="Contenu (arabe)" htmlFor="p-ba"><textarea id="p-ba" dir="rtl" className="input min-h-[140px]" maxLength={20000} value={d.body_ar ?? ""} onChange={(e) => setD({ ...d, body_ar: e.target.value })} /></Field>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.is_published} onChange={(e) => setD({ ...d, is_published: e.target.checked })} /> Publiée</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={d.show_in_footer} onChange={(e) => setD({ ...d, show_in_footer: e.target.checked })} /> Lien dans le pied de page</label>
            <label className="flex items-center gap-2">Ordre <input type="number" min={0} max={1000} className="input !mt-0 w-20 !py-1.5" value={d.sort_order} onChange={(e) => setD({ ...d, sort_order: Math.max(0, Number(e.target.value) || 0) })} /></label>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setD(null)} className="rounded-xl px-4 py-2 text-sm text-muted hover:text-black">Annuler</button><button type="submit" disabled={busy} className="btn-primary !px-5 !py-2">{busy ? "…" : "Enregistrer"}</button></div>
        </form>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">{["Page", "Adresse", "Statut", ""].map((h, i) => <th key={i} scope="col" className="px-4 py-3 text-start font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
          <tbody>{rows.map((p) => (
            <tr key={p.slug} className="border-b border-border last:border-0 hover:bg-background">
              <td className="px-4 py-3 font-semibold">{p.title}</td><td className="px-4 py-3 text-muted" dir="ltr">/p/{p.slug}</td>
              <td className="px-4 py-3">{p.is_published ? "Publiée" : "Brouillon"}{p.show_in_footer ? " · pied de page" : ""}</td>
              <td className="px-4 py-3"><div className="flex justify-end gap-1">
                <button onClick={() => { setD({ ...p }); setErr(null); }} aria-label={"Modifier " + p.title} className="rounded-lg p-2 hover:bg-white"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => remove(p)} aria-label={"Supprimer " + p.title} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div></td>
            </tr>))}
            {rows.length === 0 && <tr><td colSpan={4} className="px-4 py-10 text-center text-muted">Aucune page.</td></tr>}</tbody>
        </table>
      </div>
    </div>
  );
}
