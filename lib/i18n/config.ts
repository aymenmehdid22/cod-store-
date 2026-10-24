export const LOCALES = ["fr", "ar"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "locale";

export const LOCALE_META: Record<Locale, { dir: "ltr" | "rtl"; label: string; ogLocale: string }> = {
  fr: { dir: "ltr", label: "Français", ogLocale: "fr_DZ" },
  ar: { dir: "rtl", label: "العربية", ogLocale: "ar_DZ" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Cookie wins; otherwise Accept-Language (Arabic browsers get Arabic); otherwise French. */
export function resolveLocale(cookieValue?: string | null, acceptLanguage?: string | null): Locale {
  if (isLocale(cookieValue)) return cookieValue;
  const first = acceptLanguage?.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("ar")) return "ar";
  return DEFAULT_LOCALE;
}
