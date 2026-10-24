"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { configure, setConsent, readStoredConsent, trackPageView, getConsent, subscribe } from "@/lib/tracking";
import { consentNeeded, type PublicTrackingConfig } from "@/lib/tracking-config";
import { captureAttribution } from "@/lib/analytics";
import { useI18n } from "@/lib/i18n/provider";

const OPEN_EVENT = "cod:open-consent";
export const openConsentPreferences = () => window.dispatchEvent(new Event(OPEN_EVENT));

export default function TrackingProvider({ config }: { config: PublicTrackingConfig }) {
  const { s } = useI18n();
  const pathname = usePathname();
  const needed = consentNeeded(config);
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState(false);
  const [, force] = useState(0);

  useEffect(() => {
    configure(config);
    const stored = readStoredConsent();
    if (stored) setConsent(stored, false);
    captureAttribution(!!stored && (stored.analytics || stored.marketing));
    setOpen(needed && !stored);
    setReady(true);
    const unsub = subscribe(() => force((n) => n + 1));
    const reopen = () => setOpen(true);
    window.addEventListener(OPEN_EVENT, reopen);
    return () => { unsub(); window.removeEventListener(OPEN_EVENT, reopen); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Without any enabled integration nothing needs consent; first-party counters stay off and nothing is sent.
  useEffect(() => { if (ready) trackPageView(pathname); }, [ready, pathname, getConsent()?.analytics, getConsent()?.marketing]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!ready || !needed || !open) return null;
  const decide = (granted: boolean) => {
    setConsent({ analytics: granted, marketing: granted });
    captureAttribution(granted);
    setOpen(false);
  };
  return (
    <div role="dialog" aria-modal="false" aria-labelledby="consent-title" className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-2xl border border-border bg-white p-4 shadow-lg md:bottom-4">
      <p id="consent-title" className="text-sm font-bold">{s.consent.title}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted">{s.consent.text}</p>
      <p className="mt-1 text-[11px] text-muted">{s.consent.refreshNote}</p>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => decide(true)} className="btn-primary flex-1 !py-2.5">{s.consent.accept}</button>
        <button type="button" onClick={() => decide(false)} className="flex-1 rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-background">{s.consent.refuse}</button>
      </div>
    </div>
  );
}
