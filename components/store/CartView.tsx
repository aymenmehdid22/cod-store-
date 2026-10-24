"use client";

import Link from "next/link";
import Image from "next/image";
import { Trash2 } from "lucide-react";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/tracking";
import { formatDZD } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import QuantitySelector from "@/components/product/QuantitySelector";

export default function CartView() {
  const { t, s } = useI18n();
  const { lines, ready, setQty, remove } = useCart();
  const money = (n: number) => formatDZD(n, t.currency);
  const subtotal = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  if (!ready) return <div className="card h-40 animate-pulse" aria-hidden />;
  if (lines.length === 0) {
    return (
      <div className="card px-6 py-12 text-center">
        <p className="font-semibold">{s.cart.empty}</p>
        <Link href="/shop" className="btn-primary mt-4 inline-block">{s.cart.continue}</Link>
      </div>
    );
  }
  return (
    <div className="grid gap-5 md:grid-cols-[1fr_320px]">
      <ul className="space-y-3">
        {lines.map((l) => (
          <li key={l.key} className="card flex gap-3 p-3">
            <Link href={"/" + l.slug} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-border bg-background">
              {l.image && <Image src={l.image} alt={l.name} fill sizes="96px" className="object-cover" />}
            </Link>
            <div className="flex min-w-0 flex-1 flex-col justify-between">
              <div>
                <Link href={"/" + l.slug} className="block truncate text-sm font-semibold hover:underline">{l.name}</Link>
                {l.variantName && <p className="text-xs text-muted">{l.variantName}</p>}
                <p className="mt-1 text-sm font-bold">{money(l.unitPrice)}</p>
              </div>
              <div className="flex items-center justify-between">
                <QuantitySelector value={l.quantity} onChange={(q) => setQty(l.key, q)} max={l.max} />
                <button type="button" onClick={() => {
                  const r = remove(l.key);
                  if (r) track("RemoveFromCart", { content_ids: [r.productId], product_id: r.productId, content_name: r.name, value: r.unitPrice * r.quantity, currency: "DZD", num_items: r.quantity });
                }} aria-label={s.cart.remove + " " + l.name} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          </li>
        ))}
      </ul>
      <aside className="card h-fit space-y-3 p-4">
        <div className="flex items-center justify-between"><span className="text-sm text-muted">{s.cart.subtotal}</span><span className="text-lg font-extrabold">{money(subtotal)}</span></div>
        <p className="text-xs text-muted">{t.deliveryFeeNote}</p>
        <Link href="/checkout" className="btn-primary block text-center">{s.cart.checkout}</Link>
        <Link href="/shop" className="block text-center text-sm text-muted underline">{s.cart.continue}</Link>
      </aside>
    </div>
  );
}
