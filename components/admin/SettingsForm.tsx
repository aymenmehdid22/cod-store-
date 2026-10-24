"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Field } from "./ui";
import { putJson, uploadStoreAsset } from "@/lib/upload-client";
import type { StoreSettings } from "@/lib/store-data";

export default function SettingsForm({ initial }: { initial: StoreSettings }) {
  const router = useRouter();
  const [f, setF] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const set = <K extends keyof StoreSettings>(k: K, v: StoreSettings[K]) => setF((p) => ({ ...p, [k]: v }));
  const section = "card space-y-4 p-5";
  const h2 = "text-sm font-semibold uppercase tracking-wide";

  async function upload(kind: "logoUrl" | "faviconUrl" | "ogImage", file: File | undefined) {
    if (!file) return;
    setMsg(null);
    const r = await uploadStoreAsset(file, "branding");
    if (r.error) { setMsg({ ok: false, text: r.error }); return; }
    if (kind === "ogImage") set("seo", { ...f.seo, og_image: r.url! }); else set(kind, r.url!);
  }

  async function saveAll(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const writes: [string, unknown][] = [
      ["store.name", f.name], ["store.logo_url", f.logoUrl], ["store.favicon_url", f.faviconUrl], ["store.contact", f.contact],
      ["store.social", f.social], ["store.announcement", f.announcement], ["store.seo", f.seo],
      ["home.layout", f.home],
    ];
    for (const [key, value] of writes) {
      const r = await putJson("/api/admin/settings", { key, value });
      if (!r.ok) { setBusy(false); setMsg({ ok: false, text: key + " : " + (r.message ?? "erreur") }); return; }
    }
    setBusy(false); setMsg({ ok: true, text: "Réglages enregistrés." }); router.refresh();
  }

  const preview = (url: string | null, alt: string) => url ? <Image src={url} alt={alt} width={64} height={64} className="h-16 w-16 rounded-lg border border-border bg-white object-contain" /> : null;
  return (
    <form onSubmit={saveAll} className="space-y-5">
      <section className={section} aria-labelledby="s-id"><h2 id="s-id" className={h2}>Identité</h2>
        <Field label="Nom de la boutique" htmlFor="st-name"><input id="st-name" className="input" required maxLength={80} value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><span className="label">Logo</span><div className="mt-2 flex items-center gap-3">{preview(f.logoUrl, "Logo")}<input type="file" accept="image/*" aria-label="Téléverser le logo" onChange={(e) => upload("logoUrl", e.target.files?.[0])} className="text-xs" />{f.logoUrl && <button type="button" className="text-xs text-muted underline" onClick={() => set("logoUrl", null)}>retirer</button>}</div></div>
          <div><span className="label">Favicon</span><div className="mt-2 flex items-center gap-3">{preview(f.faviconUrl, "Favicon")}<input type="file" accept="image/*" aria-label="Téléverser le favicon" onChange={(e) => upload("faviconUrl", e.target.files?.[0])} className="text-xs" />{f.faviconUrl && <button type="button" className="text-xs text-muted underline" onClick={() => set("faviconUrl", null)}>retirer</button>}</div></div>
        </div>
      </section>
      <section className={section} aria-labelledby="s-ct"><h2 id="s-ct" className={h2}>Contact & réseaux</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Téléphone" htmlFor="ct-p"><input id="ct-p" dir="ltr" className="input" value={f.contact.phone ?? ""} onChange={(e) => set("contact", { ...f.contact, phone: e.target.value || null })} /></Field>
          <Field label="WhatsApp" htmlFor="ct-w"><input id="ct-w" dir="ltr" className="input" value={f.contact.whatsapp ?? ""} onChange={(e) => set("contact", { ...f.contact, whatsapp: e.target.value || null })} /></Field>
          <Field label="Email" htmlFor="ct-e"><input id="ct-e" type="email" dir="ltr" className="input" value={f.contact.email ?? ""} onChange={(e) => set("contact", { ...f.contact, email: e.target.value || null })} /></Field>
          {(["instagram", "facebook", "tiktok"] as const).map((k) => <Field key={k} label={k[0].toUpperCase() + k.slice(1) + " (URL https)"} htmlFor={"so-" + k}><input id={"so-" + k} dir="ltr" className="input" placeholder="https://…" value={f.social[k] ?? ""} onChange={(e) => set("social", { ...f.social, [k]: e.target.value || null })} /></Field>)}
        </div>
      </section>
      <section className={section} aria-labelledby="s-an"><h2 id="s-an" className={h2}>Bandeau d&apos;annonce</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.announcement.enabled} onChange={(e) => set("announcement", { ...f.announcement, enabled: e.target.checked })} /> Afficher le bandeau en haut de la boutique</label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Texte (français)" htmlFor="an-fr"><input id="an-fr" className="input" maxLength={160} value={f.announcement.text_fr} onChange={(e) => set("announcement", { ...f.announcement, text_fr: e.target.value })} /></Field>
          <Field label="Texte (arabe)" htmlFor="an-ar"><input id="an-ar" dir="rtl" className="input" maxLength={160} value={f.announcement.text_ar} onChange={(e) => set("announcement", { ...f.announcement, text_ar: e.target.value })} /></Field>
        </div>
      </section>
      <section className={section} aria-labelledby="s-seo"><h2 id="s-seo" className={h2}>SEO par défaut</h2>
        <Field label="Suffixe des titres" htmlFor="seo-t" hint="Ajouté aux titres de pages, ex. « | Ma Boutique »."><input id="seo-t" className="input" maxLength={60} value={f.seo.title_suffix} onChange={(e) => set("seo", { ...f.seo, title_suffix: e.target.value })} /></Field>
        <Field label="Description par défaut" htmlFor="seo-d" hint={f.seo.description.length + " / 200"}><textarea id="seo-d" className="input min-h-[70px]" maxLength={200} value={f.seo.description} onChange={(e) => set("seo", { ...f.seo, description: e.target.value })} /></Field>
        <div><span className="label">Image de partage par défaut</span><div className="mt-2 flex items-center gap-3">{preview(f.seo.og_image, "Image de partage")}<input type="file" accept="image/*" aria-label="Téléverser l'image de partage" onChange={(e) => upload("ogImage", e.target.files?.[0])} className="text-xs" />{f.seo.og_image && <button type="button" className="text-xs text-muted underline" onClick={() => set("seo", { ...f.seo, og_image: null })}>retirer</button>}</div></div>
      </section>
      <section className={section} aria-labelledby="s-home"><h2 id="s-home" className={h2}>Page d&apos;accueil</h2>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={f.home.single_product_redirect} onChange={(e) => set("home", { ...f.home, single_product_redirect: e.target.checked })} /><span>Rediriger « / » vers la fiche produit quand un seul produit est publié<span className="block text-xs text-muted">Comportement historique (landing page). Décochez pour afficher la page d&apos;accueil complète.</span></span></label>
        <Field label="Produits mis en avant (max)" htmlFor="h-n"><input id="h-n" type="number" min={1} max={24} className="input max-w-[120px]" value={f.home.featured_count} onChange={(e) => set("home", { ...f.home, featured_count: Math.max(1, Math.min(24, Number(e.target.value) || 8)) })} /></Field>
      </section>
      <section className="card p-5 text-sm text-muted" aria-labelledby="s-fx"><h2 id="s-fx" className={h2 + " text-foreground"}>Devise & région</h2><p className="mt-2">Dinar algérien (DA), format fr-DZ / ar-DZ, fuseau Africa/Algiers. Fixes pour cette boutique.</p></section>
      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        {msg && <p role={msg.ok ? "status" : "alert"} className={"me-auto text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
        <button type="submit" disabled={busy} className="btn-primary !px-6 !py-2.5">{busy ? "Enregistrement…" : "Enregistrer"}</button>
      </div>
    </form>
  );
}
