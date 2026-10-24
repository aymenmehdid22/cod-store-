"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import { ArrowDown, ArrowUp, ImagePlus, Plus, Trash2 } from "lucide-react";
import { Field } from "./ui";

export type FormVariant = {
  client_key: string; id?: string; key: string; name: string; name_ar: string; color_hex: string;
  sku: string; price_override: string; stock_quantity: string; is_available: boolean;
};
export type FormImage = { url: string; storage_path: string | null; alt: string; variant_ref: string; fresh?: boolean };
export type ProductFormData = {
  id?: string; slug: string; name: string; description: string; price: string; compare_at_price: string; sku: string;
  status: "draft" | "active" | "archived"; rating: string; benefits: string; tags: string;
  delivery_available: boolean; track_inventory: boolean; stock_quantity: string; low_stock_threshold: string;
  seo_title: string; seo_description: string; og_image_url: string;
  ar_name: string; ar_description: string; ar_benefits: string;
  variants: FormVariant[]; images: FormImage[]; category_ids: string[];
};

export const EMPTY_PRODUCT: ProductFormData = {
  slug: "", name: "", description: "", price: "", compare_at_price: "", sku: "", status: "draft", rating: "", benefits: "", tags: "",
  delivery_available: true, track_inventory: true, stock_quantity: "0", low_stock_threshold: "5",
  seo_title: "", seo_description: "", og_image_url: "", ar_name: "", ar_description: "", ar_benefits: "",
  variants: [], images: [], category_ids: [],
};

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 5 * 1024 * 1024;

function slugify(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120);
}
const lines = (s: string) => s.split("\n").map((x) => x.trim()).filter(Boolean);
const intOrNull = (s: string) => (s.trim() === "" ? null : Math.round(Number(s)));

export default function ProductForm({ initial, categories }: { initial: ProductFormData; categories: { id: string; name: string }[] }) {
  const router = useRouter();
  const isEdit = !!initial.id;
  const [f, setF] = useState<ProductFormData>(initial);
  const [slugTouched, setSlugTouched] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof ProductFormData>(k: K, v: ProductFormData[K]) => setF((p) => ({ ...p, [k]: v }));
  const hasVariants = f.variants.length > 0;

  const supabase = () => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

  // ---- variants
  const addVariant = () => set("variants", [...f.variants, { client_key: "n" + Date.now() + f.variants.length, key: "", name: "", name_ar: "", color_hex: "", sku: "", price_override: "", stock_quantity: "0", is_available: true }]);
  const patchVariant = (i: number, patch: Partial<FormVariant>) => set("variants", f.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));
  const removeVariant = (i: number) => {
    const gone = f.variants[i].client_key;
    setF((p) => ({ ...p, variants: p.variants.filter((_, j) => j !== i), images: p.images.map((im) => (im.variant_ref === gone ? { ...im, variant_ref: "" } : im)) }));
  };

  // ---- images
  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true); setErrors([]);
    const added: FormImage[] = [];
    const problems: string[] = [];
    for (const file of Array.from(files)) {
      if (!ALLOWED.includes(file.type)) { problems.push(file.name + " : format non pris en charge (JPG, PNG, WebP, AVIF)."); continue; }
      if (file.size > MAX_BYTES) { problems.push(file.name + " : dépasse 5 Mo."); continue; }
      const ext = file.type.split("/")[1];
      const path = "products/" + crypto.randomUUID() + "." + ext;
      const { error } = await supabase().storage.from("product-images").upload(path, file, { cacheControl: "31536000", contentType: file.type });
      if (error) { problems.push(file.name + " : échec de l'envoi."); continue; }
      const { data } = supabase().storage.from("product-images").getPublicUrl(path);
      added.push({ url: data.publicUrl, storage_path: path, alt: f.name, variant_ref: "", fresh: true });
    }
    setF((p) => ({ ...p, images: [...p.images, ...added] }));
    if (problems.length) setErrors(problems);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }
  const moveImage = (i: number, d: -1 | 1) => setF((p) => {
    const j = i + d; if (j < 0 || j >= p.images.length) return p;
    const imgs = [...p.images]; [imgs[i], imgs[j]] = [imgs[j], imgs[i]]; return { ...p, images: imgs };
  });
  async function removeImage(i: number) {
    const im = f.images[i];
    // A file uploaded in this session and never saved can be deleted right away; saved files are
    // cleaned up by the server once the product is saved without them.
    if (im.fresh && im.storage_path) await supabase().storage.from("product-images").remove([im.storage_path]);
    set("images", f.images.filter((_, j) => j !== i));
  }

  // ---- submit
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrors([]);
    const payload = {
      slug: f.slug, name: f.name, description: f.description || null, price: Math.round(Number(f.price)),
      compare_at_price: intOrNull(f.compare_at_price), sku: f.sku || null, status: f.status,
      rating: f.rating.trim() === "" ? null : Number(f.rating),
      benefits: lines(f.benefits), tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      translations: f.ar_name || f.ar_description || f.ar_benefits
        ? { ar: { ...(f.ar_name && { name: f.ar_name }), ...(f.ar_description && { description: f.ar_description }), ...(f.ar_benefits && { benefits: lines(f.ar_benefits) }) } }
        : {},
      delivery_available: f.delivery_available, track_inventory: f.track_inventory,
      stock_quantity: Math.round(Number(f.stock_quantity) || 0), low_stock_threshold: Math.round(Number(f.low_stock_threshold) || 0),
      seo_title: f.seo_title || null, seo_description: f.seo_description || null, og_image_url: f.og_image_url || null,
      variants: f.variants.map((v, i) => ({
        id: v.id, client_key: v.client_key, key: v.key || slugify(v.name), name: v.name, name_ar: v.name_ar || null,
        color_hex: v.color_hex || null, sku: v.sku || null, price_override: intOrNull(v.price_override),
        stock_quantity: Math.round(Number(v.stock_quantity) || 0), is_available: v.is_available, sort_order: i,
      })),
      images: f.images.map((im, i) => ({ url: im.url, storage_path: im.storage_path, alt: im.alt, variant_client_key: im.variant_ref || null, sort_order: i })),
      category_ids: f.category_ids,
    };
    setSaving(true);
    try {
      const res = await fetch(isEdit ? "/api/admin/products/" + f.id : "/api/admin/products", {
        method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msgs: string[] = [];
        if (data.issues?.formErrors) msgs.push(...data.issues.formErrors);
        if (data.issues?.fieldErrors) for (const [k, v] of Object.entries(data.issues.fieldErrors)) msgs.push(k + " : " + (v as string[]).join(", "));
        setErrors(msgs.length ? msgs : [data.error ?? "Enregistrement impossible."]);
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      router.push("/admin/products");
      router.refresh();
    } catch {
      setErrors(["Erreur réseau. Vos modifications n'ont pas été perdues : réessayez."]);
    } finally { setSaving(false); }
  }

  const section = "card p-5 space-y-4";
  const h2 = "text-sm font-semibold uppercase tracking-wide";

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {errors.length > 0 && (
        <div role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          <ul className="list-disc ps-4">{errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      <section className={section} aria-labelledby="s-general">
        <h2 id="s-general" className={h2}>Général</h2>
        <Field label="Nom du produit" htmlFor="name">
          <input id="name" className="input" required maxLength={200} value={f.name} onChange={(e) => { set("name", e.target.value); if (!slugTouched) set("slug", slugify(e.target.value)); }} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Slug (URL)" htmlFor="slug" hint={"Adresse publique : /" + (f.slug || "…") + (isEdit ? " — la modifier casse les anciens liens." : "")}>
            <input id="slug" dir="ltr" className="input" required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={f.slug} onChange={(e) => { setSlugTouched(true); set("slug", e.target.value); }} />
          </Field>
          <Field label="Statut" htmlFor="status" hint="Seuls les produits « Actif » sont visibles sur la boutique.">
            <select id="status" className="input" value={f.status} onChange={(e) => set("status", e.target.value as ProductFormData["status"])}>
              <option value="draft">Brouillon</option><option value="active">Actif (publié)</option><option value="archived">Archivé</option>
            </select>
          </Field>
        </div>
        <Field label="Description" htmlFor="description">
          <textarea id="description" className="input min-h-[110px]" maxLength={5000} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Atouts (un par ligne)" htmlFor="benefits" hint="Affichés sous le bouton de commande, ex. « Paiement à la livraison ».">
          <textarea id="benefits" className="input min-h-[80px]" value={f.benefits} onChange={(e) => set("benefits", e.target.value)} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tags (séparés par des virgules)" htmlFor="tags"><input id="tags" className="input" value={f.tags} onChange={(e) => set("tags", e.target.value)} /></Field>
          <Field label="Note affichée (0 – 5, optionnel)" htmlFor="rating"><input id="rating" type="number" step="0.1" min={0} max={5} className="input" value={f.rating} onChange={(e) => set("rating", e.target.value)} /></Field>
        </div>
      </section>

      <section className={section} aria-labelledby="s-price">
        <h2 id="s-price" className={h2}>Prix & livraison</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Prix (DA)" htmlFor="price"><input id="price" type="number" min={0} step={1} required className="input" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
          <Field label="Prix barré (DA)" htmlFor="compare" hint="Doit être ≥ au prix."><input id="compare" type="number" min={0} step={1} className="input" value={f.compare_at_price} onChange={(e) => set("compare_at_price", e.target.value)} /></Field>
          <Field label="SKU" htmlFor="sku"><input id="sku" dir="ltr" className="input" maxLength={64} value={f.sku} onChange={(e) => set("sku", e.target.value)} /></Field>
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.delivery_available} onChange={(e) => set("delivery_available", e.target.checked)} /> Livraison disponible (désactiver bloque les commandes)</label>
      </section>

      <section className={section} aria-labelledby="s-variants">
        <div className="flex items-center justify-between">
          <h2 id="s-variants" className={h2}>Variantes (couleur, taille…)</h2>
          <button type="button" onClick={addVariant} className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-background"><Plus className="h-4 w-4" aria-hidden /> Ajouter</button>
        </div>
        {!hasVariants && <p className="text-sm text-muted">Aucune variante : le produit est vendu tel quel avec un stock unique.</p>}
        {f.variants.map((v, i) => (
          <div key={v.client_key} className="rounded-xl border border-border p-3">
            <div className="grid gap-3 sm:grid-cols-4">
              <Field label="Nom" htmlFor={"vn" + i}><input id={"vn" + i} className="input" required value={v.name} onChange={(e) => patchVariant(i, { name: e.target.value })} /></Field>
              <Field label="Nom (arabe)" htmlFor={"va" + i}><input id={"va" + i} dir="rtl" className="input" value={v.name_ar} onChange={(e) => patchVariant(i, { name_ar: e.target.value })} /></Field>
              <Field label="Identifiant" htmlFor={"vk" + i}><input id={"vk" + i} dir="ltr" className="input" placeholder="auto" pattern="[a-z0-9]+(-[a-z0-9]+)*" value={v.key} onChange={(e) => patchVariant(i, { key: e.target.value })} /></Field>
              <Field label="Couleur" htmlFor={"vc" + i}>
                <div className="mt-1.5 flex items-center gap-2">
                  <input id={"vc" + i} type="color" value={v.color_hex || "#161616"} onChange={(e) => patchVariant(i, { color_hex: e.target.value })} className="h-10 w-12 cursor-pointer rounded-lg border border-border bg-white" />
                  {v.color_hex && <button type="button" className="text-xs text-muted underline" onClick={() => patchVariant(i, { color_hex: "" })}>retirer</button>}
                </div>
              </Field>
              <Field label="Prix spécifique (DA)" htmlFor={"vp" + i}><input id={"vp" + i} type="number" min={0} className="input" value={v.price_override} onChange={(e) => patchVariant(i, { price_override: e.target.value })} /></Field>
              <Field label="SKU" htmlFor={"vs" + i}><input id={"vs" + i} dir="ltr" className="input" value={v.sku} onChange={(e) => patchVariant(i, { sku: e.target.value })} /></Field>
              {isEdit && v.id ? (
                <div><span className="label">Stock</span><p className="mt-2.5 text-sm">{v.stock_quantity} <Link href="/admin/inventory" className="text-muted underline">ajuster</Link></p></div>
              ) : (
                <Field label="Stock initial" htmlFor={"vq" + i}><input id={"vq" + i} type="number" min={0} className="input" value={v.stock_quantity} onChange={(e) => patchVariant(i, { stock_quantity: e.target.value })} /></Field>
              )}
              <div className="flex items-end justify-between gap-2 pb-1">
                <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.is_available} onChange={(e) => patchVariant(i, { is_available: e.target.checked })} /> Disponible</label>
                <button type="button" onClick={() => window.confirm("Supprimer cette variante ?") && removeVariant(i)} aria-label={"Supprimer la variante " + (v.name || i + 1)} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className={section} aria-labelledby="s-stock">
        <h2 id="s-stock" className={h2}>Stock</h2>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={f.track_inventory} onChange={(e) => set("track_inventory", e.target.checked)} /> Suivre le stock (bloque la vente à 0, évite la survente)</label>
        <div className="grid gap-4 sm:grid-cols-2">
          {!hasVariants && (isEdit ? (
            <div><span className="label">Stock actuel</span><p className="mt-2.5 text-sm">{f.stock_quantity} <Link href="/admin/inventory" className="text-muted underline">ajuster avec un motif</Link></p></div>
          ) : (
            <Field label="Stock initial" htmlFor="stock"><input id="stock" type="number" min={0} className="input" value={f.stock_quantity} onChange={(e) => set("stock_quantity", e.target.value)} /></Field>
          ))}
          <Field label="Seuil d'alerte stock bas" htmlFor="low"><input id="low" type="number" min={0} className="input" value={f.low_stock_threshold} onChange={(e) => set("low_stock_threshold", e.target.value)} /></Field>
        </div>
        {isEdit && <p className="text-xs text-muted">Les quantités existantes ne se modifient que depuis « Inventaire », pour garder un historique fiable.</p>}
      </section>

      <section className={section} aria-labelledby="s-images">
        <h2 id="s-images" className={h2}>Images</h2>
        <p className="text-xs text-muted">JPG, PNG, WebP ou AVIF · 5 Mo max · la première image est l&apos;image principale. Associez une image à une variante pour qu&apos;elle s&apos;affiche quand la couleur est choisie.</p>
        <ul className="grid gap-3 sm:grid-cols-2">
          {f.images.map((im, i) => (
            <li key={im.url + i} className="flex gap-3 rounded-xl border border-border p-2">
              <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg border border-border bg-white"><Image src={im.url} alt={im.alt || ""} fill sizes="96px" className="object-cover" /></div>
              <div className="min-w-0 flex-1 space-y-1.5">
                <input aria-label={"Texte alternatif image " + (i + 1)} className="input !mt-0 !py-1.5 text-xs" placeholder="Texte alternatif" value={im.alt} onChange={(e) => set("images", f.images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} />
                <select aria-label={"Variante de l'image " + (i + 1)} className="input !mt-0 !py-1.5 text-xs" value={im.variant_ref} onChange={(e) => set("images", f.images.map((x, j) => (j === i ? { ...x, variant_ref: e.target.value } : x)))}>
                  <option value="">Toutes les variantes</option>
                  {f.variants.map((v) => <option key={v.client_key} value={v.client_key}>{v.name || "(sans nom)"}</option>)}
                </select>
                <div className="flex gap-1">
                  <button type="button" disabled={i === 0} onClick={() => moveImage(i, -1)} aria-label="Monter" className="rounded-lg p-1.5 hover:bg-background disabled:opacity-30"><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" disabled={i === f.images.length - 1} onClick={() => moveImage(i, 1)} aria-label="Descendre" className="rounded-lg p-1.5 hover:bg-background disabled:opacity-30"><ArrowDown className="h-4 w-4" /></button>
                  <button type="button" onClick={() => removeImage(i)} aria-label="Supprimer l'image" className="ms-auto rounded-lg p-1.5 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            </li>
          ))}
        </ul>
        <input ref={fileRef} type="file" accept={ALLOWED.join(",")} multiple className="sr-only" id="img-upload" onChange={(e) => onFiles(e.target.files)} />
        <label htmlFor="img-upload" className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border bg-white px-4 py-3 text-sm font-medium hover:bg-background">
          <ImagePlus className="h-4 w-4" aria-hidden /> {uploading ? "Envoi en cours…" : "Ajouter des images"}
        </label>
      </section>

      {categories.length > 0 && (
        <section className={section} aria-labelledby="s-cats">
          <h2 id="s-cats" className={h2}>Catégories & collections</h2>
          <div className="flex flex-wrap gap-2">
            {categories.map((c) => {
              const on = f.category_ids.includes(c.id);
              return (
                <label key={c.id} className={"cursor-pointer rounded-full border px-3 py-1.5 text-sm " + (on ? "border-foreground bg-foreground text-white" : "border-border bg-white")}>
                  <input type="checkbox" className="sr-only" checked={on} onChange={() => set("category_ids", on ? f.category_ids.filter((x) => x !== c.id) : [...f.category_ids, c.id])} />
                  {c.name}
                </label>
              );
            })}
          </div>
        </section>
      )}

      <section className={section} aria-labelledby="s-ar">
        <h2 id="s-ar" className={h2}>Version arabe</h2>
        <Field label="Nom" htmlFor="ar_name"><input id="ar_name" dir="rtl" className="input" value={f.ar_name} onChange={(e) => set("ar_name", e.target.value)} /></Field>
        <Field label="Description" htmlFor="ar_desc"><textarea id="ar_desc" dir="rtl" className="input min-h-[90px]" value={f.ar_description} onChange={(e) => set("ar_description", e.target.value)} /></Field>
        <Field label="Atouts (un par ligne)" htmlFor="ar_ben"><textarea id="ar_ben" dir="rtl" className="input min-h-[70px]" value={f.ar_benefits} onChange={(e) => set("ar_benefits", e.target.value)} /></Field>
        <p className="text-xs text-muted">Champs vides : la version française s&apos;affiche en repli.</p>
      </section>

      <section className={section} aria-labelledby="s-seo">
        <h2 id="s-seo" className={h2}>SEO</h2>
        <Field label="Titre SEO" htmlFor="seo_t" hint={f.seo_title.length + " / 70"}><input id="seo_t" className="input" maxLength={70} value={f.seo_title} onChange={(e) => set("seo_title", e.target.value)} /></Field>
        <Field label="Meta description" htmlFor="seo_d" hint={f.seo_description.length + " / 200"}><textarea id="seo_d" className="input min-h-[70px]" maxLength={200} value={f.seo_description} onChange={(e) => set("seo_description", e.target.value)} /></Field>
        <Field label="Image de partage (URL)" htmlFor="og" hint="Vide : la première image du produit est utilisée."><input id="og" dir="ltr" className="input" value={f.og_image_url} onChange={(e) => set("og_image_url", e.target.value)} placeholder="https://…" /></Field>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex items-center justify-end gap-3 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:-mx-8 md:px-8">
        <Link href="/admin/products" className="rounded-xl px-4 py-2.5 text-sm text-muted hover:text-black">Annuler</Link>
        <button type="submit" disabled={saving || uploading} className="btn-primary !px-6 !py-2.5">{saving ? "Enregistrement…" : isEdit ? "Enregistrer" : "Créer le produit"}</button>
      </div>
    </form>
  );
}
