"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ProductImage } from "@/types/product";
import { useI18n, fmt } from "@/lib/i18n/provider";

export default function ProductGallery({
  images,
  productName,
}: {
  images: ProductImage[];
  productName: string;
}) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    setIndex(0);
  }, [images]);

  const count = Math.max(images.length, 1);
  const safeIndex = Math.min(index, count - 1);
  const go = (i: number) => setIndex(((i % count) + count) % count);

  return (
    <div>
      <div
        className="relative aspect-square w-full overflow-hidden rounded-2xl border border-border bg-white"
        onTouchStart={(e) => {
          touchStartX.current = e.touches[0].clientX;
        }}
        onTouchEnd={(e) => {
          if (touchStartX.current == null) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) {
            if (dx < 0) go(safeIndex + 1);
            else go(safeIndex - 1);
          }
          touchStartX.current = null;
        }}
      >
        {images.map((img, i) => (
          <Image
            key={img.id + "-" + i}
            src={img.url}
            alt={img.alt || productName}
            fill
            priority={i === 0}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
            className={
              "object-cover transition-opacity duration-200 " +
              (i === safeIndex ? "opacity-100" : "opacity-0")
            }
          />
        ))}
        <span className="absolute bottom-3 end-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white md:hidden">
          {safeIndex + 1} / {count}
        </span>
      </div>

      {count > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={img.id + "-" + i}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={fmt(t.imageN, { n: i + 1 })}
              className={
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-white " +
                (i === safeIndex ? "border-foreground" : "border-border")
              }
            >
              <Image
                src={img.url}
                alt={img.alt || productName}
                fill
                sizes="64px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
