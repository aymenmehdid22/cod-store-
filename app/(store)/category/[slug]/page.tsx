import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductListing from "@/components/store/ProductListing";
import { getCategoryBySlug, getSettings } from "@/lib/store-data";
import { getServerDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { locale } = getServerDictionary();
  const [c, st] = await Promise.all([getCategoryBySlug(params.slug), getSettings()]);
  if (!c) return {};
  const name = locale === "ar" && c.name_ar ? c.name_ar : c.name;
  return { title: c.seo_title ?? name + " | " + st.seo.title_suffix, description: c.seo_description ?? c.description ?? undefined, alternates: { canonical: "/category/" + c.slug } };
}

export default async function CategoryPage({ params, searchParams }: { params: { slug: string }; searchParams: { q?: string; sort?: string; page?: string } }) {
  const { locale } = getServerDictionary();
  const c = await getCategoryBySlug(params.slug);
  if (!c) notFound();
  const name = locale === "ar" && c.name_ar ? c.name_ar : c.name;
  const desc = locale === "ar" && c.description_ar ? c.description_ar : c.description;
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">{name}</h1>
      {desc && <p className="mb-4 mt-1 max-w-2xl text-sm text-muted">{desc}</p>}
      <div className="mt-4"><ProductListing basePath={"/category/" + c.slug} categoryId={c.id} categorySlug={c.slug} searchParams={searchParams} /></div>
    </main>
  );
}
