"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2, Archive, Eye, ImageOff } from "lucide-react";
import { ProductStatusBadge } from "./ui";
import { formatDZD } from "@/lib/format";

export type ProductRow = {
  id: string; slug: string; name: string; price: number; status: string; sku: string | null;
  stock: number | null; low: boolean; image: string | null; updated_at: string;
};

export default function ProductsTable({ rows, canWrite }: { rows: ProductRow[]; canWrite: boolean }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const allSelected = rows.length > 0 && selected.size === rows.length;

  async function call(url: string, init: RequestInit, okMsg?: string) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.error ?? "Action impossible."); return false; }
      setSelected(new Set());
      router.refresh();
      return true;
    } catch { setError("Erreur réseau. Réessayez."); return false; }
    finally { setBusy(false); void okMsg; }
  }

  const setStatus = (ids: string[], status: string) =>
    call("/api/admin/products/status", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, status }) });
  const duplicate = async (id: string) => {
    setBusy(true); setError(null);
    const res = await fetch("/api/admin/products/" + id + "/duplicate", { method: "POST" }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setError(data.error ?? "Duplication impossible."); return; }
    router.push("/admin/products/" + data.id);
  };
  const remove = (r: ProductRow) => {
    if (!window.confirm("Supprimer définitivement « " + r.name + " » ?\nLes commandes existantes conservent leur historique. Pour simplement le masquer, archivez-le plutôt.")) return;
    return call("/api/admin/products/" + r.id, { method: "DELETE" });
  };

  return (
    <div>
      {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {canWrite && selected.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-border bg-white px-3 py-2 text-sm">
          <span className="font-medium">{selected.size} sélectionné(s)</span>
          <button disabled={busy} onClick={() => setStatus(Array.from(selected), "active")} className="rounded-lg border border-border px-3 py-1 hover:bg-background">Publier</button>
          <button disabled={busy} onClick={() => setStatus(Array.from(selected), "draft")} className="rounded-lg border border-border px-3 py-1 hover:bg-background">Brouillon</button>
          <button disabled={busy} onClick={() => window.confirm("Archiver " + selected.size + " produit(s) ? Ils disparaîtront de la boutique.") && setStatus(Array.from(selected), "archived")} className="rounded-lg border border-border px-3 py-1 hover:bg-background">Archiver</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
              {canWrite && <th className="w-10 px-4 py-3"><input type="checkbox" aria-label="Tout sélectionner" checked={allSelected} onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))} /></th>}
              <th scope="col" className="px-4 py-3 text-start font-medium">Produit</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Statut</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Prix</th>
              <th scope="col" className="px-4 py-3 text-start font-medium">Stock</th>
              {canWrite && <th scope="col" className="px-4 py-3 text-end font-medium">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border last:border-0 hover:bg-background">
                {canWrite && <td className="px-4 py-3"><input type="checkbox" aria-label={"Sélectionner " + r.name} checked={selected.has(r.id)} onChange={() => toggle(r.id)} /></td>}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-white">
                      {r.image ? <Image src={r.image} alt="" fill sizes="44px" className="object-cover" /> : <ImageOff className="h-4 w-4 text-muted" aria-hidden />}
                    </div>
                    <div className="min-w-0">
                      <Link href={"/admin/products/" + r.id} className="block truncate font-semibold hover:underline">{r.name}</Link>
                      <span className="text-xs text-muted" dir="ltr">/{r.slug}{r.sku ? " · " + r.sku : ""}</span>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3"><ProductStatusBadge status={r.status} /></td>
                <td className="whitespace-nowrap px-4 py-3 font-semibold">{formatDZD(r.price)}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  {r.stock === null ? <span className="text-muted">Non suivi</span> : <span className={r.stock === 0 ? "font-semibold text-red-600" : r.low ? "font-semibold text-amber-600" : ""}>{r.stock}{r.stock === 0 ? " · épuisé" : r.low ? " · bas" : ""}</span>}
                </td>
                {canWrite && (
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Link href={"/admin/products/" + r.id} aria-label={"Modifier " + r.name} title="Modifier" className="rounded-lg p-2 hover:bg-white"><Pencil className="h-4 w-4" /></Link>
                      <button disabled={busy} onClick={() => duplicate(r.id)} aria-label={"Dupliquer " + r.name} title="Dupliquer" className="rounded-lg p-2 hover:bg-white"><Copy className="h-4 w-4" /></button>
                      {r.status === "archived"
                        ? <button disabled={busy} onClick={() => setStatus([r.id], "draft")} aria-label={"Restaurer " + r.name} title="Restaurer en brouillon" className="rounded-lg p-2 hover:bg-white"><Eye className="h-4 w-4" /></button>
                        : <button disabled={busy} onClick={() => window.confirm("Archiver « " + r.name + " » ? Il disparaîtra de la boutique.") && setStatus([r.id], "archived")} aria-label={"Archiver " + r.name} title="Archiver" className="rounded-lg p-2 hover:bg-white"><Archive className="h-4 w-4" /></button>}
                      <button disabled={busy} onClick={() => remove(r)} aria-label={"Supprimer " + r.name} title="Supprimer" className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
