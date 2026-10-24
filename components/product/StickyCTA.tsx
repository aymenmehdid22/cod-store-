"use client";

import { useEffect, useState } from "react";
import { formatDZD } from "@/lib/format";
import { useI18n } from "@/lib/i18n/provider";

export default function StickyCTA({ price, quantity }: { price: number; quantity: number }) {
  const { t } = useI18n();
  const [show, setShow] = useState(true);

  useEffect(() => {
    const el = document.getElementById("commander-submit");
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-white/95 backdrop-blur md:hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-muted">{t.stickyTotal}</p>
          <p className="text-lg font-extrabold leading-tight">{formatDZD(price * quantity, t.currency)}</p>
        </div>
        <button
          type="button"
          onClick={() =>
            document
              .getElementById("order-form")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
          className="btn-primary flex-1"
        >
          {t.submit}
        </button>
      </div>
    </div>
  );
}
