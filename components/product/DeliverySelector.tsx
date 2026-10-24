"use client";

import { Home, Package } from "lucide-react";
import { useI18n } from "@/lib/i18n/provider";

export default function DeliverySelector({
  value,
  onChange,
}: {
  value: "home" | "stopdesk";
  onChange: (v: "home" | "stopdesk") => void;
}) {
  const { t } = useI18n();
  const options = [
    {
      value: "home" as const,
      icon: Home,
      title: t.deliveryHomeTitle,
      sub: t.deliveryHomeSub,
    },
    {
      value: "stopdesk" as const,
      icon: Package,
      title: t.deliveryStopdeskTitle,
      sub: t.deliveryStopdeskSub,
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={
              "rounded-xl border-2 bg-white p-4 text-start transition " +
              (active ? "border-foreground" : "border-border hover:border-[#bbbbbb]")
            }
          >
            <Icon className={"h-5 w-5 " + (active ? "text-foreground" : "text-muted")} />
            <p className="mt-2 text-sm font-bold">{opt.title}</p>
            <p className="text-xs text-muted">{opt.sub}</p>
          </button>
        );
      })}
    </div>
  );
}
