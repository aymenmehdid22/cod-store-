import { cookies, headers } from "next/headers";
import type { NextRequest } from "next/server";
import { LOCALE_COOKIE, resolveLocale, type Locale } from "./config";
import { getDictionary } from "./dictionaries";

/** For server components / layouts. */
export function getLocale(): Locale {
  return resolveLocale(cookies().get(LOCALE_COOKIE)?.value, headers().get("accept-language"));
}

export function getServerDictionary() {
  const locale = getLocale();
  return { locale, t: getDictionary(locale) };
}

/** For route handlers. */
export function getRequestLocale(request: NextRequest): Locale {
  return resolveLocale(request.cookies.get(LOCALE_COOKIE)?.value, request.headers.get("accept-language"));
}
