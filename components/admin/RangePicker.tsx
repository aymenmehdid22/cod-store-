import Link from "next/link";
import { RANGE_LABELS, type RangeKey } from "@/lib/date-range";

export default function RangePicker({ basePath, current, from, to }: { basePath: string; current: RangeKey; from: string; to: string }) {
  const keys: RangeKey[] = ["today", "7d", "30d", "90d"];
  return (
    <div className="mb-5 flex flex-wrap items-end gap-2">
      <div role="group" aria-label="Période" className="flex flex-wrap gap-1.5">
        {keys.map((k) => (
          <Link key={k} href={basePath + "?range=" + k} aria-current={current === k ? "true" : undefined}
            className={"rounded-full border px-3 py-1.5 text-sm " + (current === k ? "border-foreground bg-foreground text-white" : "border-border bg-white hover:bg-background")}>{RANGE_LABELS[k]}</Link>
        ))}
      </div>
      <form method="GET" action={basePath} className="flex flex-wrap items-end gap-2">
        <input type="hidden" name="range" value="custom" />
        <label className="text-xs text-muted">Du<input type="date" name="from" defaultValue={from} className="input mt-0.5 !py-1.5" /></label>
        <label className="text-xs text-muted">Au<input type="date" name="to" defaultValue={to} className="input mt-0.5 !py-1.5" /></label>
        <button type="submit" className="rounded-xl border border-border bg-white px-3 py-2 text-sm font-medium hover:bg-background">Appliquer</button>
      </form>
    </div>
  );
}
