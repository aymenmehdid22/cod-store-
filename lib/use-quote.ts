"use client";

import { useEffect, useState } from "react";

export type Quote = { subtotal: number; discount: number; shipping: number; total: number; shipping_known: boolean };
export type QuoteItem = { productId: string; variantId?: string; quantity: number };

/** Debounced server quote: subtotal, discount, shipping and total are computed by the database. */
export function useQuote(items: QuoteItem[], wilayaCode: string, deliveryType: "home" | "stopdesk", promoCode: string) {
  const [quote, setQuote] = useState<Quote | null>(null);
  const [error, setError] = useState<{ code?: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const sig = JSON.stringify([items, wilayaCode, deliveryType, promoCode.trim().toUpperCase()]);

  useEffect(() => {
    if (items.length === 0) { setQuote(null); setError(null); return; }
    const ctrl = new AbortController();
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const res = await fetch("/api/quote", {
          method: "POST", headers: { "Content-Type": "application/json" }, signal: ctrl.signal,
          body: JSON.stringify({ items, wilayaCode: wilayaCode || undefined, deliveryType, promoCode: promoCode.trim() || undefined }),
        });
        const data = await res.json();
        if (!res.ok) { setError({ code: data.code, message: data.error }); if (data.code !== "DISCOUNT_INVALID") setQuote(null); return; }
        setError(null); setQuote(data as Quote);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setError({ code: "network", message: "network" });
      } finally { if (!ctrl.signal.aborted) setLoading(false); }
    }, 350);
    return () => { clearTimeout(id); ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig]);

  return { quote, error, loading };
}
