import type { Metadata } from "next";
import { notFound } from "next/navigation";
import RichText from "@/components/store/RichText";
import { getStorePage, getSettings } from "@/lib/store-data";
import { getServerDictionary } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const { locale } = getServerDictionary();
  const [page, st] = await Promise.all([getStorePage(params.slug), getSettings()]);
  if (!page) return {};
  return { title: (locale === "ar" && page.title_ar ? page.title_ar : page.title) + " | " + st.seo.title_suffix, alternates: { canonical: "/p/" + page.slug } };
}

export default async function InfoPage({ params }: { params: { slug: string } }) {
  const { locale } = getServerDictionary();
  const [page, st] = await Promise.all([getStorePage(params.slug), getSettings()]);
  if (!page) notFound();
  const ar = locale === "ar";
  const body = ar && page.body_ar ? page.body_ar : page.body;
  const c = st.contact;
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-extrabold tracking-tight">{ar && page.title_ar ? page.title_ar : page.title}</h1>
      <RichText text={body} />
      {page.slug === "contact" && (
        <ul className="mt-6 space-y-2 text-sm">
          {c.phone && <li><a dir="ltr" className="font-semibold hover:underline" href={"tel:" + c.phone.replace(/[^\d+]/g, "")}>{c.phone}</a></li>}
          {c.whatsapp && <li><a dir="ltr" className="font-semibold hover:underline" target="_blank" rel="noopener noreferrer" href={"https://wa.me/" + c.whatsapp.replace(/\D/g, "")}>WhatsApp</a></li>}
          {c.email && <li><a className="font-semibold hover:underline" href={"mailto:" + c.email}>{c.email}</a></li>}
          {!c.phone && !c.whatsapp && !c.email && <li className="text-muted">—</li>}
        </ul>
      )}
    </main>
  );
}
