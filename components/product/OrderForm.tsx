"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import WilayaSelect from "./WilayaSelect";
import DeliverySelector from "./DeliverySelector";
import OrderSummary, { type SummaryLine } from "@/components/store/OrderSummary";
import { track, getConsent } from "@/lib/tracking";
import { getAttribution } from "@/lib/analytics";
import { useQuote, type QuoteItem } from "@/lib/use-quote";
import { useI18n } from "@/lib/i18n/provider";

export const LAST_ORDER_KEY = "cod_last_order";

export default function OrderForm({
  items,
  lines,
  currency = "DZD",
  onPlaced,
}: {
  items: QuoteItem[];
  lines: SummaryLine[];
  currency?: "DZD";
  onPlaced?: () => void;
}) {
  const { t, s } = useI18n();
  const router = useRouter();
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [wilayaCode, setWilayaCode] = useState("");
  const [wilayaName, setWilayaName] = useState("");
  const [deliveryType, setDeliveryType] = useState<"home" | "stopdesk">("home");
  const [promoCode, setPromoCode] = useState("");
  const [website, setWebsite] = useState(""); // honeypot — invisible to humans
  // One key per form mount: a double-click or network retry can never create two orders.
  const idempotencyKey = useRef<string>(typeof crypto !== "undefined" ? crypto.randomUUID() : "");
  const checkoutStarted = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const estimate = lines.reduce((n, l) => n + l.unitPrice * l.quantity, 0);
  const { quote, error: quoteError, loading } = useQuote(items, wilayaCode, deliveryType, promoCode);
  const contentIds = items.map((i) => i.productId);

  // InitiateCheckout = the customer started filling the form (not merely viewing the page).
  function onFirstInteraction() {
    if (checkoutStarted.current) return;
    checkoutStarted.current = true;
    track("InitiateCheckout", { content_ids: contentIds, content_name: lines[0]?.name, value: estimate, currency, num_items: items.reduce((n, i) => n + i.quantity, 0) });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          promoCode: promoCode.trim() || undefined,
          idempotencyKey: idempotencyKey.current || undefined,
          marketingConsent: getConsent()?.marketing === true,
          customerName,
          phone,
          wilayaCode,
          wilayaName,
          deliveryType,
          website,
          attribution: getAttribution(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.errorGeneric);
        return;
      }
      // Lead = order PLACED (not revenue). Fired once, after the server confirmed it, never for a replayed request.
      // The same event_id is used by the server-side Conversions API event so Meta de-duplicates the pair.
      if (!data.replayed) {
        track("Lead", { content_ids: contentIds, content_name: lines[0]?.name, value: data.total, currency, event_id: "order-" + data.orderNumber });
      }
      try { sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify({ n: data.orderNumber, total: data.total })); } catch { /* ignore */ }
      onPlaced?.();
      router.push("/order-confirmation?n=" + encodeURIComponent(data.orderNumber));
    } catch {
      setError(t.errorNetwork);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} onFocusCapture={onFirstInteraction} id="order-form" className="card scroll-mt-6 p-5 sm:p-6">
      <h2 className="text-lg font-extrabold tracking-tight">{t.orderTitle}</h2>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="customerName" className="label">
            {t.fullName}
          </label>
          <input
            id="customerName"
            className="input"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            autoComplete="name"
            required
            minLength={3}
          />
        </div>

        <div>
          <label htmlFor="phone" className="label">
            {t.phone}
          </label>
          <input
            id="phone"
            type="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="0550 12 34 56"
            className="input text-start"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            autoComplete="tel"
            required
          />
        </div>

        <div>
          <span className="label">{t.wilayaLabel}</span>
          <WilayaSelect
            value={wilayaCode}
            onChange={(code, name) => {
              setWilayaCode(code);
              setWilayaName(name);
            }}
          />
        </div>

        <div>
          <span className="label">{t.deliveryLabel}</span>
          <div className="mt-1.5">
            <DeliverySelector value={deliveryType} onChange={setDeliveryType} />
          </div>
        </div>

        {/*
          Commune input removed for "home" delivery.
          Address input commented out below — re-enable by uncommenting if needed.
          Stopdesk input removed entirely.
        */}
        {deliveryType === "home" && (
          <>
            {/*
            <div>
              <label htmlFor="commune" className="label">
                Commune
              </label>
              <input
                id="commune"
                className="input"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                required
              />
            </div>
            */}
            {/*
            <div>
              <label htmlFor="address" className="label">
                Adresse
              </label>
              <input
                id="address"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Rue, immeuble, point de repère…"
                required
              />
            </div>
            */}
          </>
        )}

        <div>
          <label htmlFor="promoCode" className="label">
            {t.promoLabel}
          </label>
          <input
            id="promoCode"
            dir="ltr"
            className="input uppercase"
            value={promoCode}
            onChange={(e) => setPromoCode(e.target.value)}
            placeholder={t.promoPlaceholder}
            maxLength={32}
            autoComplete="off"
          />
        </div>

        {/* Honeypot: invisible to humans, bots fill it. */}
        <input
          type="text"
          name="website"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="hidden"
        />

        {quoteError?.code === "DISCOUNT_INVALID" && <p role="alert" className="-mt-2 text-xs text-red-700">{quoteError.message}</p>}
        {quoteError && quoteError.code !== "DISCOUNT_INVALID" && <p role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{quoteError.code === "network" || !quoteError.message ? s.checkout.quoteError : quoteError.message}</p>}

        <OrderSummary lines={lines} quote={quote} loading={loading} estimate={estimate} />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button id="commander-submit" type="submit" disabled={submitting || (!!quoteError && quoteError.code !== "DISCOUNT_INVALID" && quoteError.code !== "network")} className="btn-primary w-full">
          {submitting ? t.submitting : t.submit}
        </button>
      </div>
    </form>
  );
}