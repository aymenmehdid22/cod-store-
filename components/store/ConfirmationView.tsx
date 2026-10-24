"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";
import { formatDZD } from "@/lib/format";
import { LAST_ORDER_KEY } from "@/components/product/OrderForm";

// Display-only. No tracking event fires here: Lead is sent once when the order is placed, so refreshing or
// revisiting this page can never create a duplicate conversion. Only the order number and total are shown (no personal data).
export default function ConfirmationView({ orderNumber }: { orderNumber: string }) {
  const { t, s } = useI18n();
  const [total, setTotal] = useState<number | null>(null);
  useEffect(() => {
    try {
      const v = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) ?? "null");
      if (v?.n === orderNumber && typeof v.total === "number") setTotal(v.total);
    } catch { /* ignore */ }
  }, [orderNumber]);
  return (
    <div className="card mx-auto max-w-md p-6 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100"><CheckCircle2 className="h-8 w-8 text-green-600" aria-hidden /></div>
      <h1 className="text-xl font-extrabold tracking-tight">{s.confirm.title}</h1>
      <p className="mt-1 text-sm text-muted">{s.confirm.text}</p>
      <p className="mt-4 text-sm"><span className="text-muted">{s.confirm.number} </span><span dir="ltr" className="font-bold">#{orderNumber}</span></p>
      {total !== null && <p className="mt-3 rounded-xl border border-border bg-background p-3 text-base font-extrabold">{s.confirm.total} : {formatDZD(total, t.currency)}</p>}
      <p className="mt-4 text-xs text-muted">{s.confirm.keep}</p>
      <Link href="/shop" className="btn-primary mt-5 inline-block">{s.cart.continue}</Link>
    </div>
  );
}
