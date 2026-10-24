import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/lib/catalog";
import ProductOrderClient from "@/components/product/ProductOrderClient";
import { getServerDictionary } from "@/lib/i18n/server";
import { localizeProduct } from "@/lib/i18n/localize";
import { LOCALE_META } from "@/lib/i18n/config";
import { fmt } from "@/lib/i18n/dictionaries";

export const dynamic = "force-dynamic"; // published products and stock must reflect admin changes immediately

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const abs = (u: string) => (u.startsWith("http") ? u : SITE_URL + u);

export async function generateMetadata({ params }: { params: { product: string } }): Promise<Metadata> {
  const { locale, t } = getServerDictionary();
  const base = await getProductBySlug(params.product);
  if (!base) return {};
  const product = localizeProduct(base, locale);
  const url = SITE_URL + "/" + product.slug;
  const price = product.price.toLocaleString("en-US") + " " + t.currency;
  const title = base.seoTitle ?? product.name + " — " + price + " | " + t.metaTitleSuffix;
  const description = base.seoDescription ?? product.description ?? fmt(t.metaDescription, { name: product.name, price });
  const ogImage = base.ogImage ?? product.images[0]?.url;
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: product.name + " — " + price,
      description: base.seoDescription ?? product.description ?? t.ogDescription,
      url,
      siteName: "COD Store",
      locale: LOCALE_META[locale].ogLocale,
      type: "website",
      images: ogImage ? [{ url: abs(ogImage), width: 800, height: 800, alt: product.name }] : [],
    },
  };
}

export default async function ProductPage({ params }: { params: { product: string } }) {
  const { locale } = getServerDictionary();
  const base = await getProductBySlug(params.product);
  if (!base) notFound();
  const product = localizeProduct(base, locale);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    inLanguage: locale,
    name: product.name,
    image: product.images.map((i) => abs(i.url)),
    description: product.description,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: "DZD",
      availability: product.soldOut ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
    },
  };

  return (
    <main className="mx-auto max-w-6xl px-4 pb-28 pt-4 md:pb-16 md:pt-8">
      <ProductOrderClient product={product} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} />
    </main>
  );
}
