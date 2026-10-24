import type { Metadata } from "next";
import { Inter, Noto_Sans_Arabic } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n/provider";
import { LOCALE_META } from "@/lib/i18n/config";
import { getServerDictionary } from "@/lib/i18n/server";
import { getSettings } from "@/lib/store-data";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const arabic = Noto_Sans_Arabic({ subsets: ["arabic"], variable: "--font-arabic", display: "swap" });
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = getServerDictionary();
  const st = await getSettings();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: st.name, template: "%s" },
    description: st.seo.description || t.siteDescription,
    robots: { index: true, follow: true },
    icons: st.faviconUrl ? { icon: st.faviconUrl } : undefined,
    openGraph: { siteName: st.name, images: st.seo.og_image ? [{ url: st.seo.og_image }] : undefined },
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, t } = getServerDictionary();
  return (
    <html lang={locale} dir={LOCALE_META[locale].dir}>
      <body className={inter.variable + " " + arabic.variable + " font-sans"}>
        <I18nProvider locale={locale} dictionary={t}>
          {children}
        </I18nProvider>
      </body>
    </html>
  );
}
