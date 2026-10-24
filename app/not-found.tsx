import Link from "next/link";
import { getServerDictionary } from "@/lib/i18n/server";

export default function NotFound() {
  const { t } = getServerDictionary();
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-extrabold">{t.notFoundTitle}</h1>
      <p className="text-sm text-muted">{t.notFoundText}</p>
      <Link href="/" className="btn-primary">{t.backToShop}</Link>
    </main>
  );
}
