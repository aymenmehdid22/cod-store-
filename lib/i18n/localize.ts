import type { Product } from "@/types/product";
import type { Wilaya } from "@/data/wilayas";
import type { Locale } from "./config";

/** Returns a copy of the product with its text fields in the requested locale (French is the base). */
export function localizeProduct(product: Product, locale: Locale): Product {
  const tr = product.translations?.[locale];
  if (!tr) return product;
  return {
    ...product,
    name: tr.name ?? product.name,
    description: tr.description ?? product.description,
    benefits: tr.benefits ?? product.benefits,
    variants: product.variants?.map((v) => ({ ...v, name: tr.variants?.[v.id] ?? v.name })),
  };
}

export function wilayaLabel(w: Wilaya, locale: Locale): string {
  return locale === "ar" ? w.nameAr : w.name;
}
