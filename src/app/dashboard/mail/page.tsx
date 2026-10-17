"use client"
import TypingDots from "../_components/typing-dots"

import { useState, useEffect } from "react"
import Link from "next/link"
import { Check, Archive, RotateCcw, ChevronRight, Leaf, ArrowRight } from "lucide-react"
import { Meta, Chip, Btn, useAnswered, useLeaving } from "../_suite/ui"
import { navItem } from "../_components/nav"
import MailRow from "./_components/mail-row"
import FoldedConversation from "./_components/folded-conversation"
import ThreadActions, { useTrackedSenders } from "./_components/thread-actions"
import "./folds.css"
import InboxUpdates from "./_components/inbox-updates"
import MailSearchBar, { SearchSummary, useMailSearch } from "./_components/mail-search"
import { Papers, PersonHistory } from "./_components/papers"
import { DigestBriefing } from "./_components/digest"
import { useRecruiters } from "../_components/recruiter-button"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { type Mail } from "../_suite/sample"
import { useGmailData, buildAccounts, makeAcct } from "@/lib/use-gmail-data"

import IgnoreControls from "./_components/ignore-controls"
import { ignoreReason, type IgnoreRule } from "@/lib/gmail-ignore"

type AcctFn = (id: string) => { tint: string; email: string }

function JdFitPill({ score, why }: { score?: number; why?: string[] }) {
  if (score == null) return null
  const color = score >= 60 ? "var(--success)" : score >= 30 ? "var(--accent-txt)" : "var(--text-muted)"
  const bg = score >= 60 ? "var(--success-soft)" : score >= 30 ? "var(--accent-soft)" : "var(--surface-2)"
  return (
    <span title={why?.length ? `Matched: ${why.join(", ")}` : "Role fit"}
      style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999, background: bg, color }}>
      {score}% fit
    </span>
  )
}

// The row itself is _components/mail-row.tsx: one line each for who, what about, how it begins.
const rowProps = (m: Mail, acct: AcctFn) => { const a = acct(m.account); return { tint: a.tint, inbox: a.email.split("@")[0] || a.email } }

/* ── Role aggregation: Gmail's essence, organized ───────────────────────────
   One role = one card. Every vendor chain touching the same posting lives
   inside it, with rates side by side. This is where duplicate submissions
   get caught at a glance. */

interface RoleGroup {
  key: string
  label: string
  req: string | null
  mails: Mail[]
  vendors: string[]
  mine: string[]             // companies on his recruiter list: they work for him, they are not vendors to pick between
  rates: string[]
  fit: number | null
  unread: number
  latestAt: string
}

// Live inbox indicator: pulsing dot + how long ago the 2-minute pulse last checked.
// This is the "lively inbox" — the user sees the inbox is being watched, not stale.
function LiveIndicator({ updatedAt, connected }: { updatedAt: number | null; connected: boolean }) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 20000)
    return () => clearInterval(id)
  }, [])
  if (!connected || !updatedAt) return null
  const secs = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000))
  const label = secs < 45 ? "just now" : secs < 105 ? "1 min ago" : `${Math.floor(secs / 60)} min ago`
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", fontSize: 12.5, fontWeight: 600,
        color: "var(--text-muted)", border: "1px solid var(--border)", borderRadius: 999,
        padding: "3px 11px", marginLeft: 10, verticalAlign: "middle", whiteSpace: "nowrap",
      }}
      role="status"
      aria-label={`Inbox is live, last checked ${label}`}
      title="The inbox re-checks itself every 2 minutes"
    >
      <span className="mf-live-dot" aria-hidden="true" />
      Live · {label}
    </span>
  )
}

function domainOf(email: string): string {
  const m = (email || "").match(/@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/)
  return m ? m[1].toLowerCase() : (email || "").toLowerCase()
}

function roleKeyFor(m: Mail): string {
  const hay = `${m.subject} ${m.role}`
  const req = hay.match(/(?:req|posting|position|job)[\s#:]*(\d{4,7})/i)
  if (req) return `req:${req[1]}`
  const t = (m.role || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ")
  return `role:${t.slice(0, 50) || m.company.toLowerCase().slice(0, 40)}`
}

function groupByRole(mails: Mail[], isRecruiterDomain: (domain: string) => boolean = () => false): RoleGroup[] {
  const map = new Map<string, Mail[]>()
  for (const m of mails) {
    const k = roleKeyFor(m)
    if (!map.get(k)) map.set(k, [])
    map.get(k)!.push(m)
  }
  const groups: RoleGroup[] = []
  for (const [key, ms] of map) {
    const req = key.startsWith("req:") ? key.slice(4) : null
    // "2 vendors: pick one" was said of the two firms that market his own profile (his picture, 13 Oct 2026). A company
    // on his recruiter list is not a vendor competing for the same job: it is left out of that count and named apart.
    const everyone = [...new Set(ms.map(m => domainOf(m.fromEmail)).filter(Boolean))]
    const vendors = everyone.filter(v => !isRecruiterDomain(v))
    const mine = everyone.filter(v => isRecruiterDomain(v))
    const rates = [...new Set(ms.map(m => m.rate).filter(Boolean) as string[])]
    const fits = ms.map(m => m.jdFit).filter((f): f is number => f != null)
    const label = req
      ? (ms.find(m => m.role)?.role || ms[0].subject.slice(0, 50))
      : (ms.find(m => m.role)?.role || ms[0].company)
    groups.push({
      key, label, req, mails: ms, vendors, mine, rates,
      fit: fits.length ? Math.max(...fits) : null,
      unread: ms.filter(m => m.unread).length,
      latestAt: ms[0].at,
    })
  }
  // Most chains first, then most mail
  groups.sort((a, b) => b.vendors.length - a.vendors.length || b.mails.length - a.mails.length)
  return groups
}

function RoleCard({ group, onOpen, acct }: { group: RoleGroup; onOpen: (id: string) => void; acct: AcctFn }) {
  const [open, setOpen] = useState(false)
  const multi = group.vendors.length > 1
  return (
    <article style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18,
      boxShadow: "var(--shadow-card)", overflow: "hidden",
    }}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", padding: "18px 20px" }}>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16, letterSpacing: "-0.015em" }}>{group.label}</h3>
              {group.req && (
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", background: "var(--surface-2)", border: "1px solid var(--border)", padding: "3px 8px", borderRadius: 999 }}>
                  req {group.req}
                </span>
              )}
              {multi && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--danger)", background: "var(--surface-2)", border: "1px solid var(--danger-border)", padding: "3px 8px", borderRadius: 999 }}>
                  {group.vendors.length} vendors — pick one
                </span>
              )}
              {group.unread > 0 && (
                <span style={{ fontSize: 11, fontWeight: 800, color: "var(--accent-txt)", background: "var(--accent-soft)", border: "1px solid var(--accent-border)", padding: "3px 8px", borderRadius: 999 }}>
                  {group.unread} new
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
              {group.mine.map(v => <span key={v} style={{ fontSize: 12.5, color: "var(--text-muted)" }}>Your recruiter: <strong style={{ color: "var(--text)", fontWeight: 650 }}>{v}</strong></span>)}
              {group.vendors.map(v => {
                const vm = group.mails.find(m => domainOf(m.fromEmail) === v)
                return (
                  <span key={v} style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
                    <strong style={{ color: "var(--text)", fontWeight: 650 }}>{v}</strong>
                    {vm?.rate ? ` · ${vm.rate}` : ""}
                  </span>
                )
              })}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flex: "none" }}>
            {group.fit != null && <JdFitPill score={group.fit} />}
            <span style={{ fontSize: 11.5, color: "var(--text-soft)" }}>{group.mails.length} email{group.mails.length === 1 ? "" : "s"}</span>
            <ChevronRight size={16} style={{ transform: open ? "rotate(90deg)" : "none", transition: "transform .2s", color: "var(--text-muted)" }} />
          </div>
        </div>
      </button>
      {open && (
        <div style={{ borderTop: "1px solid var(--border)", padding: "8px 12px 12px" }}>
          {group.mails.map(m => (
            <MailRow key={m.id} m={m} on={false} restored={false} leaving={false}
              onClick={() => onOpen(m.id)} {...rowProps(m, acct)} />
          ))}
        </div>
      )}
    </article>
  )
}

type View = "needs" | "theirs" | "roles" | "all" | "drafts" | "waiting" | "papers"

export default function MailPage() {
  const [ignoreRules, setIgnoreRules] = useState<IgnoreRule[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [showIgnored, setShowIgnored] = useState(false)
  const [tidying, setTidying] = useState(false)   // the tick boxes and the ignore controls, shown only while tidying
  const [more, setMore] = useState(false)         // By role, Drafts and No answer yet: the three views behind "More"
  const [ignoreError, setIgnoreError] = useState("")
  useEffect(() => {
    let active = true
    fetch("/api/gmail/ignore-rules").then(r => r.json()).then(j => { if (!active) return; if (j.ok) setIgnoreRules(j.rules); else setIgnoreError(j.error) }).catch(() => { if (active) setIgnoreError("Ignore preferences could not be loaded") })
    return () => { active = false }
  }, [])
  async function saveIgnoreRules(rules: IgnoreRule[]) {
    const res = await fetch("/api/gmail/ignore-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules }) })
    const data = await res.json()
    if (!res.ok || !data.ok) throw new Error(data.error || "Could not save")
    setIgnoreRules(data.rules); setSelected([])
  }
  const tracked = useTrackedSenders()
  const [account, setAccount] = useState("all")
  const [view, setView] = useState<View>("needs")
  const [sel, setSel] = useState<string | null>(null)
  const [selectedInbox, setSelectedInbox] = useState("")
  const [showFiled, setShowFiled] = useState(false)
  const [restored, setRestored] = useState<string[]>([])
  const [answered, answer] = useAnswered()
  const [leaving, leave] = useLeaving(answer)

  // ── Live Gmail data ────────────────────────────────────────────────────
  const { mails, loading, connected, error, refresh, drafts, radar, updatedAt } = useGmailData()
  const [connectedEmails, setConnectedEmails] = useState<string[]>([])
  useEffect(() => {let active=true;fetch('/api/gmail-sync').then(r=>r.json()).then(j=>{if(active)setConnectedEmails((j.accounts||[]).filter((a:{gmail_enabled:boolean})=>a.gmail_enabled).map((a:{google_email:string})=>a.google_email))}).catch(()=>{});return()=>{active=false}},[])
  const accounts = buildAccounts([...connectedEmails,...mails.map(m => m.account)])
  const acct = makeAcct(accounts)

  // Whose turn it is, by what the server found: an ask they made after you last wrote (yourTurn). On the owner's own
  // mail, 12 Oct 2026, the old rule (any thread that ever held an ask) listed 39 as needing him; the last word was his in
  // 30. A mail kept from before the field existed falls back to the old rule until the next refresh.
  const waiting = (x: Mail) => (x.yourTurn ?? !!x.needsReply) && !answered.includes(x.id)
  const live = mails.filter(x => (!!ignoreReason(x, ignoreRules) === showIgnored) && (x.stage !== "rejected" || restored.includes(x.id)) && (account === "all" || x.account === account))
  const needsList = live.filter(waiting)
  const theirsList = live.filter(x => !!x.lastMine && !waiting(x))
  const filed = mails.filter(x => x.stage === "rejected" && !restored.includes(x.id))
  const recruiterRules = useRecruiters()
  const isRecruiterDomain = (domain: string) => isMyRecruiter(recruiterRules, `someone@${domain}`)
  const roles = groupByRole(live.filter(x => x.stage !== "rejected"), isRecruiterDomain)
  const [papersCount, setPapersCount] = useState(0)
  // The number on "RTR and rate" is known before the filter is opened (it read 0 until then: seen on the live page).
  useEffect(() => {
    let on = true
    fetch(`/api/gmail/papers${account === "all" ? "" : `?account=${encodeURIComponent(account)}`}`, { cache: "no-store" }).then(r => r.json())
      .then(j => { if (on && j?.ok && Array.isArray(j.papers)) setPapersCount(j.papers.length) }).catch(() => { /* the filter shows its own count when opened */ })
    return () => { on = false }
  }, [account])

  // A search looks through everything kept, whichever pile is open, hidden senders and filed rejections included: it is
  // how something is found again, as in Gmail. Only the inbox chosen above still narrows it.
  // The inbox is sent with the search, so the number the server gives and the rows it lists are of that inbox.
  const search = useMailSearch(mails, account === "all" ? "" : account)
  const found = search.active ? search.results.filter(x => account === "all" || x.account === account) : null
  const shown = found ?? (showIgnored ? live : view === "needs" ? needsList : view === "theirs" ? theirsList : live)
  // `opened` is a conversation asked for by its address (?open=, from the Follow-ups page). It is shown even when the
  // list does not hold it, because it was filed as a rejection or its sender is hidden: the person asked for that one.
  const [opened, setOpened] = useState<string | null>(null)
  // And one the page does not hold at all (it holds the last 30 days; Overview points at conversations up to 90 days
  // old) is fetched by itself from the kept mail.
  const [fetched, setFetched] = useState<Mail | null>(null)
  const [openNote, setOpenNote] = useState("")
  const selectedMail = (x: Mail) => x.id === sel && (!selectedInbox || x.account === selectedInbox)
  const m = shown.find(selectedMail) ?? (sel && sel === opened ? mails.find(selectedMail) ?? (fetched && selectedMail(fetched) ? fetched : undefined) : undefined)

  // Three piles a person can hold in their head. The other three ways of looking wait behind "More".
  const VIEWS: [View, string, number][] = [
    ["needs", "Your turn", needsList.length],
    ["theirs", "Their turn", theirsList.length],
    ["all", "Everything", live.length],
  ]
  const MORE: [View, string, number][] = [
    ["papers", "RTR and rate", papersCount],
    ["roles", "By role", roles.length],
    ["drafts", "Drafts", drafts.length],
    ["waiting", "No answer yet", radar.length],
  ]

  // "Open" on the Follow-ups page lands here with ?open=<conversation>: that conversation is the one shown, and it is
  // brought into view (on a narrow window the reading card sits under the whole list). A conversation this page does
  // not have at all is left alone, so the wrong one is never opened in its place.
  const [wanted, setWanted] = useState<string | null>(null)
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const id = query.get("open")
    const inbox = query.get("account")
    if (inbox) queueMicrotask(() => {setAccount(inbox);setSelectedInbox(inbox)})
    if (id) queueMicrotask(() => setWanted(id))
  }, [])
  const wantedIsHere = !!wanted && mails.some(x => x.id === wanted && (!selectedInbox || x.account === selectedInbox))
  useEffect(() => {
    if (!wanted || !wantedIsHere) return
    queueMicrotask(() => {
      setSel(wanted); setOpened(wanted); setView("all"); setWanted(null)
      setTimeout(() => document.getElementById("reply")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120)
    })
  }, [wanted, wantedIsHere])
  // Asked for, and not among the 30 days this page holds: it is read by itself from the kept mail. If it is not kept
  // either, that is said in one line. The first conversation in the list is never shown as if it were the one asked for.
  useEffect(() => {
    if (!wanted || wantedIsHere || loading || !connected) return
    let active = true
    fetch(`/api/gmail/conversation?id=${encodeURIComponent(wanted)}&account=${encodeURIComponent(selectedInbox)}`)
      .then(r => r.json())
      .then((j: { ok?: boolean; mail?: Mail }) => {
        if (!active) return
        if (j?.ok && j.mail) {
          setFetched(j.mail); setSel(wanted); setOpened(wanted); setView("all")
          setTimeout(() => document.getElementById("reply")?.scrollIntoView({ behavior: "smooth", block: "start" }), 120)
        } else setOpenNote("The conversation you asked for is not among the mail MarketFit keeps (the last 90 days). The list below is your inbox as usual.")
        setWanted(null)
      })
      .catch(() => { if (active) { setOpenNote("The conversation you asked for could not be opened just now. The list below is your inbox as usual."); setWanted(null) } })
    return () => { active = false }
  }, [wanted, wantedIsHere, loading, connected, selectedInbox])

  const approve = (id: string) => {
    const nextUp = shown.find(x => x.id !== id && !leaving.includes(x.id) && waiting(x))
    if (nextUp) {setSel(nextUp.id);setSelectedInbox(nextUp.account)}
    leave(id)
  }

  const openMail = (id: string) => {
    setSel(id)
    setView("all")
    setTimeout(() => document.getElementById("reply")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
  }

  const needsCount = needsList.length

  return (
    <div className="mf-home" style={{ paddingBottom: 56 }}>
      <header className="mf-home-heading">
        <h1>{navItem("/dashboard/mail").label}<LiveIndicator updatedAt={updatedAt} connected={connected} /></h1>
        <p>
          {!connected
            ? "Connect Gmail and your recruiter emails land here — grouped by role, fit-scored, with drafts and follow-ups in view."
            : loading
              ? "Reading your inboxes…"
              : needsCount === 0
                ? `Nobody is waiting on you.${theirsList.length ? ` ${theirsList.length} ${theirsList.length === 1 ? "person owes" : "people owe"} you an answer.` : ""}`
                : `${needsCount} ${needsCount === 1 ? "person is" : "people are"} waiting on you.${theirsList.length ? ` ${theirsList.length} ${theirsList.length === 1 ? "owes" : "owe"} you an answer.` : ""}`}
        </p>
      </header>

      {!loading && connected && (
        <DigestBriefing needs={needsList} theirs={theirsList} mails={live} radar={radar} onOpen={openMail} />
      )}

      <InboxUpdates />

      {error && !loading && (
        <div className="mf-notice" role="status">
          <p>{error}</p>
          <button className="btn-outline" onClick={refresh}>Refresh</button>
          <Link href="/dashboard/connections">Check connections →</Link>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px 24px", color: "var(--text-muted)", fontSize: 14 }}>
          <TypingDots label="Reading your inboxes…" />
        </div>
      ) : !connected ? (
        <section style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 18, padding: 32, textAlign: "center", boxShadow: "var(--shadow-card)" }}>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, letterSpacing: "-0.02em" }}>Connect Gmail to fill this up</h2>
          <p style={{ color: "var(--text-muted)", fontSize: 14.5, maxWidth: 480, margin: "0 auto 20px", lineHeight: 1.65 }}>
            Your emails group themselves by role here — every vendor chain side by side, fit-scored, with reply drafts one tap away.
          </p>
          <Link href="/dashboard/connections" className="btn-accent" style={{ minHeight: 46, padding: "0 26px", borderRadius: 999, display: "inline-flex", alignItems: "center", textDecoration: "none", fontWeight: 700 }}>
            Connect Gmail <ArrowRight size={16} style={{ marginLeft: 8 }} />
          </Link>
        </section>
      ) : (
        <>
          {openNote && <p role="status" style={{ margin: "0 0 14px", padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", fontSize: 14, lineHeight: 1.5 }}>{openNote}</p>}
          <MailSearchBar search={search} />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            <Chip label="All inboxes" active={account === "all"} onClick={() => setAccount("all")} />
            {accounts.map(a => (
              <Chip key={a.id} active={account === a.id} disabled={!a.connected} onClick={() => setAccount(a.id)}
                label={<><span style={{ width: 8, height: 8, borderRadius: 10, background: a.tint }} />{a.email.split("@")[0]}{(!a.connected || (a.label && a.label !== a.email.split("@")[0])) && <span style={{ opacity: 0.6, fontWeight: 500 }}>{a.connected ? a.label : "Not connected"}</span>}</>} />
            ))}
          </div>
          {/* While something is searched for, the piles step aside for one line saying what the list now is. */}
          {search.active && <SearchSummary search={search} shown={shown.length} />}
          {/* A name that was searched for: the whole history with that person, above what matched. */}
          {search.active && <PersonHistory q={search.q} />}
          <div style={{ display: search.active ? "none" : "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: tidying || showIgnored ? 10 : 20 }}>
            {VIEWS.map(([v, label, n]) => (
              <Chip key={v} label={label} active={view === v} onClick={() => setView(v)} count={n} />
            ))}
            {(more || MORE.some(([v]) => v === view)) && MORE.map(([v, label, n]) => (
              <Chip key={v} label={label} active={view === v} onClick={() => setView(v)} count={n} />
            ))}
            {!MORE.some(([v]) => v === view) && (
              <button type="button" className="btn-ghost" aria-expanded={more} onClick={() => setMore(v => !v)} style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}>
                {more ? "Less" : "More"}
              </button>
            )}
            {/* Hiding senders is a chore, not the page. It waits behind one quiet button, and so do the tick boxes. */}
            <button type="button" className="btn-ghost" aria-expanded={tidying || showIgnored} onClick={() => { if (tidying || showIgnored) { setTidying(false); setShowIgnored(false); setSelected([]) } else { setTidying(true); if (view !== "needs" && view !== "theirs" && view !== "all") setView("all") } }}
              style={{ marginLeft: "auto", minHeight: 40, padding: "0 14px", fontSize: 14 }}>
              {tidying || showIgnored ? "Done tidying" : "Tidy up"}
            </button>
          </div>
          {/* The tidy tools step aside while something is searched for. They work on the pile's own list: a search result
              from before the last 30 days is not in it (ticking one hid nothing), and a result that is not hidden got a
              "Bring it back" button. Clearing the search brings them back as they were. */}
          {(tidying || showIgnored) && !search.active && (
            <>
              <IgnoreControls mails={mails} selected={selected} rules={ignoreRules} onSave={saveIgnoreRules} showIgnored={showIgnored} onToggle={() => { setShowIgnored(v => !v); setView("all") }} />
              {ignoreError && <p role="status" style={{ fontSize: 13, color: "var(--danger)", margin: "0 0 12px" }}>{ignoreError}</p>}
            </>
          )}

          {!search.active && view === "papers" ? (
            <Papers account={account === "all" ? "" : account} onCount={setPapersCount} />
          ) : !search.active && view === "roles" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {roles.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                  No roles found in the last 30 days.
                </div>
              )}
              {roles.map(g => <RoleCard key={g.key} group={g} onOpen={openMail} acct={acct} />)}
            </div>
          ) : !search.active && view === "drafts" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {drafts.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                  No unsent drafts. Replies you start in the inbox land here.
                </div>
              )}
              {drafts.map(d => (
                <div key={d.id} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--shadow-card)" }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700 }}>{d.subject}</div>
                  <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                    to {(d.to || "").split("<")[0].trim() || "—"} · {d.snippet.slice(0, 100)}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-soft)", marginTop: 8 }}>Open Gmail drafts to review and send — nothing sends from here on its own.</div>
                </div>
              ))}
            </div>
          ) : !search.active && view === "waiting" ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {radar.length === 0 && (
                <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                  Nobody owes you a reply.
                </div>
              )}
              {radar.map(r => (
                <div key={r.threadId} style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 20px", boxShadow: "var(--shadow-card)", display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 800, whiteSpace: "nowrap", color: r.daysWaiting >= 10 ? "var(--danger)" : "var(--accent-txt)", minWidth: 54 }}>
                    {r.daysWaiting}d
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{r.subject}</div>
                    <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 4 }}>
                      {(r.vendor || r.to || "").split("<")[0].trim().slice(0, 40)}{r.jobTitle ? ` · ${r.jobTitle}` : ""}
                    </div>
                  </div>
                  <button className="btn-outline" style={{ minHeight: 38, flex: "none" }} onClick={() => openMail(r.threadId)}>Open</button>
                </div>
              ))}
            </div>
          ) : (
            <div className="mf-mail-folds">
              <div className="mf-mail-fold mf-mail-list">
                {shown.map(x => (
                  <div key={`${x.account}:${x.id}`} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    {(tidying || showIgnored) && !search.active && (
                      <input type="checkbox" aria-label={`Select ${x.subject}`} checked={selected.includes(`${x.account}:${x.id}`)} onChange={e => setSelected(ids => e.target.checked ? [...ids, `${x.account}:${x.id}`] : ids.filter(id => id !== `${x.account}:${x.id}`))}
                        style={{ width: 18, height: 18, marginTop: 22, flex: "none", accentColor: "var(--accent)" }} />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}><MailRow m={x} on={x.id === m?.id && x.account === m?.account} restored={restored.includes(x.id)} leaving={leaving.includes(x.id)} onClick={() => {setSel(x.id);setSelectedInbox(x.account)}} {...rowProps(x, acct)} found={search.active ? search.hits[`${x.account}:${x.id}`] : undefined} />
                    {showIgnored && !search.active && (
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", margin: "-2px 0 10px 4px", fontSize: 12.5, color: "var(--text-muted)" }}>
                        <span>{ignoreReason(x, ignoreRules)}</span>
                        <button type="button" className="btn-ghost" style={{ minHeight: 32, padding: "0 10px", fontSize: 13 }} onClick={() => saveIgnoreRules([...ignoreRules.filter(r => !(r.account === x.account && r.kind === "thread" && r.value === x.id)), { account: x.account.toLowerCase(), kind: "thread", value: x.id, action: "allow" }]).catch(e => setIgnoreError(String(e)))}>Bring it back</button>
                      </div>
                    )}</div>
                    <ThreadActions mail={x} rules={tracked}/>
                  </div>
                ))}
                {!shown.length && (
                  <div style={{ padding: 32, textAlign: "center", border: "1px dashed var(--border-strong)", borderRadius: 14, color: "var(--text-muted)", fontSize: 13.5 }}>
                    <Leaf size={18} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 6 }}>
                      {search.active ? (search.pending ? "Looking inside every message…" : "Nothing matches") : view === "needs" ? "Nobody is waiting on you" : view === "theirs" ? "Nobody owes you an answer" : "Nothing here"}
                    </div>
                    {search.active ? (search.pending ? "" : "Try fewer words, or just part of a name.") : view === "needs" ? "Every thread is answered or scheduled." : live.length === 0 ? (
                      <span>No job emails in the last 30 days on the connected account{accounts.length > 1 ? "s" : ""}. <Link href="/dashboard/connections" style={{ fontWeight: 700, color: "var(--text)" }}>Connect your main inbox →</Link></span>
                    ) : "Try another view."}
                  </div>
                )}

                <div style={{ marginTop: 8, borderRadius: 10, background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                  <button type="button" onClick={() => setShowFiled(!showFiled)} aria-expanded={showFiled}
                    style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: 12, background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}>
                    <Archive size={16} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 650 }}>{filed.length ? `${filed.length} rejection${filed.length === 1 ? "" : "s"} filed automatically` : "No rejections filed"}</div>
                      {filed.length > 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>{filed.map(a => a.company).join(", ")} — moved to Rejected in the tracker</div>}
                    </div>
                    <ChevronRight size={16} style={{ transform: showFiled ? "rotate(90deg)" : "none", transition: "transform .2s" }} />
                  </button>
                  {showFiled && (
                    <div style={{ padding: "0 12px 12px", display: "flex", flexDirection: "column", gap: 12 }}>
                      {filed.map(a => (
                        <div key={a.id}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 600 }}>{a.company} · {a.role}</span>
                            <Btn variant="ghost" onClick={() => setRestored(xs => [...xs, a.id])}><RotateCcw size={13} /> Restore</Btn>
                          </div>
                          <blockquote style={{ margin: "4px 0 0", padding: "6px 10px", borderLeft: "2px solid var(--border-strong)", fontSize: 12.5, fontStyle: "italic", color: "var(--text-muted)" }}>
                            “{a.trigger ?? a.preview}”
                            <div style={{ fontStyle: "normal", fontSize: 11.5, color: "var(--text-soft)", marginTop: 2 }}>Filed because this line matched · {a.fromEmail} · {a.at}</div>
                          </blockquote>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {m && <FoldedConversation key={`${m.account}:${m.id}`} mail={m} tint={acct(m.account).tint} restored={restored.includes(m.id)} onSent={()=>approve(m.id)} />}

            </div>
          )}
        </>
      )}
    </div>
  )
}
