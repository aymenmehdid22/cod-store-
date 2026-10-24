import type { MetadataRoute } from "next";
import { getActiveProducts } from "@/lib/catalog";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products = await getActiveProducts();
  return products.map((p) => ({
    url: SITE_URL + "/" + p.slug,
    lastModified: new Date(),
    changeFrequency: "weekly",
    priority: 1,
  }));
}
