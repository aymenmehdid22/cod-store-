import { z } from "zod";
import { WILAYAS } from "@/data/wilayas";

// Accepts 0550123456 / 0550 12 34 56 / 0550-12-34-56 / +213550123456 and
// returns the canonical form "0550123456", or null when invalid.
export function normalizeAlgerianPhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+213")) digits = "0" + digits.slice(4);
  else if (digits.startsWith("00213")) digits = "0" + digits.slice(5);
  else if (digits.startsWith("213")) digits = "0" + digits.slice(3);
  digits = digits.replace(/\D/g, "");
  return /^0(5|6|7)\d{8}$/.test(digits) ? digits : null;
}

const attributionSchema = z.object({
  fbclid: z.string().max(200).optional(),
  utm_source: z.string().max(100).optional(),
  utm_medium: z.string().max(100).optional(),
  utm_campaign: z.string().max(100).optional(),
  utm_content: z.string().max(100).optional(),
});

export const orderSchema = z
  .object({
    items: z
      .array(z.object({ productId: z.string().uuid(), variantId: z.string().uuid().optional(), quantity: z.number().int().min(1).max(10) }))
      .min(1)
      .max(10),
    promoCode: z.string().trim().max(32).optional(),
    idempotencyKey: z.string().uuid().optional(),
    marketingConsent: z.boolean().optional(), // customer accepted marketing cookies — gates server-side (CAPI) events
    customerName: z.string().min(3).max(100),
    phone: z.string().min(8).max(25),
    wilayaCode: z.string().refine((c) => WILAYAS.some((x) => x.code === c), "invalid_wilaya"),
    wilayaName: z.string().min(1).max(100),
    deliveryType: z.enum(["home", "stopdesk"]),
    commune: z.string().max(100).optional(),
    address: z.string().max(300).optional(),
    stopdesk: z.string().max(200).optional(),
    website: z.string().optional(), // honeypot — must stay empty
    attribution: attributionSchema.optional(),
  });