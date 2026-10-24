"use client";

import { useRouter } from "next/navigation";
import { Languages } from "lucide-react";
import { LOCALES, LOCALE_COOKIE, LOCALE_META, type Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";

export default function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const router = useRouter();

  function choose(next: Locale) {
    if (next === locale) return;
    document.cookie =
      LOCALE_COOKIE + "=" + next + "; path=/; max-age=" + 60 * 60 * 24 * 365 + "; samesite=lax";
    router.refresh(); // re-render server components with the new locale
  }

  return (
    <div className="flex justify-end">
      <div
        role="group"
        aria-label={t.switchLanguage}
        className="inline-flex items-center gap-1 rounded-full border border-border bg-white p-1 text-xs"
      >
        <Languages className="mx-1.5 h-3.5 w-3.5 text-muted" aria-hidden="true" />
        {LOCALES.map((l) => (
          <button
            key={l}
            type="button"
            lang={l}
            onClick={() => choose(l)}
            aria-pressed={l === locale}
            className={
              "rounded-full px-3 py-1 font-semibold transition " +
              (l === locale ? "bg-foreground text-white" : "text-muted hover:text-foreground")
            }
          >
            {LOCALE_META[l].label}
          </button>
        ))}
      </div>
    </div>
  );
}
