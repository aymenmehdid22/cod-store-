"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingBag } from "lucide-react";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n/provider";

export default function StoreHeader({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const { s } = useI18n();
  const { count } = useCart();
  return (
    <header className="border-b border-border bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-sm font-extrabold tracking-tight" aria-label={name}>
          {logoUrl ? <Image src={logoUrl} alt={name} width={120} height={32} className="h-8 w-auto" priority /> : name}
        </Link>
        <nav aria-label="Principal" className="flex items-center gap-4 text-sm">
          <Link href="/shop" className="font-medium hover:underline">{s.nav.shop}</Link>
          <Link href="/cart" className="relative inline-flex items-center gap-1 font-medium hover:underline" aria-label={s.nav.cart + (count ? " (" + count + ")" : "")}>
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {count > 0 && <span className="absolute -end-2 -top-2 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-bold text-white">{count}</span>}
          </Link>
          <LanguageSwitcher />
        </nav>
      </div>
    </header>
  );
}
