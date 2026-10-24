"use client";

import Link from "next/link";
import { openConsentPreferences } from "@/components/tracking/TrackingProvider";
import { useI18n } from "@/lib/i18n/provider";

type P = { slug: string; title: string; title_ar: string | null };
const safeUrl = (u: string | null) => (u && /^https:\/\//.test(u) ? u : null);

export default function StoreFooter({ name, pages, contact, social, locale }: {
  name: string; pages: P[]; contact: { phone: string | null; email: string | null; whatsapp: string | null };
  social: { instagram: string | null; facebook: string | null; tiktok: string | null }; locale: string;
}) {
  const { s } = useI18n();
  const socials = [["Instagram", safeUrl(social.instagram)], ["Facebook", safeUrl(social.facebook)], ["TikTok", safeUrl(social.tiktok)]].filter(([, u]) => u) as [string, string][];
  return (
    <footer className="mt-12 border-t border-border bg-white">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:grid-cols-3">
        <div>
          <p className="font-extrabold">{name}</p>
          {contact.phone && <p className="mt-2"><a dir="ltr" className="hover:underline" href={"tel:" + contact.phone.replace(/[^\d+]/g, "")}>{contact.phone}</a></p>}
          {contact.email && <p><a className="hover:underline" href={"mailto:" + contact.email}>{contact.email}</a></p>}
          {contact.whatsapp && <p><a dir="ltr" className="hover:underline" href={"https://wa.me/" + contact.whatsapp.replace(/\D/g, "")} rel="noopener noreferrer" target="_blank">WhatsApp</a></p>}
        </div>
        <nav aria-label={s.footer.pages}>
          <p className="font-semibold">{s.footer.pages}</p>
          <ul className="mt-2 space-y-1.5 text-muted">
            {pages.map((p) => <li key={p.slug}><Link href={"/p/" + p.slug} className="hover:text-foreground hover:underline">{locale === "ar" && p.title_ar ? p.title_ar : p.title}</Link></li>)}
            <li><button type="button" onClick={openConsentPreferences} className="hover:text-foreground hover:underline">{s.footer.prefs}</button></li>
          </ul>
        </nav>
        <div className="flex gap-3 text-muted sm:justify-end">
          {socials.map(([label, url]) => <a key={label} href={url} target="_blank" rel="noopener noreferrer" className="hover:text-foreground hover:underline">{label}</a>)}
        </div>
      </div>
      <p className="border-t border-border px-4 py-3 text-center text-xs text-muted">© {new Date().getFullYear()} {name}. {s.footer.rights}</p>
    </footer>
  );
}
