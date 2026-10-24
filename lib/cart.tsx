"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type CartLine = {
  key: string; // productId:variantId
  productId: string; variantId?: string; slug: string; name: string; variantName?: string; image?: string;
  unitPrice: number; // display only — the server re-prices at quote/checkout time
  quantity: number; max: number;
};

type Ctx = { lines: CartLine[]; count: number; ready: boolean; add: (l: Omit<CartLine, "key">) => void; setQty: (key: string, q: number) => void; remove: (key: string) => CartLine | undefined; clear: () => void };
const CartContext = createContext<Ctx | null>(null);
const KEY = "cod_cart_v1"; // strictly-necessary storage (the basket itself): no consent needed, never sent anywhere

export const lineKey = (productId: string, variantId?: string) => productId + ":" + (variantId ?? "");

/** Pure helpers (unit-tested). */
export function addLine(lines: CartLine[], l: Omit<CartLine, "key">): CartLine[] {
  const key = lineKey(l.productId, l.variantId);
  const max = Math.max(1, Math.min(10, l.max));
  const found = lines.find((x) => x.key === key);
  if (found) return lines.map((x) => (x.key === key ? { ...x, unitPrice: l.unitPrice, max, quantity: Math.min(max, x.quantity + l.quantity) } : x));
  if (lines.length >= 10) return lines;
  return [...lines, { ...l, key, max, quantity: Math.max(1, Math.min(max, l.quantity)) }];
}
export function setLineQty(lines: CartLine[], key: string, q: number): CartLine[] {
  return lines.map((x) => (x.key === key ? { ...x, quantity: Math.max(1, Math.min(x.max, Math.round(q) || 1)) } : x));
}
export function parseCart(raw: string | null): CartLine[] {
  try {
    const a = JSON.parse(raw ?? "[]");
    if (!Array.isArray(a)) return [];
    return a.filter((x) => x && typeof x.productId === "string" && typeof x.quantity === "number" && typeof x.unitPrice === "number").slice(0, 10)
      .map((x) => ({ ...x, key: lineKey(x.productId, x.variantId), max: Math.max(1, Math.min(10, x.max ?? 10)), quantity: Math.max(1, Math.min(10, Math.round(x.quantity))) }));
  } catch { return []; }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setLines(parseCart(localStorage.getItem(KEY)));
    setReady(true);
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setLines(parseCart(e.newValue)); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);
  useEffect(() => { if (ready) { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch { /* ignore */ } } }, [lines, ready]);

  const add = useCallback((l: Omit<CartLine, "key">) => setLines((p) => addLine(p, l)), []);
  const setQty = useCallback((key: string, q: number) => setLines((p) => setLineQty(p, key, q)), []);
  const remove = useCallback((key: string) => {
    let removed: CartLine | undefined;
    setLines((p) => { removed = p.find((x) => x.key === key); return p.filter((x) => x.key !== key); });
    return removed;
  }, []);
  const clear = useCallback(() => setLines([]), []);
  const value = useMemo(() => ({ lines, count: lines.reduce((n, l) => n + l.quantity, 0), ready, add, setQty, remove, clear }), [lines, ready, add, setQty, remove, clear]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): Ctx {
  const c = useContext(CartContext);
  if (!c) throw new Error("useCart must be used inside <CartProvider>");
  return c;
}
