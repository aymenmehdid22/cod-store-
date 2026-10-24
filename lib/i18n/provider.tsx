"use client";

import { createContext, useContext, useMemo } from "react";
import type { Locale } from "./config";
import { LOCALE_META } from "./config";
import { fmt, type Dictionary } from "./dictionaries";
import { getStoreStrings, type StoreStrings } from "./store-strings";

type Ctx = { locale: Locale; dir: "ltr" | "rtl"; t: Dictionary; s: StoreStrings };
const I18nContext = createContext<Ctx | null>(null);

export function I18nProvider({
  locale,
  dictionary,
  children,
}: {
  locale: Locale;
  dictionary: Dictionary;
  children: React.ReactNode;
}) {
  const value = useMemo(
    () => ({ locale, dir: LOCALE_META[locale].dir, t: dictionary, s: getStoreStrings(locale) }),
    [locale, dictionary]
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): Ctx {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export { fmt };
