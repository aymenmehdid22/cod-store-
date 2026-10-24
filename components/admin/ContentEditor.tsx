"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Field } from "./ui";
import { putJson, uploadStoreAsset } from "@/lib/upload-client";

type Loc = { title?: string; subtitle?: string; cta?: string };
export type Section = { section_key: string; sort_order: number; is_visible: boolean; content: { image_url?: string | null; fr?: Loc; ar?: Loc; items?: { fr: string; ar: string }[] } };
const NAMES: Record<string, string> = { hero: "Bandeau principal (hero)", featured: "Produits mis en avant", categories: "Catégories", trust: "Éléments de confiance" };

function SectionCard({ sec, index, total, onMove }: { sec: Section; index: number; total: number; onMove: (d: -1 | 1) => void }) {
  const router = useRouter();
  const [s, setS] = useState(sec);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const loc = (l: "fr" | "ar", k: keyof Loc, v: string) => setS({ ...s, content: { ...s.content, [l]: { ...s.content[l], [k]: v } } });
  const key = s.section_key;

  async function save() {
    setBusy(true); setMsg(null);
    const r = await putJson("/api/admin/content/" + key, { is_visible: s.is_visible, sort_order: s.sort_order, content: s.content });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Enregistré." } : { ok: false, text: r.message ?? "Erreur." });
    if (r.ok) router.refresh();
  }
  async function pickImage(file?: File) {
    if (!file) return;
    const r = await uploadStoreAsset(file, "home");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    setS({ ...s, content: { ...s.content, image_url: r.url } });
  }

  return (
    <section className="card space-y-4 p-5" aria-labelledby={"c-" + key}>
      <div className="flex items-center justify-between gap-2">
        <h2 id={"c-" + key} className="text-sm font-semibold uppercase tracking-wide">{NAMES[key] ?? key}</h2>
        <div className="flex items-center gap-1">
          <button type="button" disabled={index === 0} onClick={() => onMove(-1)} aria-label={"Monter " + (NAMES[key] ?? key)} className="rounded-lg p-1.5 hover:bg-background disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
          <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} aria-label={"Descendre " + (NAMES[key] ?? key)} className="rounded-lg p-1.5 hover:bg-background disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={s.is_visible} onChange={(e) => setS({ ...s, is_visible: e.target.checked })} /> Section visible</label>

      {(key === "hero" || key === "featured" || key === "categories") && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Titre (français)" htmlFor={key + "-tf"}><input id={key + "-tf"} className="input" maxLength={120} value={s.content.fr?.title ?? ""} onChange={(e) => loc("fr", "title", e.target.value)} /></Field>
          <Field label="Titre (arabe)" htmlFor={key + "-ta"}><input id={key + "-ta"} dir="rtl" className="input" maxLength={120} value={s.content.ar?.title ?? ""} onChange={(e) => loc("ar", "title", e.target.value)} /></Field>
        </div>
      )}
      {key === "hero" && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Sous-titre (français)" htmlFor="h-sf"><input id="h-sf" className="input" maxLength={240} value={s.content.fr?.subtitle ?? ""} onChange={(e) => loc("fr", "subtitle", e.target.value)} /></Field>
            <Field label="Sous-titre (arabe)" htmlFor="h-sa"><input id="h-sa" dir="rtl" className="input" maxLength={240} value={s.content.ar?.subtitle ?? ""} onChange={(e) => loc("ar", "subtitle", e.target.value)} /></Field>
            <Field label="Bouton (français)" htmlFor="h-cf"><input id="h-cf" className="input" maxLength={40} value={s.content.fr?.cta ?? ""} onChange={(e) => loc("fr", "cta", e.target.value)} /></Field>
            <Field label="Bouton (arabe)" htmlFor="h-ca"><input id="h-ca" dir="rtl" className="input" maxLength={40} value={s.content.ar?.cta ?? ""} onChange={(e) => loc("ar", "cta", e.target.value)} /></Field>
          </div>
          <div><span className="label">Image de fond</span><div className="mt-2 flex items-center gap-3">
            {s.content.image_url && <Image src={s.content.image_url} alt="" width={96} height={56} className="h-14 w-24 rounded-lg border border-border object-cover" />}
            <input type="file" accept="image/*" aria-label="Téléverser l'image du bandeau" onChange={(e) => pickImage(e.target.files?.[0])} className="text-xs" />
            {s.content.image_url && <button type="button" className="text-xs text-muted underline" onClick={() => setS({ ...s, content: { ...s.content, image_url: null } })}>retirer</button>}</div></div>
        </>
      )}
      {key === "trust" && (
        <div className="space-y-2">
          {(s.content.items ?? []).map((it, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <input aria-label={"Élément " + (i + 1) + " (français)"} className="input !mt-0 flex-1" maxLength={80} value={it.fr} onChange={(e) => setS({ ...s, content: { ...s.content, items: s.content.items!.map((x, j) => (j === i ? { ...x, fr: e.target.value } : x)) } })} />
              <input aria-label={"Élément " + (i + 1) + " (arabe)"} dir="rtl" className="input !mt-0 flex-1" maxLength={80} value={it.ar} onChange={(e) => setS({ ...s, content: { ...s.content, items: s.content.items!.map((x, j) => (j === i ? { ...x, ar: e.target.value } : x)) } })} />
              <button type="button" aria-label="Supprimer l'élément" onClick={() => setS({ ...s, content: { ...s.content, items: s.content.items!.filter((_, j) => j !== i) } })} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
            </div>))}
          {(s.content.items ?? []).length < 6 && <button type="button" onClick={() => setS({ ...s, content: { ...s.content, items: [...(s.content.items ?? []), { fr: "", ar: "" }] } })} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"><Plus className="h-4 w-4" aria-hidden /> Ajouter</button>}
        </div>
      )}
      {msg && <p role={msg.ok ? "status" : "alert"} className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
      <button type="button" disabled={busy} onClick={save} className="btn-primary !px-5 !py-2">{busy ? "…" : "Enregistrer la section"}</button>
    </section>
  );
}

export default function ContentEditor({ sections }: { sections: Section[] }) {
  const router = useRouter();
  const [err, setErr] = useState<string | null>(null);
  // Reordering swaps the two sort_order values and saves both sections (content is re-sent unchanged from the server copy).
  async function move(i: number, d: -1 | 1) {
    const a = sections[i], b = sections[i + d];
    if (!b) return;
    setErr(null);
    const r1 = await putJson("/api/admin/content/" + a.section_key, { is_visible: a.is_visible, sort_order: b.sort_order, content: a.content });
    const r2 = await putJson("/api/admin/content/" + b.section_key, { is_visible: b.is_visible, sort_order: a.sort_order, content: b.content });
    if (!r1.ok || !r2.ok) setErr("Réorganisation impossible.");
    router.refresh();
  }
  return (
    <div className="space-y-4">
      {err && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{err}</p>}
      {sections.map((s, i) => <SectionCard key={s.section_key + s.sort_order} sec={s} index={i} total={sections.length} onMove={(d) => move(i, d)} />)}
    </div>
  );
}
