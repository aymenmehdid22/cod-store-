import Link from "next/link";
import { ChevronRight } from "lucide-react";

export function PageHeader({
  title,
  crumbs,
  actions,
}: {
  title: string;
  crumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-5">
      {crumbs && crumbs.length > 0 && (
        <nav aria-label="Fil d'Ariane" className="mb-1.5 flex items-center gap-1 text-xs text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1">
              {c.href ? <Link href={c.href} className="hover:text-black hover:underline">{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <ChevronRight className="h-3 w-3" aria-hidden />}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-extrabold tracking-tight">{title}</h1>
        {actions}
      </div>
    </div>
  );
}

export function Field({ label, hint, children, htmlFor }: { label: string; hint?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const PRODUCT_STATUS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Brouillon", cls: "bg-gray-100 text-gray-700" },
  active: { label: "Actif", cls: "bg-green-50 text-green-700" },
  archived: { label: "Archivé", cls: "bg-amber-50 text-amber-700" },
};

export function ProductStatusBadge({ status }: { status: string }) {
  const s = PRODUCT_STATUS[status] ?? PRODUCT_STATUS.draft;
  return <span className={"inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold " + s.cls}>{s.label}</span>;
}

export function Pagination({ page, pageSize, total, basePath, params }: { page: number; pageSize: number; total: number; basePath: string; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (p: number) => {
    const sp = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => v && sp.set(k, v));
    sp.set("page", String(p));
    return basePath + "?" + sp.toString();
  };
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span className="text-muted">Page {page} / {pages} · {total} résultats</span>
      <div className="flex gap-2">
        {page > 1 && <Link href={href(page - 1)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">Précédent</Link>}
        {page < pages && <Link href={href(page + 1)} className="rounded-lg border border-border bg-white px-3 py-1.5 hover:bg-background">Suivant</Link>}
      </div>
    </div>
  );
}

export function EmptyState({ title, text, action }: { title: string; text?: string; action?: React.ReactNode }) {
  return (
    <div className="card px-6 py-12 text-center">
      <p className="font-semibold">{title}</p>
      {text && <p className="mt-1 text-sm text-muted">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
