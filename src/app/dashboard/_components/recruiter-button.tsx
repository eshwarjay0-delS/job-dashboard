"use client"

// "My recruiter", wherever a person is shown. One press adds them to the person's own recruiter list; a second choice
// adds everyone at their company; a press takes them off again.
//
// The owner, 13 Oct 2026: "whenever there is an email, in whichever tab, if I say this is my recruiter, once I click
// that, it would be added. And also give me an option like: any person from this company is my recruiter."
// What the list does is in src/lib/my-recruiters.ts: someone on it is never said to be owed a nudge, and whoever they
// write to is shown as the one to watch. Every button on a page reads the same list, fetched once.

import { useEffect, useState, type CSSProperties } from "react"
import { companyDomainOf, recruiterRuleFor, type RecruiterRule } from "@/lib/my-recruiters"

let known: RecruiterRule[] | null = null
let asking: Promise<void> | null = null
const watching = new Set<(rules: RecruiterRule[]) => void>()
const tell = (rules: RecruiterRule[]) => { known = rules; watching.forEach(f => f(rules)) }
function ask(): Promise<void> {
  if (!asking) asking = fetch("/api/gmail/recruiters", { cache: "no-store" }).then(r => r.json())
    .then(j => { if (j?.ok && Array.isArray(j.recruiters)) tell(j.recruiters) }).catch(() => { asking = null })
  return asking
}

/** The person's recruiter list, the same on every button of the page. */
export function useRecruiters(): RecruiterRule[] {
  const [rules, setRules] = useState<RecruiterRule[]>(known || [])
  useEffect(() => { watching.add(setRules); void ask(); return () => { watching.delete(setRules) } }, [])
  return rules
}

/** Add to or take off the list. Throws with words a person can read when it could not be saved. */
export async function changeRecruiter(method: "POST" | "DELETE", rule: { kind: "person" | "company"; value: string; name?: string }): Promise<void> {
  const r = await fetch("/api/gmail/recruiters", { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(rule) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.ok) throw new Error(j.error || "That could not be saved just now.")
  tell(Array.isArray(j.recruiters) ? j.recruiters : [])
}

const pill: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 36, padding: "0 12px", borderRadius: 18, fontSize: 13.5, fontWeight: 600, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", cursor: "pointer", whiteSpace: "nowrap" }

export default function RecruiterButton({ email, name = "", onChanged }: { email: string; name?: string; onChanged?: () => void }) {
  const rules = useRecruiters()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const address = String(email || "").trim().toLowerCase()
  if (!address.includes("@")) return null
  const rule = recruiterRuleFor(rules, address)
  const company = companyDomainOf(address)
  const run = async (method: "POST" | "DELETE", what: { kind: "person" | "company"; value: string; name?: string }) => {
    if (busy) return
    setBusy(true); setError("")
    try { await changeRecruiter(method, what); onChanged?.() } catch (e) { setError(e instanceof Error ? e.message : "That could not be saved just now.") } finally { setBusy(false) }
  }

  return (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
      {rule ? (
        <>
          <span style={{ ...pill, cursor: "default", borderColor: "var(--accent)", background: "var(--accent-soft)" }} title="No nudge is ever said to be due to your recruiter. Whoever they write to is shown as the one to watch.">
            ✓ Your recruiter{rule.kind === "company" ? ` (everyone at ${rule.value})` : ""}
          </span>
          <button type="button" disabled={busy} onClick={() => { void run("DELETE", { kind: rule.kind, value: rule.value }) }} style={{ ...pill, color: "var(--text-muted)", borderColor: "var(--border)" }}>{busy ? "Saving…" : "Undo"}</button>
        </>
      ) : (
        <>
          <button type="button" disabled={busy} onClick={() => { void run("POST", { kind: "person", value: address, name }) }} style={pill} title={`${name || address} works for you: never ask me to chase them.`}>{busy ? "Saving…" : "My recruiter"}</button>
          {company && <button type="button" disabled={busy} onClick={() => { void run("POST", { kind: "company", value: company }) }} style={{ ...pill, fontWeight: 500, color: "var(--text-muted)", borderColor: "var(--border)" }} title={`Everyone who writes from ${company} is your recruiter.`}>Anyone at {company}</button>}
        </>
      )}
      {error && <span role="alert" style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{error}</span>}
    </span>
  )
}
