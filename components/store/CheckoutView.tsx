"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import OrderForm from "@/components/product/OrderForm";
import { useCart } from "@/lib/cart";
import { useI18n } from "@/lib/i18n/provider";

export default function CheckoutView() {
  const { s } = useI18n();
  const { lines, ready, clear } = useCart();
  const items = lines.map((l) => ({ productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
  // Remount the form (and its idempotency key) only when the basket content changes.
  const formKey = useRef(0);
  const sig = JSON.stringify(items);
  useEffect(() => { formKey.current += 1; }, [sig]);

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
    <div className="mx-auto max-w-lg">
      <OrderForm
        key={sig}
        items={items}
        lines={lines.map((l) => ({ name: l.name, variantName: l.variantName, quantity: l.quantity, unitPrice: l.unitPrice }))}
        onPlaced={clear}
      />
      <Link href="/cart" className="mt-3 block text-center text-sm text-muted underline">{s.checkout.back}</Link>
    </div>
  );
}
