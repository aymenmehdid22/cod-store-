"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function PasswordForm() {
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 10) { setMsg({ ok: false, text: "10 caractères minimum." }); return; }
    if (pw !== pw2) { setMsg({ ok: false, text: "Les mots de passe ne correspondent pas." }); return; }
    setBusy(true); setMsg(null);
    const supabase = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { error } = await supabase.auth.updateUser({ password: pw });
    setBusy(false);
    if (error) { setMsg({ ok: false, text: "Mise à jour impossible : " + error.message }); return; }
    setPw(""); setPw2(""); setMsg({ ok: true, text: "Mot de passe mis à jour." });
  }
  return (
    <form onSubmit={submit} className="space-y-3" aria-label="Changer le mot de passe">
      <div><label htmlFor="pw1" className="label">Nouveau mot de passe</label><input id="pw1" type="password" autoComplete="new-password" minLength={10} className="input" value={pw} onChange={(e) => setPw(e.target.value)} required /></div>
      <div><label htmlFor="pw2" className="label">Confirmer</label><input id="pw2" type="password" autoComplete="new-password" className="input" value={pw2} onChange={(e) => setPw2(e.target.value)} required /></div>
      {msg && <p role={msg.ok ? "status" : "alert"} className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
      <button type="submit" disabled={busy} className="btn-primary !px-5 !py-2">{busy ? "…" : "Mettre à jour"}</button>
    </form>
  );
}
