import type { Locale } from "@/lib/i18n/config";

export type ProductImage = {
  id: string;
  url: string;
  alt: string;
  variantId?: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  color?: string; // hex color used for the swatch
  images: string[]; // optional list of ProductImage ids (variantId on images is preferred)
  available: boolean; // false when disabled by the admin OR sold out
  stock?: number; // units left (undefined = untracked)
  price?: number; // per-variant price override (falls back to the product price)
};

export type Product = {
  id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  oldPrice?: number;
  currency: "DZD";
  rating?: number; // 0–5, displayed only when defined
  images: ProductImage[];
  variants?: ProductVariant[];
  benefits?: string[];
  deliveryAvailable: boolean;
  stock?: number; // units left across variants (undefined = untracked)
  soldOut?: boolean;
  /** Optional per-locale overrides. French (the base fields above) is the fallback. */
  translations?: Partial<
    Record<
      Locale,
      {
        name?: string;
        description?: string;
        benefits?: string[];
        variants?: Record<string, string>; // variant id -> localized name
      }
    >
  >;
};
