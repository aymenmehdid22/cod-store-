import type { Metadata } from "next";
import ProductListing from "@/components/store/ProductListing";
import { getServerDictionary } from "@/lib/i18n/server";
import { getStoreStrings } from "@/lib/i18n/store-strings";
import { getSettings } from "@/lib/store-data";

export const dynamic = "force-dynamic";

export async function generateMetadata({ searchParams }: { searchParams: { q?: string } }): Promise<Metadata> {
  const { locale } = getServerDictionary();
  const st = await getSettings();
  const title = getStoreStrings(locale).shop.title + " | " + st.seo.title_suffix;
  // Search result pages are thin duplicates of the catalogue: keep them out of the index.
  return { title, alternates: { canonical: "/shop" }, robots: searchParams.q ? { index: false, follow: true } : undefined };
}

export default function ShopPage({ searchParams }: { searchParams: { q?: string; sort?: string; page?: string } }) {
  const { locale } = getServerDictionary();
  return (
    <main className="mx-auto max-w-6xl px-4 py-6">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{getStoreStrings(locale).shop.title}</h1>
      <ProductListing basePath="/shop" searchParams={searchParams} />
    </main>
  );
}
