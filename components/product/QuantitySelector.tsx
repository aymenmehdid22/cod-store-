"use client";

import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

export default function QuantitySelector({
  value,
  onChange,
  max = 10,
}: {
  value: number;
  onChange: (v: number) => void;
  max?: number;
}) {
  const { t } = useI18n();
  return (
    <div>
      <p className="label">{t.quantityLabel}</p>
      <div className="mt-2 inline-flex items-center rounded-full border border-border bg-white">
        <button
          type="button"
          aria-label={t.decreaseQty}
          onClick={() => onChange(Math.max(1, value - 1))}
          disabled={value <= 1}
          className="p-2.5 text-muted transition hover:text-black disabled:opacity-30"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="w-10 text-center text-sm font-bold">{value}</span>
        <button
          type="button"
          aria-label={t.increaseQty}
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="p-2.5 text-muted transition hover:text-black disabled:opacity-30"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
