"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function OrderNoteForm({ id }: { id: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/orders/" + id + "/notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setError("Impossible d'ajouter la note."); return; }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="order-note" className="label">Nouvelle note interne</label>
      <textarea id="order-note" className="input min-h-[72px]" value={body} maxLength={2000} onChange={(e) => setBody(e.target.value)} />
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      <button type="submit" disabled={busy || !body.trim()} className="btn-primary !px-4 !py-2">{busy ? "…" : "Ajouter"}</button>
    </form>
  );
}
