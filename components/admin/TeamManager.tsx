"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Field } from "./ui";
import { putJson } from "@/lib/upload-client";
import { ROLE_LABELS, type AdminRole } from "@/lib/permissions";

export type Member = { user_id: string; email: string; display_name: string | null; role: AdminRole; created_at: string };

export default function TeamManager({ members, selfId }: { members: Member[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminRole>("order_operator");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    const r = await putJson("/api/admin/team", { email, role, display_name: name || undefined }, "POST");
    setBusy(false);
    if (!r.ok) { setMsg({ ok: false, text: r.message ?? "Erreur." }); return; }
    setEmail(""); setName(""); setMsg({ ok: true, text: "Accès accordé (invitation envoyée si le compte n'existait pas)." }); router.refresh();
  }
  async function changeRole(m: Member, next: AdminRole) {
    setMsg(null);
    const r = await putJson("/api/admin/team/" + m.user_id, { role: next });
    if (!r.ok) setMsg({ ok: false, text: r.message ?? "Erreur." });
    router.refresh();
  }
  async function remove(m: Member) {
    if (!window.confirm("Retirer l'accès admin de " + m.email + " ?")) return;
    const r = await putJson("/api/admin/team/" + m.user_id, {}, "DELETE");
    if (!r.ok) setMsg({ ok: false, text: r.message ?? "Erreur." });
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={invite} className="card grid gap-4 p-5 sm:grid-cols-4" aria-label="Ajouter un membre">
        <Field label="Email" htmlFor="m-e"><input id="m-e" type="email" required dir="ltr" className="input" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Nom affiché" htmlFor="m-n"><input id="m-n" className="input" maxLength={80} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Rôle" htmlFor="m-r"><select id="m-r" className="input" value={role} onChange={(e) => setRole(e.target.value as AdminRole)}>{(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></Field>
        <div className="flex items-end"><button type="submit" disabled={busy} className="btn-primary w-full !py-2.5">{busy ? "…" : "Ajouter"}</button></div>
      </form>
      {msg && <p role={msg.ok ? "status" : "alert"} className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead><tr className="border-b border-border text-xs uppercase tracking-wide text-muted">{["Membre", "Rôle", ""].map((h, i) => <th key={i} scope="col" className="px-4 py-3 text-start font-medium">{h || <span className="sr-only">Actions</span>}</th>)}</tr></thead>
          <tbody>{members.map((m) => (
            <tr key={m.user_id} className="border-b border-border last:border-0">
              <td className="px-4 py-3"><p className="font-semibold">{m.display_name ?? m.email}{m.user_id === selfId && <span className="ms-2 text-xs text-muted">(vous)</span>}</p><p className="text-xs text-muted" dir="ltr">{m.email}</p></td>
              <td className="px-4 py-3"><select aria-label={"Rôle de " + m.email} className="input !mt-0 max-w-[220px] !py-1.5" value={m.role} onChange={(e) => changeRole(m, e.target.value as AdminRole)}>{(Object.keys(ROLE_LABELS) as AdminRole[]).map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}</select></td>
              <td className="px-4 py-3 text-end">{m.user_id !== selfId && <button onClick={() => remove(m)} aria-label={"Retirer " + m.email} className="rounded-lg p-2 text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /></button>}</td>
            </tr>))}</tbody>
        </table>
      </div>
      <div className="card p-4 text-xs text-muted"><p className="font-semibold text-foreground">Permissions</p><ul className="mt-1 list-disc space-y-1 ps-5"><li><b>Propriétaire</b> : tout, y compris tracking, équipe et journal d&apos;audit.</li><li><b>Gestionnaire</b> : catalogue, stock, promotions, clients, contenu, réglages, analytics, exports.</li><li><b>Opérateur commandes</b> : voit les commandes et les clients, change les statuts, ajoute des notes. Pas d&apos;export, pas de catalogue.</li></ul></div>
    </div>
  );
}
