"use client"

// "My recruiter", wherever a person is shown. One press adds them to the person's own recruiter list; a second choice
// adds everyone at their company; a press takes them off again.
//
// The owner, 13 Oct 2026: "whenever there is an email, in whichever tab, if I say this is my recruiter, once I click
// that, it would be added. And also give me an option like: any person from this company is my recruiter."
// What the list does is in src/lib/my-recruiters.ts: someone on it is never said to be owed a nudge, and whoever they
// write to is shown as the one to watch. Every button on a page reads the same list, fetched once.

import { useEffect, useRef, useState, type CSSProperties } from "react"
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

const item: CSSProperties = { display: "block", width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: 8, border: 0, background: "transparent", color: "var(--text)", fontSize: 14, fontWeight: 500, cursor: "pointer", whiteSpace: "normal", overflowWrap: "anywhere" }

export default function RecruiterButton({ email, name = "", onChanged }: { email: string; name?: string; onChanged?: () => void }) {
  const rules = useRecruiters()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLSpanElement | null>(null)
  // The menu closes on a press anywhere else, and on Escape.
  useEffect(() => {
    if (!open) return
    const away = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", away); document.addEventListener("keydown", esc)
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", esc) }
  }, [open])
  const address = String(email || "").trim().toLowerCase()
  if (!address.includes("@")) return null
  const rule = recruiterRuleFor(rules, address)
  const company = companyDomainOf(address)
  const run = async (method: "POST" | "DELETE", what: { kind: "person" | "company"; value: string; name?: string }) => {
    if (busy) return
    setBusy(true); setError("")
    try { await changeRecruiter(method, what); setOpen(false); onChanged?.() } catch (e) { setError(e instanceof Error ? e.message : "That could not be saved just now.") } finally { setBusy(false) }
  }

  // Three dots: it is an option, not something to read on every card (owner, 13 Oct 2026: "Have this menu in a three
  // dots that basically symbolizes as a optional setting ... show a hovering window"). Who already is his recruiter is
  // still said in plain sight beside the dots; the choices are in the small window the dots open.
  return (
    <span ref={box} style={{ position: "relative", display: "inline-flex", gap: 6, alignItems: "center" }}>
      {rule && (
        <span style={{ ...pill, cursor: "default", borderColor: "var(--accent)", background: "var(--accent-soft)" }} title="No nudge is ever said to be due to your recruiter. Whoever they write to is shown as the one to watch.">
          ✓ Your recruiter
        </span>
      )}
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-label={`More about ${name || address}`} title="More" onClick={() => setOpen(v => !v)}
        style={{ ...pill, width: 36, padding: 0, justifyContent: "center", fontSize: 18, lineHeight: 1, letterSpacing: 1 }}>⋯</button>
      {open && (
        <span role="menu" aria-label={`Options for ${name || address}`}
          style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", zIndex: 40, minWidth: 230, maxWidth: "min(320px, 86vw)", padding: 6, borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--bg)", boxShadow: "0 14px 34px rgba(12,11,8,.22)", display: "flex", flexDirection: "column", gap: 2 }}>
          {rule ? (
            <>
              <span style={{ ...item, cursor: "default", color: "var(--text-muted)" }}>✓ Your recruiter{rule.kind === "company" ? `: everyone at ${rule.value}` : ""}</span>
              <button type="button" role="menuitem" disabled={busy} onClick={() => { void run("DELETE", { kind: rule.kind, value: rule.value }) }} style={item}>{busy ? "Saving…" : "Take off my recruiter list"}</button>
            </>
          ) : (
            <>
              <button type="button" role="menuitem" disabled={busy} onClick={() => { void run("POST", { kind: "person", value: address, name }) }} style={item} title={`${name || address} works for you: never ask me to chase them.`}>{busy ? "Saving…" : "My recruiter"}</button>
              {company && <button type="button" role="menuitem" disabled={busy} onClick={() => { void run("POST", { kind: "company", value: company }) }} style={item} title={`Everyone who writes from ${company} is your recruiter.`}>Anyone at {company} is my recruiter</button>}
            </>
          )}
          {error && <span role="alert" style={{ ...item, cursor: "default", fontSize: 12.5, color: "var(--text-muted)" }}>{error}</span>}
        </span>
      )}
    </span>
  )
}
