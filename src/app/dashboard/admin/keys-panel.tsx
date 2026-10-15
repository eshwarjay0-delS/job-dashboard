"use client"

// The admin's API keys (owner, 2026-10-07: "give me placeholder to update any API-key I want. And also select and edit
// checklist which apps or features can use that API right there").
//
// One card per provider: where its key is kept, a field to paste a new one, and the checklist of features that may use it.
// A key goes one way, from this field to the server. It is never shown again: the page is told only the last four characters
// and the day it was stored, and the field is emptied the moment the save answers. Nothing typed here is kept in the browser.

import { useCallback, useEffect, useState, type CSSProperties } from "react"
import { Card, Meta } from "../_suite/ui"
import type { Feature, VaultProvider, VaultRow } from "@/lib/keyVault"

type View = { canStore: boolean; sealedWith?: "own" | "storage" | "none"; providers: VaultRow[]; features: Feature[]; defaults: Record<string, VaultProvider> }

const PROVIDER_LABEL: Record<VaultProvider, string> = { openai: "OpenAI", groq: "Groq", openrouter: "OpenRouter", anthropic: "Anthropic", gemini: "Gemini" }
const PROVIDER_ORDER: VaultProvider[] = ["openrouter", "openai", "groq", "anthropic", "gemini"]

const SMALL: CSSProperties = { fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }
const FIELD: CSSProperties = {
  width: "100%", minHeight: 44, padding: "0 12px", fontSize: 15, fontFamily: "var(--font-mono)", color: "var(--text)",
  background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)",
}
const GROUP: Record<Feature["app"], string> = { marketfit: "MarketFit", kompas: "Kompas" }

function Pill({ children, tone }: { children: string; tone: "good" | "plain" | "warn" }) {
  const c = tone === "good" ? ["var(--success-soft)", "var(--success)", "var(--success-border)"]
    : tone === "warn" ? ["var(--warning-soft)", "var(--warning)", "var(--warning-border)"]
    : ["var(--surface-2)", "var(--text-muted)", "var(--border)"]
  return <span style={{ fontFamily: "var(--font-label)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap", padding: "2px 9px", borderRadius: 100, background: c[0], color: c[1], border: `1px solid ${c[2]}` }}>{children}</span>
}

// `locked` is true while ANY card is saving: each save rewrites the one stored document, so two at once could lose one.
function ProviderCard({ row, features, canStore, locked, onSaving, onSaved }: { row: VaultRow; features: Feature[]; canStore: boolean; locked: boolean; onSaving: (on: boolean) => void; onSaved: (v: View) => void }) {
  const [key, setKey] = useState("")
  const [use, setUse] = useState<string[]>(row.use)
  const [mine, setMine] = useState(false)
  const busy = mine || locked
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null)
  // The server's answer is the truth: after a save, or when another admin changed it, the ticks follow what is stored.
  useEffect(() => { setUse(row.use) }, [row.use])

  const ticksChanged = use.length !== row.use.length || use.some(id => !row.use.includes(id))
  const send = async (body: Record<string, unknown>, done: string) => {
    if (locked) return
    setMine(true); onSaving(true); setSaid(null)
    try {
      const response = await fetch("/api/admin/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ provider: row.provider, ...body }) })
      const answer = await response.json().catch(() => ({}))
      if (!response.ok) { setSaid({ ok: false, text: answer.error || "That could not be saved. Nothing was changed." }); return }
      setKey("")
      onSaved(answer as View)
      setSaid({ ok: true, text: done })
    } catch {
      setSaid({ ok: false, text: "That could not be sent. Check your connection and try again. Nothing was changed." })
    } finally { setMine(false); onSaving(false) }
  }

  const where = row.kept === "here" ? `Kept here, ends in ${row.last4}` : row.kept === "deployment" ? "Kept on Vercel" : "No key"
  const day = row.kept === "here" && row.setAt ? new Date(row.setAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : ""
  const fieldId = `key-${row.provider}`

  const save = (
    <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 14 }}>
      <button type="button" className="btn-outline" disabled={busy || (!key.trim() && !ticksChanged)}
        onClick={() => void send({ ...(key.trim() ? { key: key.trim() } : {}), ...(ticksChanged || key.trim() ? { use } : {}) }, key.trim() ? "Saved. The new key is in use." : "Saved.")}
        style={{ minHeight: 44, padding: "0 18px", fontSize: 15 }}>{mine ? "Saving…" : "Save"}</button>
      {row.setAt && (
        <button type="button" className="btn-ghost" disabled={busy}
          onClick={() => { if (window.confirm(`Remove the ${row.name} key kept here?${row.deploymentHasKey ? " The key on Vercel will be used again." : " This provider will have no key."}`)) void send({ remove: true }, "Removed.") }}
          style={{ minHeight: 44, padding: "0 14px", fontSize: 15 }}>Remove the key kept here</button>
      )}
    </div>
  )

  // One provider to a row: its key on the left, then what MarketFit and what Kompas may use it for. Any number of
  // providers stays even, and on a phone the three parts stack.
  return (
    <Card>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "20px 28px" }}>
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", margin: 0 }}>{row.name}</h3>
            <Pill tone={row.kept === "none" ? "plain" : "good"}>{where}</Pill>
          </div>
          <p style={{ ...SMALL, marginTop: 6 }}>
            {row.unreadable ? "A key was stored here but can no longer be opened (the deployment's sealing secret changed). Paste it again."
              : row.kept === "here" ? `Stored ${day}.${row.deploymentHasKey ? " Removing it puts the key on Vercel back in use." : ""}`
              : row.kept === "deployment" ? "A key pasted here takes over from the one on Vercel, with no redeploy."
              : "Paste a key to start using this provider."}
          </p>
          <label htmlFor={fieldId} style={{ display: "block", marginTop: 14 }}><Meta>{row.kept === "none" ? "Add a key" : "Replace the key"}</Meta></label>
          <input id={fieldId} type="password" value={key} onChange={e => setKey(e.target.value)} disabled={busy || !canStore}
            placeholder={canStore ? `Paste a ${row.name} key` : "Keys cannot be stored on this deployment yet"}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} data-1p-ignore data-lpignore="true"
            style={{ ...FIELD, marginTop: 6 }} />
          {save}
          <p role={said && !said.ok ? "alert" : "status"} aria-live="polite" style={{ ...SMALL, marginTop: 8, minHeight: 22, color: said ? (said.ok ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>{said?.text ?? ""}</p>
        </div>

        {(["marketfit", "kompas"] as const).filter(app => features.some(f => f.app === app)).map(app => (
          <fieldset key={app} style={{ border: "none", padding: 0, margin: 0, minWidth: 0 }}>
            <legend style={{ padding: 0, marginBottom: 6 }}><Meta>{GROUP[app]} may use it for</Meta></legend>
            {features.filter(f => f.app === app).map(f => (
              <label key={f.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "6px 0", fontSize: 14.5, lineHeight: 1.4, color: "var(--text)", cursor: busy ? "default" : "pointer" }}>
                <input type="checkbox" checked={use.includes(f.id)} disabled={busy}
                  onChange={e => setUse(now => (e.target.checked ? [...now, f.id] : now.filter(id => id !== f.id)))}
                  style={{ width: 18, height: 18, marginTop: 1, flexShrink: 0, accentColor: "var(--accent)" }} />
                <span>{f.label}{f.elsewhere && <span style={{ color: "var(--text-soft)" }}> · runs on the Kompas site, which gets this key only when one is kept here</span>}</span>
              </label>
            ))}
          </fieldset>
        ))}
      </div>
    </Card>
  )
}

// Which AI each feature uses (owner, 2026-10-14: "set what AI needed to use for what feature directly...
// It should be default choice!!"). One dropdown per feature; a feature asks its default first and falls back to the
// other ticked providers when that fails.
function DefaultsCard({ features, defaults, locked, onSaving, onSaved }: { features: Feature[]; defaults: Record<string, VaultProvider>; locked: boolean; onSaving: (on: boolean) => void; onSaved: (v: View) => void }) {
  const [pick, setPick] = useState<Record<string, VaultProvider>>(defaults)
  const [mine, setMine] = useState(false)
  const [said, setSaid] = useState<{ ok: boolean; text: string } | null>(null)
  const busy = mine || locked
  useEffect(() => { setPick(defaults) }, [defaults])
  const changed = Object.keys(pick).some(id => pick[id] !== defaults[id]) || Object.keys(defaults).some(id => pick[id] !== defaults[id])

  const save = async () => {
    if (locked || !changed) return
    setMine(true); onSaving(true); setSaid(null)
    try {
      const response = await fetch("/api/admin/keys", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ defaults: pick }) })
      const answer = await response.json().catch(() => ({}))
      if (!response.ok) { setSaid({ ok: false, text: answer.error || "That could not be saved. Nothing was changed." }); return }
      onSaved(answer as View)
      setSaid({ ok: true, text: "Saved. Each feature now asks its chosen AI first." })
    } catch {
      setSaid({ ok: false, text: "That could not be sent. Check your connection and try again. Nothing was changed." })
    } finally { setMine(false); onSaving(false) }
  }

  return (
    <Card>
      <h3 style={{ fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 700, color: "var(--text)", margin: "0 0 6px" }}>Which AI each feature uses</h3>
      <p style={{ ...SMALL, marginBottom: 14, maxWidth: 760 }}>
        The default AI for each feature. A feature asks its default first; when that fails it falls back to the other providers ticked for it below.
      </p>
      {(["marketfit", "kompas"] as const).filter(app => features.some(f => f.app === app)).map(app => (
        <div key={app} style={{ marginBottom: 12 }}>
          <Meta>{GROUP[app]}</Meta>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "8px 28px", marginTop: 6 }}>
            {features.filter(f => f.app === app).map(f => (
              <label key={f.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, fontSize: 14.5, color: "var(--text)" }}>
                <span style={{ lineHeight: 1.4 }}>{f.label}</span>
                <select value={pick[f.id] ?? "openrouter"} disabled={busy}
                  onChange={e => setPick(now => ({ ...now, [f.id]: e.target.value as VaultProvider }))}
                  style={{ minHeight: 40, padding: "0 10px", fontSize: 14.5, color: "var(--text)", background: "var(--bg)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", flexShrink: 0 }}>
                  {PROVIDER_ORDER.map(p => <option key={p} value={p}>{PROVIDER_LABEL[p]}</option>)}
                </select>
              </label>
            ))}
          </div>
        </div>
      ))}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 6 }}>
        <button type="button" className="btn-outline" disabled={busy || !changed} onClick={() => void save()}
          style={{ minHeight: 44, padding: "0 18px", fontSize: 15 }}>{mine ? "Saving…" : "Save AI choices"}</button>
        <p role={said && !said.ok ? "alert" : "status"} aria-live="polite" style={{ ...SMALL, margin: 0, color: said ? (said.ok ? "var(--success)" : "var(--danger)") : "var(--text-muted)" }}>{said?.text ?? ""}</p>
      </div>
    </Card>
  )
}

export default function KeysPanel() {
  const [view, setView] = useState<View | null>(null)
  const [failed, setFailed] = useState(false)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/keys", { cache: "no-store" })
      if (!response.ok) { setFailed(true); return }
      setView(await response.json()); setFailed(false)
    } catch { setFailed(true) }
  }, [])
  useEffect(() => { void load() }, [load])

  if (!view) return <Card><p style={{ ...SMALL, fontSize: 15.5 }} role="status">{failed ? "The keys and checklists could not be read just now, so nothing is shown instead of a guess. Nothing is changed." : "Reading the keys…"}</p>{failed && <button type="button" className="btn-outline" style={{ minHeight: 44, padding: "0 18px", fontSize: 15, marginTop: 12 }} onClick={() => { setFailed(false); void load() }}>Try again</button>}</Card>

  return (
    <>
      {!view.canStore && (
        <div style={{ marginBottom: 16, padding: "14px 18px", borderRadius: "var(--radius-lg)", background: "var(--warning-soft)", border: "1px solid var(--warning-border)", fontSize: 14.5, lineHeight: 1.6, color: "var(--text)" }}>
          Keys cannot be stored here yet: this deployment has no secret to seal them with. Set KEY_VAULT_SECRET on Vercel (any 32 or more random characters). The checklists below still work.
        </div>
      )}
      <div style={{ display: "grid", gap: 16 }}>
        <DefaultsCard features={view.features} defaults={view.defaults} locked={saving} onSaving={setSaving} onSaved={setView} />
        {view.providers.map(row => <ProviderCard key={row.provider} row={row} features={view.features} canStore={view.canStore} locked={saving} onSaving={setSaving} onSaved={setView} />)}
      </div>
      {view.canStore && view.sealedWith === "storage" && (
        <p style={{ ...SMALL, marginTop: 14, maxWidth: 760 }}>
          Keys kept here are sealed with the storage account&apos;s own secret, so the seal does not protect them from someone who has that secret. For a separate seal, set KEY_VAULT_SECRET on Vercel (32 or more random characters) and paste the keys again.
        </p>
      )}
    </>
  )
}
