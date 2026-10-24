// Dependency-free, accessible bar chart: one real series, no decoration. Table equivalent is provided for screen readers.
export default function BarChart({ data, label, format }: { data: { label: string; value: number }[]; label: string; format: (n: number) => string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const w = 720, h = 180, pad = 4, bw = Math.max(2, (w - pad * 2) / Math.max(1, data.length) - 2);
  return (
    <figure>
      <svg viewBox={"0 0 " + w + " " + (h + 18)} role="img" aria-label={label} className="w-full">
        <title>{label}</title>
        {data.map((d, i) => {
          const bh = Math.round((d.value / max) * h);
          const x = pad + i * (bw + 2);
          return <rect key={d.label} x={x} y={h - bh} width={bw} height={Math.max(bh, d.value > 0 ? 1 : 0)} rx={1.5} className="fill-foreground"><title>{d.label + " : " + format(d.value)}</title></rect>;
        })}
        <line x1="0" x2={w} y1={h} y2={h} className="stroke-border" />
        {data.length > 0 && <><text x={pad} y={h + 14} className="fill-muted text-[10px]">{data[0].label}</text><text x={w - pad} y={h + 14} textAnchor="end" className="fill-muted text-[10px]">{data[data.length - 1].label}</text></>}
      </svg>
      <figcaption className="mt-1 text-xs text-muted">Max : {format(max)}</figcaption>
      <table className="sr-only"><caption>{label}</caption><tbody>{data.map((d) => <tr key={d.label}><th scope="row">{d.label}</th><td>{format(d.value)}</td></tr>)}</tbody></table>
    </figure>
  );
}
