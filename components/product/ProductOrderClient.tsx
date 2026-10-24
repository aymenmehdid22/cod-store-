"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Star } from "lucide-react";
import type { Product, ProductImage } from "@/types/product";
import ProductGallery from "./ProductGallery";
import ColorSelector from "./ColorSelector";
import QuantitySelector from "./QuantitySelector";
import OrderForm from "./OrderForm";
import StickyCTA from "./StickyCTA";
import { formatDZD } from "@/lib/format";
import { track } from "@/lib/tracking";
import { useCart } from "@/lib/cart";
import { ShoppingBag, Check as CheckIcon } from "lucide-react";
import Link from "next/link";
import { useI18n, fmt } from "@/lib/i18n/provider";

function getVariantImages(product: Product, variantId: string | undefined): ProductImage[] {
  if (variantId) {
    const variant = product.variants?.find((v) => v.id === variantId);
    const byVariantId = product.images.filter((img) => img.variantId === variantId);
    if (byVariantId.length > 0) return byVariantId;
    if (variant && variant.images.length > 0) {
      const byId = product.images.filter((img) => variant.images.includes(img.id));
      if (byId.length > 0) return byId;
    }
  }
  const generic = product.images.filter((img) => !img.variantId);
  return generic.length > 0 ? generic : product.images;
}

export default function ProductOrderClient({ product }: { product: Product }) {
  const { t, s } = useI18n();
  const cart = useCart();
  const [added, setAdded] = useState(false);
  const money = (n: number) => formatDZD(n, t.currency);
  const availableVariants = product.variants?.filter((v) => v.available) ?? [];
  const [variantId, setVariantId] = useState<string | undefined>(availableVariants[0]?.id);
  const [quantity, setQuantity] = useState(1);

  const variant = product.variants?.find((v) => v.id === variantId);
  const unitPrice = variant?.price ?? product.price; // the server recomputes this; display only
  const maxQty = Math.max(1, Math.min(10, variant?.stock ?? product.stock ?? 10));
  const images = useMemo(
    () => getVariantImages(product, variantId),
    [product, variantId]
  );

  useEffect(() => setQuantity((q) => Math.min(q, maxQty)), [maxQty]);

  useEffect(() => {
    track("ViewContent", { content_name: product.name, content_ids: [product.id], product_id: product.id, value: unitPrice, currency: product.currency });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div className="grid gap-6 md:grid-cols-2 md:gap-12">
        <div className="self-start md:sticky md:top-6">
          <ProductGallery
            images={images.length > 0 ? images : product.images}
            productName={product.name}
          />
        </div>

        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {product.name}
            </h1>
            {typeof product.rating === "number" && (
              <div className="mt-1.5 flex items-center gap-0.5" aria-label={fmt(t.ratingLabel, { n: product.rating })}>
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    className={
                      "h-4 w-4 " +
                      (i < Math.round(product.rating!) ? "fill-amber-400 text-amber-400" : "text-border")
                    }
                  />
                ))}
              </div>
            )}
            <div className="mt-3 flex flex-wrap items-baseline gap-3">
              <span className="text-3xl font-extrabold tracking-tight">
                {money(unitPrice)}
              </span>
              {product.oldPrice && (
                <span className="text-lg text-muted line-through">
                  {money(product.oldPrice)}
                </span>
              )}
            </div>
            {product.oldPrice && (
              <p className="mt-1 text-sm font-semibold text-green-700">
                {fmt(t.save, { amount: money(product.oldPrice - unitPrice) })}
              </p>
            )}
          </div>

          {product.variants && product.variants.length > 0 && (
            <ColorSelector
              variants={product.variants}
              selectedId={variantId}
              onSelect={setVariantId}
            />
          )}

          <QuantitySelector
            value={quantity}
            onChange={setQuantity}
            max={maxQty}
          />

          {product.soldOut ? (
            <p className="rounded-2xl border border-border bg-white p-4 text-center text-sm font-semibold text-muted">
              {t.soldOut}
            </p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  cart.add({
                    productId: product.id, variantId: variant?.id, slug: product.slug, name: product.name, variantName: variant?.name,
                    image: images[0]?.url, unitPrice, quantity, max: maxQty,
                  });
                  track("AddToCart", { content_name: product.name, content_ids: [product.id], product_id: product.id, value: unitPrice * quantity, currency: product.currency, num_items: quantity });
                  setAdded(true);
                  setTimeout(() => setAdded(false), 2500);
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-foreground bg-white px-6 py-3 text-sm font-bold transition hover:bg-background"
              >
                {added ? <CheckIcon className="h-4 w-4" aria-hidden /> : <ShoppingBag className="h-4 w-4" aria-hidden />}
                {added ? s.cart.added : s.cart.add}
              </button>
              {added && <Link href="/cart" className="-mt-2 block text-center text-sm underline">{s.cart.viewCart}</Link>}
              <OrderForm
                items={[{ productId: product.id, variantId: variant?.id, quantity }]}
                lines={[{ name: product.name, variantName: variant?.name, quantity, unitPrice }]}
                currency={product.currency}
              />
            </>
          )}

          {product.benefits && product.benefits.length > 0 && (
            <ul className="space-y-2 rounded-2xl border border-border bg-white p-4">
              {product.benefits.map((b) => (
                <li key={b} className="flex items-center gap-2 text-sm text-[#333]">
                  <Check className="h-4 w-4 shrink-0 text-green-600" />
                  {b}
                </li>
              ))}
            </ul>
          )}

          {product.description && (
            <details className="rounded-2xl border border-border bg-white p-4">
              <summary className="cursor-pointer text-sm font-semibold">{t.descriptionTitle}</summary>
              <p className="mt-2 text-sm leading-relaxed text-muted">{product.description}</p>
            </details>
          )}
        </div>
      </div>

      {!product.soldOut && <StickyCTA price={unitPrice} quantity={quantity} />}
    </>
  );
}