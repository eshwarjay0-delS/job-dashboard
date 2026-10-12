"use client"
import { useState } from "react"
import type { Mail } from "../../_suite/sample"
import type { IgnoreRule } from "@/lib/gmail-ignore"

export default function IgnoreControls({ mails, selected, rules, onSave, showIgnored, onToggle }: {
  mails: Mail[]; selected: string[]; rules: IgnoreRule[]; onSave: (rules: IgnoreRule[]) => Promise<void>; showIgnored: boolean; onToggle: () => void;
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [manage, setManage] = useState(false)
  async function save(next: IgnoreRule[]) {
    setBusy(true); setError("")
    try { await onSave(next) } catch (e) { setError(e instanceof Error ? e.message : "Could not save") } finally { setBusy(false) }
  }
  function add(kind: IgnoreRule["kind"]) {
    const next = mails.filter(m => selected.includes(`${m.account}:${m.id}`)).map(m => ({ account: m.account.toLowerCase(), kind, value: kind === "thread" ? m.id : kind === "sender" ? m.fromEmail.toLowerCase() : m.fromEmail.toLowerCase().split("@")[1] }))
    void save([...rules, ...next])
  }
  return <section style={{ padding: 14, border: "1px solid var(--border)", borderRadius: 12, marginBottom: 16 }} aria-label="Ignore controls">
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
      <span>{selected.length} selected</span>
      {(["thread", "sender", "domain"] as const).map(kind => <button className="btn-outline" disabled={busy || !selected.length} key={kind} onClick={() => add(kind)}>Ignore {kind === "thread" ? "selected emails" : kind}</button>)}
      <button className="btn-outline" onClick={onToggle}>{showIgnored ? "Show active" : "Show ignored"}</button>
      <button className="btn-outline" onClick={() => setManage(v => !v)}>Ignore list ({rules.length})</button>
    </div>
    <p style={{ fontSize: 12, marginTop: 8 }}>Ignored items leave your attention queue. Evidence remains in Overview. Gmail messages are not deleted.</p>
    {error && <p role="alert">{error}</p>}
    {manage && <div>{rules.map((r, i) => <div key={`${r.account}:${r.kind}:${r.value}`} style={{ padding: 8, overflowWrap: "anywhere" }}>{r.account} · {r.action === "allow" ? "Keep visible" : "Ignore"} {r.kind}: {r.value} <button disabled={busy} onClick={() => save(rules.filter((_, n) => n !== i))}>Remove rule</button></div>)}</div>}
  </section>
}
