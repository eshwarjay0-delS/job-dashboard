"use client"
import { useEffect, useMemo, useRef, useState } from "react"
import { Search, SlidersHorizontal, X } from "lucide-react"
import type { Mail } from "../../_suite/sample"
import { senderEmail, senderName } from "@/lib/mail-reading"
import { parseQuery, indexDoc, matches, suggestPeople, pickPerson, toggleWord, type Found, type Person } from "@/lib/mail-search"

// The search bar over the inbox. The owner, 12 Oct 2026: "Give me search bar similar to gmail search bar as well."
// One wide bar. Type a name, a company, a job or a word the email said. The list answers at once from the lines already on
// the page, and a moment later from the server, which looks inside every message (POST /api/gmail/search).
// The Gmail words work (from:, subject:, is:unread, newer_than:7d, "a phrase", -leave out, OR); nobody has to know them.

export type Place = Found & { who: string }
export interface MailSearch {
  q: string; setQ: (q: string) => void
  active: boolean            // something is being searched for: the list shows results, not a pile
  results: Mail[]
  hits: Record<string, Place>
  pending: boolean           // the server is still looking inside the messages
  deep: boolean              // these results come from inside the messages, not only the lines on the page
  searched: number           // how many conversations the server looked through
  count: number              // how many matched in all (the list shows the newest 60)
  unknown: string[]          // typed, and not something this app can answer
  people: Person[]           // everyone who wrote, for the suggestions under the bar
}

const lineOf = (m: Mail) => indexDoc({
  from: `${m.from} ${senderName(m.fromEmail)} ${senderEmail(m.fromEmail)}`, to: m.account, cc: "",
  subject: m.subject, text: `${m.role} ${m.company} ${m.preview} ${m.rate || ""}`, unread: !!m.unread, ts: m.ts || 0,
})

/** `inbox` is the inbox chosen on the page ("" for all of them): the server counts and lists within it. */
export function useMailSearch(mails: Mail[], inbox = ""): MailSearch {
  const [q, setQ] = useState("")
  const tz = useMemo(() => new Date().getTimezoneOffset(), [])
  const query = useMemo(() => parseQuery(q, { tzOffsetMinutes: tz }), [q, tz])
  const lines = useMemo(() => mails.map(m => ({ m, doc: lineOf(m) })), [mails])
  const [now] = useState(() => Date.now())   // "the last 7 days" is counted from when the page was opened
  const local = useMemo(() => query.empty ? [] : lines.filter(x => matches(x.doc, query, now)).map(x => x.m), [lines, query, now])
  const people = useMemo(() => {
    const by = new Map<string, Person>()
    for (const m of mails) {
      const email = senderEmail(m.fromEmail)
      if (!email) continue
      const p = by.get(email) || { name: senderName(m.fromEmail) || m.from, email, count: 0, last: 0 }
      p.count += 1
      p.last = Math.max(p.last, m.ts || 0)
      by.set(email, p)
    }
    return [...by.values()]
  }, [mails])

  // The server's last answer, and the words it was an answer to. `inside` is null when it could not look (no kept copy,
  // or the request failed): the lines on the page are then the honest answer, and the page says that is all it looked at.
  const [answer, setAnswer] = useState<{ q: string; inbox: string; inside: { mails: Mail[]; hits: Record<string, Place>; searched: number; count: number } | null } | null>(null)
  const typed = q.trim()
  useEffect(() => {
    if (query.empty) return
    const stop = new AbortController()
    const timer = setTimeout(() => {
      fetch("/api/gmail/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: typed, tz, account: inbox }), signal: stop.signal })
        .then(r => r.json())
        .then(j => setAnswer({ q: typed, inbox, inside: j?.ok && j.kept ? { mails: j.mails || [], hits: j.hits || {}, searched: j.searched || 0, count: j.count || 0 } : null }))
        .catch(e => { if (e?.name !== "AbortError") setAnswer({ q: typed, inbox, inside: null }) })
    }, 280)
    return () => { clearTimeout(timer); stop.abort() }
  }, [typed, query.empty, tz, inbox])

  // An answer counts only for the words and the inbox it was asked about.
  const current = !!answer && answer.q === typed && answer.inbox === inbox
  const inside = current ? answer.inside : null
  return {
    q, setQ, active: !query.empty, people,
    pending: !query.empty && !current,
    results: inside ? inside.mails : local,
    hits: inside ? inside.hits : {},
    deep: !!inside, searched: inside ? inside.searched : 0, count: inside ? inside.count : local.length,
    unknown: query.unknown,
  }
}

const QUICK: Array<[string, string]> = [["Unread", "is:unread"], ["This week", "newer_than:7d"], ["This month", "newer_than:1m"]]
const EXAMPLES: Array<[string, string]> = [
  ["dana", "any word: a name, a company, a job, or something the email said"],
  ["from:dana", "only mail from Dana"],
  ["subject:analyst", "only when the subject says it"],
  ["\"updated resume\"", "these words, together"],
  ["analyst -remote", "leave out the ones that say remote"],
  ["java OR python", "either one"],
  ["is:unread", "not read yet"],
  ["newer_than:7d", "from the last 7 days (d days, w weeks, m months)"],
  ["before:2026/10/01", "before a day; after: works the same way"],
]
const iconBtn = { width: 40, height: 40, flex: "none", display: "grid", placeItems: "center", borderRadius: 20, border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer" } as const

export default function MailSearchBar({ search }: { search: MailSearch }) {
  const { q, setQ } = search
  const box = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)     // the bar is being used: its suggestions and quick buttons are out
  const [help, setHelp] = useState(false)
  const [at, setAt] = useState(-1)            // which suggested person the arrow keys are on
  const offered = open ? suggestPeople(search.people, q) : []
  const parts = q.split(/\s+/).filter(Boolean).map(p => p.toLowerCase())

  // "/" goes to the search from anywhere on the page, as it does in Gmail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.ctrlKey || e.metaKey || e.altKey) return
      const el = document.activeElement as HTMLElement | null
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable)) return
      e.preventDefault()
      input.current?.focus()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  const pick = (p: Person) => { setQ(pickPerson(q, p.email)); setAt(-1); input.current?.focus() }
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" && offered.length) { e.preventDefault(); setAt(i => (i + 1) % offered.length) }
    else if (e.key === "ArrowUp" && offered.length) { e.preventDefault(); setAt(i => (i <= 0 ? offered.length - 1 : i - 1)) }
    else if (e.key === "Enter" && at >= 0 && offered[at]) { e.preventDefault(); pick(offered[at]!) }
    else if (e.key === "Escape") { if (help) setHelp(false); else if (q) setQ(""); else input.current?.blur(); setAt(-1) }
  }

  return (
    <div ref={box} role="search" aria-label="Search your job mail" style={{ position: "relative", maxWidth: 760, marginBottom: 14 }}
      // Pressing a suggestion or a quick button must not take the typing box out of use first: in Safari a button does
      // not take focus when pressed, the box would lose it to nothing, the bar would close, and the press would land on
      // a button that is no longer there.
      onMouseDown={e => { if ((e.target as HTMLElement).tagName !== "INPUT") e.preventDefault() }}
      onFocus={() => setOpen(true)}
      onBlur={e => { if (!box.current?.contains(e.relatedTarget as Node | null)) { setOpen(false); setHelp(false); setAt(-1) } }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, minHeight: 52, padding: "0 6px 0 18px", borderRadius: 26,
        // The same surface open or closed: at night every typing box is given --surface by the theme, and a bar of another
        // shade showed the box as a rectangle inside it.
        background: "var(--surface)",
        border: `1px solid ${open ? "var(--border-strong)" : "var(--border)"}`,
        boxShadow: open ? "var(--shadow-card)" : "none",
        outline: open ? "2px solid var(--accent)" : "none", outlineOffset: 1,
      }}>
        <Search size={19} aria-hidden="true" style={{ flex: "none", color: "var(--text-muted)" }} />
        <input ref={input} type="text" inputMode="search" enterKeyHint="search" autoComplete="off" spellCheck={false}
          role="combobox" aria-label="Search mail" aria-expanded={offered.length > 0} aria-controls={offered.length > 0 ? "mail-search-people" : undefined} aria-autocomplete="list"
          aria-activedescendant={at >= 0 && offered[at] ? `mail-search-person-${at}` : undefined}
          placeholder="Search mail" value={q} onChange={e => { setQ(e.target.value); setAt(-1) }} onKeyDown={onKeyDown}
          // The bar wears the focus ring; the theme's own ring on a typing box would draw a second, square one inside it.
          style={{ flex: 1, minWidth: 0, height: 50, padding: "0 8px", border: "none", outline: "none", boxShadow: "none", background: "transparent", color: "var(--text)", fontSize: 16, fontFamily: "inherit" }} />
        {q && (
          <button type="button" aria-label="Clear search" title="Clear search" onClick={() => { setQ(""); setAt(-1); input.current?.focus() }} style={iconBtn}>
            <X size={19} aria-hidden="true" />
          </button>
        )}
        <button type="button" aria-label="What can I type here?" title="What can I type here?" aria-expanded={help} onClick={() => setHelp(v => !v)}
          style={{ ...iconBtn, color: help ? "var(--text)" : "var(--text-muted)", background: help ? "var(--surface-2)" : "transparent" }}>
          <SlidersHorizontal size={18} aria-hidden="true" />
        </button>
      </div>

      {offered.length > 0 && (
        <ul id="mail-search-people" role="listbox" aria-label="People" style={{
          position: "absolute", zIndex: 30, left: 0, right: 0, top: 58, margin: 0, padding: 6, listStyle: "none",
          background: "var(--surface)", border: "1px solid var(--border-strong)", borderRadius: 16, boxShadow: "var(--shadow-card-hover)",
        }}>
          {offered.map((p, i) => (
            <li key={p.email} id={`mail-search-person-${i}`} role="option" aria-selected={i === at}>
              <button type="button" tabIndex={-1} onClick={() => pick(p)} onMouseEnter={() => setAt(i)}
                style={{ width: "100%", display: "flex", alignItems: "baseline", gap: 10, minHeight: 44, padding: "0 12px", borderRadius: 10, border: "none", cursor: "pointer", textAlign: "left", background: i === at ? "var(--surface-2)" : "transparent", color: "var(--text)", fontFamily: "inherit" }}>
                <span style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: "nowrap" }}>From {p.name}</span>
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.email}</span>
                <span style={{ flex: "none", fontSize: 12.5, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{p.count} {p.count === 1 ? "conversation" : "conversations"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {(open || search.active) && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 10 }}>
          {QUICK.map(([label, word]) => {
            const on = parts.includes(word)
            return (
              <button key={word} type="button" aria-pressed={on} onClick={() => { setQ(toggleWord(q, word)); input.current?.focus() }}
                style={{ minHeight: 36, padding: "0 14px", borderRadius: 18, cursor: "pointer", fontSize: 13.5, fontWeight: on ? 600 : 500, fontFamily: "var(--font-label)", border: `1px solid ${on ? "var(--accent)" : "var(--border)"}`, background: on ? "var(--accent)" : "var(--surface)", color: on ? "var(--bg)" : "var(--text-muted)" }}>
                {label}
              </button>
            )
          })}
        </div>
      )}

      {help && (
        <div role="note" style={{ marginTop: 10, padding: "14px 16px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8 }}>What you can type</div>
          <dl style={{ margin: 0, display: "grid", gridTemplateColumns: "minmax(120px, auto) 1fr", gap: "6px 14px", fontSize: 13, lineHeight: 1.5 }}>
            {EXAMPLES.map(([example, means]) => (
              <div key={example} style={{ display: "contents" }}>
                <dt><button type="button" onClick={() => { setQ(example + " "); setHelp(false); input.current?.focus() }}
                  style={{ padding: "2px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "var(--surface-2)", color: "var(--text)", cursor: "pointer", fontFamily: "var(--font-mono, monospace)", fontSize: 12.5 }}>{example}</button></dt>
                <dd style={{ margin: 0, color: "var(--text-muted)" }}>{means}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  )
}

/** One line under the bar that says what the list is now: how many, how far the search looked, and what it left out. */
export function SearchSummary({ search, shown }: { search: MailSearch; shown: number }) {
  const n = search.deep ? Math.max(search.count, shown) : shown
  return (
    <div role="status" aria-live="polite" style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "baseline", marginBottom: 16 }}>
      {/* While the server is still looking and the lines on the page hold nothing, no number is said: "0 match" would
          be read out, and shown, about a search that has not been answered yet. */}
      {!(n === 0 && search.pending) && (
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>
          {n === 0 ? "Nothing matches" : `${n} ${n === 1 ? "conversation matches" : "conversations match"}`}
        </span>
      )}
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
        {search.pending
          ? "Looking inside every message…"
          : search.deep
            ? `Looked inside ${search.searched} ${search.searched === 1 ? "conversation" : "conversations"} from the last 90 days${search.count > shown && shown > 0 ? `; showing the newest ${shown}` : ""}.`
            : "Looked at names, subjects and first lines only."}
      </span>
      {search.unknown.length > 0 && (
        <span style={{ flexBasis: "100%", fontSize: 13, color: "var(--text-muted)" }}>
          Left out, because MarketFit does not keep it: {search.unknown.join(", ")}
        </span>
      )}
    </div>
  )
}
