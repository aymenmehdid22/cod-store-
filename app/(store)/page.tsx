import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import ProductCard from "@/components/store/ProductCard";
import { getActiveProducts } from "@/lib/catalog";
import { getCategories, getHomeSections, getSettings, listProducts } from "@/lib/store-data";
import { getServerDictionary } from "@/lib/i18n/server";
import { getStoreStrings } from "@/lib/i18n/store-strings";

export const dynamic = "force-dynamic";

type Loc = Record<string, { title?: string; subtitle?: string; cta?: string } | undefined>;

export default async function Home() {
  const { locale, t } = getServerDictionary();
  const s = getStoreStrings(locale);
  const [settings, sections] = await Promise.all([getSettings(), getHomeSections()]);

  // Backward compatible: with a single published product "/" keeps forwarding to its landing page
  // (switch off in Admin > Réglages to show the full home page).
  if (settings.home.single_product_redirect) {
    const active = await getActiveProducts();
    if (active.length === 1) redirect("/" + active[0].slug);
  }

  const [{ items }, categories] = await Promise.all([listProducts({ limit: settings.home.featured_count }), getCategories()]);
  const tr = (c: Record<string, unknown>) => ((c as Loc)[locale] ?? (c as Loc).fr ?? {}) as { title?: string; subtitle?: string; cta?: string };

  return (
    <main>
      {sections.length === 0 && items.length === 0 && <p className="px-4 py-16 text-center text-muted">{s.home.empty}</p>}
      {sections.map((sec) => {
        const c = sec.content, txt = tr(c);
        if (sec.section_key === "hero") {
          const img = typeof c.image_url === "string" ? c.image_url : null;
          return (
            <section key="hero" className="relative isolate overflow-hidden bg-foreground text-white">
              {img && <Image src={img} alt="" fill priority sizes="100vw" className="-z-10 object-cover opacity-50" />}
              <div className="mx-auto max-w-6xl px-4 py-16 md:py-24">
                <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight md:text-5xl">{txt.title}</h1>
                {txt.subtitle && <p className="mt-3 max-w-xl text-base text-white/85">{txt.subtitle}</p>}
                <Link href="/shop" className="mt-6 inline-block rounded-xl bg-white px-6 py-3.5 text-sm font-bold text-foreground hover:bg-background">{txt.cta || s.home.heroCta}</Link>
              </div>
            </section>
          );
        }
        if (sec.section_key === "featured" && items.length > 0) {
          return (
            <section key="featured" className="mx-auto max-w-6xl px-4 py-10" aria-labelledby="h-featured">
              <div className="mb-4 flex items-end justify-between"><h2 id="h-featured" className="text-xl font-extrabold tracking-tight">{txt.title ?? s.shop.title}</h2><Link href="/shop" className="text-sm underline">{s.home.allProducts}</Link></div>
              <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">{items.map((p) => <li key={p.id}><ProductCard p={p} locale={locale} currency={t.currency} soldOutLabel={s.card.soldOut} saleLabel={s.card.sale} /></li>)}</ul>
            </section>
          );
        }
        if (sec.section_key === "categories" && categories.length > 0) {
          return (
            <section key="categories" className="mx-auto max-w-6xl px-4 py-6" aria-labelledby="h-cats">
              <h2 id="h-cats" className="mb-3 text-xl font-extrabold tracking-tight">{txt.title ?? ""}</h2>
              <ul className="flex flex-wrap gap-2">{categories.map((cat) => <li key={cat.id}><Link href={"/category/" + cat.slug} className="inline-block rounded-full border border-border bg-white px-4 py-2 text-sm font-medium hover:bg-background">{locale === "ar" && cat.name_ar ? cat.name_ar : cat.name}</Link></li>)}</ul>
            </section>
          );
        }
        if (sec.section_key === "trust") {
          const list = Array.isArray(c.items) ? (c.items as { fr?: string; ar?: string }[]) : [];
          return list.length ? (
            <section key="trust" className="mx-auto max-w-6xl px-4 py-8" aria-label="Garanties">
              <ul className="grid gap-3 sm:grid-cols-3">{list.map((i, k) => <li key={k} className="card p-4 text-center text-sm font-semibold">{(locale === "ar" ? i.ar : i.fr) ?? i.fr}</li>)}</ul>
            </section>
          ) : null;
        }
        return null;
      })}
    </main>
  );
}
