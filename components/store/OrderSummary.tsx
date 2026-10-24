"use client";

import { formatDZD } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";
import type { Quote } from "@/lib/use-quote";

export type SummaryLine = { name: string; variantName?: string; quantity: number; unitPrice: number };

export default function OrderSummary({ lines, quote, loading, estimate }: { lines: SummaryLine[]; quote: Quote | null; loading: boolean; estimate: number }) {
  const { t, s } = useI18n();
  const money = (n: number) => formatDZD(n, t.currency);
  const row = "flex items-center justify-between gap-3 text-sm";
  return (
    <div className="space-y-2 border-t border-border pt-4" aria-live="polite" aria-busy={loading}>
      {lines.length > 1 && lines.map((l, i) => (
        <div key={i} className={row + " text-muted"}>
          <span className="min-w-0 truncate">{l.name}{l.variantName ? " · " + l.variantName : ""} × {l.quantity}</span>
          <span className="shrink-0">{money(l.unitPrice * l.quantity)}</span>
        </div>
      ))}
      <div className={row}><span className="text-muted">{s.cart.subtotal}</span><span>{money(quote?.subtotal ?? estimate)}</span></div>
      {quote && quote.discount > 0 && <div className={row}><span className="text-muted">{s.checkout.discount}</span><span className="text-green-700">− {money(quote.discount)}</span></div>}
      <div className={row}>
        <span className="text-muted">{s.checkout.shipping}</span>
        <span>{!quote || !quote.shipping_known ? <span className="text-xs text-muted">{s.checkout.shippingTbd}</span> : quote.shipping === 0 ? s.checkout.free : money(quote.shipping)}</span>
      </div>
      <div className="flex items-center justify-between pt-1">
        <span className="text-sm font-semibold">{s.checkout.total}</span>
        <span className="text-xl font-extrabold">{money(quote?.total ?? estimate)}</span>
      </div>
    </div>
  );
}
