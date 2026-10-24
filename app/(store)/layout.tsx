import { CartProvider } from "@/lib/cart";
import TrackingProvider from "@/components/tracking/TrackingProvider";
import StoreHeader from "@/components/store/StoreHeader";
import StoreFooter from "@/components/store/StoreFooter";
import AnnouncementBar from "@/components/store/AnnouncementBar";
import { getTrackingConfig } from "@/lib/tracking-server";
import { getFooterPages, getSettings } from "@/lib/store-data";
import { getLocale } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const [trackingConfig, settings, pages] = await Promise.all([getTrackingConfig(), getSettings(), getFooterPages()]);
  const locale = getLocale();
  return (
    <CartProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-50 focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm">Skip</a>
      <AnnouncementBar text={locale === "ar" ? settings.announcement.text_ar || settings.announcement.text_fr : settings.announcement.text_fr || settings.announcement.text_ar} enabled={settings.announcement.enabled} />
      <StoreHeader name={settings.name} logoUrl={settings.logoUrl} />
      <div id="main">{children}</div>
      <StoreFooter name={settings.name} pages={pages} contact={settings.contact} social={settings.social} locale={locale} />
      <TrackingProvider config={trackingConfig} />
    </CartProvider>
  );
}
