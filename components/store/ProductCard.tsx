import Link from "next/link";
import Image from "next/image";
import { formatDZD } from "@/lib/format";
import type { CardProduct } from "@/lib/store-data";

export default function ProductCard({ p, locale, currency, soldOutLabel, saleLabel }: { p: CardProduct; locale: string; currency: string; soldOutLabel: string; saleLabel: string }) {
  const name = locale === "ar" && p.name_ar ? p.name_ar : p.name;
  const onSale = p.compare_at_price && p.compare_at_price > p.price;
  return (
    <Link href={"/" + p.slug} className="card group block overflow-hidden transition hover:border-[#bbbbbb]">
      <div className="relative aspect-square bg-background">
        {p.image && <Image src={p.image} alt={name} fill sizes="(min-width: 768px) 25vw, 50vw" className="object-cover transition duration-300 group-hover:scale-[1.03]" />}
        {p.soldOut && <span className="absolute start-2 top-2 rounded-full bg-foreground px-2.5 py-1 text-[11px] font-bold text-white">{soldOutLabel}</span>}
        {!p.soldOut && onSale && <span className="absolute start-2 top-2 rounded-full bg-red-600 px-2.5 py-1 text-[11px] font-bold text-white">{saleLabel}</span>}
      </div>
      <div className="p-3">
        <h3 className="truncate text-sm font-semibold">{name}</h3>
        <p className="mt-1 text-sm">
          <span className="font-extrabold">{formatDZD(p.price, currency)}</span>
          {onSale && <span className="ms-2 text-xs text-muted line-through">{formatDZD(p.compare_at_price!, currency)}</span>}
        </p>
      </div>
    </Link>
  );
}
