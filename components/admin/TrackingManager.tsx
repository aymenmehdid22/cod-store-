"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ID_PATTERNS, ADS_LABEL_PATTERN, META_TEST_CODE_PATTERN, PROVIDER_META, PROVIDERS, eventEnabled, type Provider } from "@/lib/tracking-config";

export type TrackingRow = { provider: Provider; enabled: boolean; public_id: string | null; config: { events?: Record<string, boolean>; conversion_label?: string | null; test_event_code?: string | null } | null };

function Card({ row, capiTokenSet, canEdit }: { row: TrackingRow; capiTokenSet: boolean; canEdit: boolean }) {
  const router = useRouter();
  const meta = PROVIDER_META[row.provider];
  const [enabled, setEnabled] = useState(row.enabled);
  const [id, setId] = useState(row.public_id ?? "");
  const [events, setEvents] = useState<Record<string, boolean>>(() => Object.fromEntries(meta.events.map((e) => [e.key, eventEnabled(row.config?.events, e.key)])));
  const [label, setLabel] = useState(row.config?.conversion_label ?? "");
  const [testCode, setTestCode] = useState(row.config?.test_event_code ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const idValid = id === "" || ID_PATTERNS[row.provider].test(id.trim());
  const labelValid = label === "" || ADS_LABEL_PATTERN.test(label);
  const testValid = testCode === "" || META_TEST_CODE_PATTERN.test(testCode);
  const canSave = canEdit && idValid && labelValid && testValid && (!enabled || id.trim() !== "");

  async function save() {
    setBusy(true); setMsg(null);
    const res = await fetch("/api/admin/tracking/" + row.provider, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled, public_id: id.trim() || null, events, conversion_label: label || null, test_event_code: testCode || null }),
    }).catch(() => null);
    setBusy(false);
    const data = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) {
      const m: string[] = [...(data.issues?.formErrors ?? []), ...Object.values((data.issues?.fieldErrors ?? {}) as Record<string, string[]>).flat()];
      setMsg({ ok: false, text: m.join(" ") || data.error || "Enregistrement impossible." }); return;
    }
    setMsg({ ok: true, text: "Enregistré. Les visiteurs verront ce changement à leur prochain chargement de page." }); router.refresh();
  }
  async function reset() {
    if (!window.confirm("Réinitialiser " + meta.label + " ? L'identifiant sera supprimé et l'outil désactivé.")) return;
    setBusy(true);
    const res = await fetch("/api/admin/tracking/" + row.provider, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (!res || !res.ok) { setMsg({ ok: false, text: "Réinitialisation impossible." }); return; }
    setEnabled(false); setId(""); setLabel(""); setTestCode(""); setMsg({ ok: true, text: "Réinitialisé." }); router.refresh();
  }

  const live = row.enabled && !!row.public_id;
  return (
    <section className="card space-y-4 p-5" aria-labelledby={"t-" + row.provider}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 id={"t-" + row.provider} className="text-base font-extrabold">{meta.label}</h2>
          <p className="text-xs text-muted">Catégorie de consentement : {meta.category === "analytics" ? "mesure d'audience" : "marketing"}</p>
        </div>
        <span className={"rounded-full px-2.5 py-1 text-xs font-semibold " + (live ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-700")}>{live ? "Actif" : "Inactif"}</span>
      </div>
      <label className="flex items-center gap-2 text-sm font-medium"><input type="checkbox" disabled={!canEdit} checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Activer {meta.label}</label>
      <div>
        <label htmlFor={"id-" + row.provider} className="label">{meta.idLabel}</label>
        <input id={"id-" + row.provider} dir="ltr" disabled={!canEdit} className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder={meta.example} aria-invalid={!idValid} aria-describedby={"idh-" + row.provider} />
        <p id={"idh-" + row.provider} className={"mt-1 text-xs " + (idValid ? "text-muted" : "text-red-700")}>{idValid ? (id ? "Format valide." : "Exemple : " + meta.example) : "Format invalide. Exemple : " + meta.example}</p>
      </div>
      {row.provider === "google_ads" && (
        <div><label htmlFor="ads-label" className="label">Libellé de conversion (commande passée)</label>
          <input id="ads-label" dir="ltr" disabled={!canEdit} className="input" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="AbC-dEfGhIjKlMnOp" aria-invalid={!labelValid} />
          {!labelValid && <p className="mt-1 text-xs text-red-700">6 à 40 caractères : lettres, chiffres, _ ou -.</p>}</div>
      )}
      {row.provider === "meta_pixel" && (
        <div><label htmlFor="meta-test" className="label">Code d&apos;événement de test (optionnel)</label>
          <input id="meta-test" dir="ltr" disabled={!canEdit} className="input" value={testCode} onChange={(e) => setTestCode(e.target.value.toUpperCase())} placeholder="TEST12345" aria-invalid={!testValid} />
          <p className={"mt-1 text-xs " + (testValid ? "text-muted" : "text-red-700")}>{testValid ? "Les événements serveur seront marqués « test » : à retirer en production." : "Format : TEST suivi de lettres/chiffres."}</p>
          <p className={"mt-2 rounded-lg px-3 py-2 text-xs " + (capiTokenSet ? "bg-green-50 text-green-800" : "bg-amber-50 text-amber-800")}>{capiTokenSet ? "META_ACCESS_TOKEN est défini côté serveur : l'API Conversions est opérationnelle." : "META_ACCESS_TOKEN n'est pas défini : seuls les événements navigateur fonctionnent (pas de Lead serveur ni de Purchase à la livraison)."}</p></div>
      )}
      {meta.events.length > 0 && (
        <fieldset><legend className="label">Événements</legend>
          <div className="mt-2 space-y-2">{meta.events.map((e) => (
            <label key={e.key} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={!canEdit} checked={events[e.key] ?? false} onChange={(ev) => setEvents({ ...events, [e.key]: ev.target.checked })} />
              <span>{e.label}{e.note && <span className="block text-xs text-muted">{e.note}</span>}</span></label>))}</div></fieldset>
      )}
      <p className="rounded-lg bg-background px-3 py-2 text-xs text-muted"><b>Test / diagnostic :</b> {meta.help}</p>
      {msg && <p role={msg.ok ? "status" : "alert"} className={"text-sm " + (msg.ok ? "text-green-700" : "text-red-700")}>{msg.text}</p>}
      {canEdit ? (
        <div className="flex gap-2"><button type="button" disabled={busy || !canSave} onClick={save} className="btn-primary !px-5 !py-2">{busy ? "…" : "Enregistrer"}</button><button type="button" disabled={busy} onClick={reset} className="rounded-xl border border-border bg-white px-4 py-2 text-sm hover:bg-background">Réinitialiser</button></div>
      ) : <p className="text-xs text-muted">Seul le propriétaire peut modifier ces réglages.</p>}
    </section>
  );
}

export default function TrackingManager({ rows, capiTokenSet, canEdit }: { rows: TrackingRow[]; capiTokenSet: boolean; canEdit: boolean }) {
  const byProvider = new Map(rows.map((r) => [r.provider, r]));
  return <div className="grid gap-4 lg:grid-cols-2">{PROVIDERS.map((p) => <Card key={p} row={byProvider.get(p) ?? { provider: p, enabled: false, public_id: null, config: null }} capiTokenSet={capiTokenSet} canEdit={canEdit} />)}</div>;
}
