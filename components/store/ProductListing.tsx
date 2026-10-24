import Link from "next/link";
import ProductCard from "./ProductCard";
import SearchTracker from "./SearchTracker";
import { listProducts, getCategories, cleanSearch, PAGE_SIZE, type Sort } from "@/lib/store-data";
import { getServerDictionary } from "@/lib/i18n/server";
import { getStoreStrings } from "@/lib/i18n/store-strings";

const SORTS: Sort[] = ["new", "price_asc", "price_desc", "name"];

export default async function ProductListing({ basePath, categoryId, categorySlug, searchParams }: { basePath: string; categoryId?: string; categorySlug?: string; searchParams: { q?: string; sort?: string; page?: string } }) {
  const { locale, t } = getServerDictionary();
  const s = getStoreStrings(locale);
  const q = cleanSearch(searchParams.q);
  const sort = (SORTS as string[]).includes(searchParams.sort ?? "") ? (searchParams.sort as Sort) : "new";
  const page = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const [{ items, total }, categories] = await Promise.all([listProducts({ q, categoryId, sort, page }), getCategories()]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const href = (p: number) => { const sp = new URLSearchParams(); if (q) sp.set("q", q); if (sort !== "new") sp.set("sort", sort); if (p > 1) sp.set("page", String(p)); const qs = sp.toString(); return basePath + (qs ? "?" + qs : ""); };
  const sortLabel: Record<Sort, string> = { new: s.shop.sortNew, price_asc: s.shop.sortPriceAsc, price_desc: s.shop.sortPriceDesc, name: s.shop.sortName };
  const chip = (active: boolean) => "rounded-full border px-3 py-1.5 text-sm " + (active ? "border-foreground bg-foreground text-white" : "border-border bg-white hover:bg-background");

  return (
    <>
      <SearchTracker query={q} resultCount={total} />
      {categories.length > 0 && (
        <nav aria-label="Catégories" className="mb-4 flex flex-wrap gap-2">
          <Link href={q ? "/shop?q=" + encodeURIComponent(q) : "/shop"} className={chip(!categorySlug)}>{s.shop.all}</Link>
          {categories.map((c) => <Link key={c.id} href={"/category/" + c.slug} className={chip(categorySlug === c.slug)} aria-current={categorySlug === c.slug ? "page" : undefined}>{locale === "ar" && c.name_ar ? c.name_ar : c.name}</Link>)}
        </nav>
      )}
      <form method="GET" action={basePath} role="search" className="mb-5 flex flex-wrap items-center gap-2">
        <input name="q" defaultValue={q} placeholder={s.shop.searchPlaceholder} aria-label={s.shop.search} className="input mt-0 max-w-xs flex-1" />
        <select name="sort" defaultValue={sort} aria-label={s.shop.sortLabel} className="input mt-0 max-w-[190px]">
          {SORTS.map((o) => <option key={o} value={o}>{sortLabel[o]}</option>)}
        </select>
        <button type="submit" className="btn-primary !py-2.5">{s.shop.search}</button>
      </form>
      <p className="mb-3 text-xs text-muted" role="status">{s.shop.results.replace("{n}", String(total))}</p>
      {items.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-muted">{s.shop.none}</div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {items.map((p) => <li key={p.id}><ProductCard p={p} locale={locale} currency={t.currency} soldOutLabel={s.card.soldOut} saleLabel={s.card.sale} /></li>)}
        </ul>
      )}
      {pages > 1 && (
        <nav aria-label="Pagination" className="mt-6 flex items-center justify-between text-sm">
          <span className="text-muted">{s.shop.page.replace("{p}", String(page)).replace("{n}", String(pages))}</span>
          <div className="flex gap-2">
            {page > 1 && <Link rel="prev" href={href(page - 1)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">{s.shop.prev}</Link>}
            {page < pages && <Link rel="next" href={href(page + 1)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">{s.shop.next}</Link>}
          </div>
        </nav>
      )}
    </>
  );
}
