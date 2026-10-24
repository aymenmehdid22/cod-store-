"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function CustomerEditor({ id, notes, tags, canEdit }: { id: string; notes: string; tags: string[]; canEdit: boolean }) {
  const router = useRouter();
  const [n, setN] = useState(notes);
  const [t, setT] = useState(tags.join(", "));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/customers/" + id, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes: n || null, tags: t.split(",").map((x) => x.trim()).filter(Boolean) }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setMsg({ ok: false, text: "Enregistrement impossible." }); return; }
    setMsg({ ok: true, text: "Enregistré." }); router.refresh();
  }
  return (
    <form onSubmit={save} className="space-y-3">
      <div><label htmlFor="c-tags" className="label">Tags (séparés par des virgules)</label><input id="c-tags" className="input" disabled={!canEdit} value={t} onChange={(e) => setT(e.target.value)} placeholder="vip, grossiste…" /></div>
      <div><label htmlFor="c-notes" className="label">Notes</label><textarea id="c-notes" className="input min-h-[90px]" disabled={!canEdit} maxLength={2000} value={n} onChange={(e) => setN(e.target.value)} /></div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
      {canEdit ? <button type="submit" disabled={busy} className="btn-primary !px-4 !py-2">{busy ? "…" : "Enregistrer"}</button> : <p className="text-xs text-muted">Lecture seule pour votre rôle.</p>}
    </form>
  );
}
