"use client";
import { createBrowserClient } from "@supabase/ssr";

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX = 5 * 1024 * 1024;

/** Uploads to the public `store-assets` bucket (Storage policy: owner/manager only). Returns the public URL. */
export async function uploadStoreAsset(file: File, folder: "branding" | "home"): Promise<{ url?: string; error?: string }> {
  if (!IMAGE_TYPES.includes(file.type)) return { error: "Format non pris en charge (JPG, PNG, WebP, AVIF)." };
  if (file.size > MAX) return { error: "Fichier trop lourd (5 Mo max)." };
  const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
  const path = folder + "/" + crypto.randomUUID() + "." + file.type.split("/")[1];
  const { error } = await supabase.storage.from("store-assets").upload(path, file, { cacheControl: "31536000", contentType: file.type });
  if (error) return { error: "Échec de l'envoi." };
  return { url: supabase.storage.from("store-assets").getPublicUrl(path).data.publicUrl };
}

export async function putJson(url: string, body: unknown, method = "PUT"): Promise<{ ok: boolean; message?: string }> {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  if (!res) return { ok: false, message: "Erreur réseau." };
  const data = await res.json().catch(() => ({}));
  if (res.ok) return { ok: true };
  const m: string[] = [...(data.issues?.formErrors ?? []), ...Object.values((data.issues?.fieldErrors ?? {}) as Record<string, string[]>).flat()];
  return { ok: false, message: m.join(" ") || data.error || "Enregistrement impossible." };
}
