"use client"
import { useCallback, useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react"
import Link from "next/link"
import { Card } from "../../_suite/ui"
import TypingDots from "../../_components/typing-dots"
import { jewel } from "@/lib/jewel"
import { STAGE_WORDS, type Standing, type Person, type Overview, type Group } from "@/lib/mail-overview"
import type { RecruiterRule } from "@/lib/my-recruiters"
import RecruiterButton, { changeRecruiter } from "../../_components/recruiter-button"

// "What matters now", at the top of Overview. The owner, 13 Oct 2026: "I don't think the dots are connected well in the
// overview even now, the contact info about everyone and ignore list ... use intelligence to throw for user what's
// important and not ... more ease and highlights suggestions."
// One section that connects them (GET /api/gmail/overview):
//   - the few conversations that matter most right now, each with one sentence saying what to do and why it is on top;
//   - every started application under whose turn it is: needs you, gone quiet, moving;
//   - a contact box for everyone who wrote, the people being worked with first;
//   - who is not worth the time (they keep writing and were never answered), with one press to hide them, and the list
//     of who is hidden already, with one press to bring them back.
// Every sentence comes from the mail. Nothing here sends anything: "Open and nudge" opens the conversation in the inbox.

type Shown = Person & { hidden?: boolean }
type Listed = Standing & { nudgeReady?: boolean }
interface Answer extends Omit<Overview, "highlights" | "needsYou" | "goneQuiet" | "moving"> {
  ok: boolean; kept: boolean; error?: string; nudgeKept: boolean
  highlights: Listed[]; needsYou: Listed[]; goneQuiet: Listed[]; moving: Listed[]
  people: Shown[]
  suggestHide: Array<{ name: string; email: string; account: string; count: number }>
  hidden: Array<{ account: string; kind: "sender" | "domain"; value: string }>
  recruiters?: RecruiterRule[]
}
interface Rule { account: string; kind: "sender" | "domain" | "thread"; value: string; action?: "ignore" | "allow" }

const GROUPS: Array<[Group, string]> = [["needs_you", "Needs you"], ["gone_quiet", "Gone quiet"], ["moving", "Moving along"]]
const FIRST = 4          // conversations shown in a group before "Show all"
const FIRST_PEOPLE = 6
const MORE_PEOPLE = 30     // and this many more with each press, until everyone is shown
const day = (at: number) => (at ? new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "")
const digits = (phone: string) => phone.replace(/ext\..*$/i, "").replace(/\D/g, "")
const oneLine: CSSProperties = { overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }
const pill: CSSProperties = { display: "inline-flex", alignItems: "center", minHeight: 36, padding: "0 12px", borderRadius: 18, fontSize: 13.5, fontWeight: 600, textDecoration: "none", border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)" }
const mailHref = (email: string) => { const at = email.lastIndexOf("@"); return at < 1 ? "#" : `mailto:${encodeURIComponent(email.slice(0, at))}@${encodeURIComponent(email.slice(at + 1))}` }
const openHref = (threadId: string) => `/dashboard/mail?open=${encodeURIComponent(threadId)}`

function Tile({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ ...jewel(name), width: size, height: size, flex: "none", borderRadius: size / 3, display: "grid", placeItems: "center", fontWeight: 800, fontSize: size * 0.4 }}>
      {(name.trim()[0] || "?").toUpperCase()}
    </span>
  )
}

/** Who someone is and how to reach them: the address and the numbers they themselves wrote, one press each. */
function ContactBox({ name, email, company, phones, children }: { name: string; email: string; company: string; phones: string[]; children?: ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", padding: "10px 12px", borderRadius: 12, background: "var(--surface-2)" }}>
      <Tile name={name || email} />
      <div style={{ flex: "1 1 160px", minWidth: 0 }}>
        <div style={{ ...oneLine, fontSize: 14.5, fontWeight: 650 }}>{name || email}</div>
        <div style={{ ...oneLine, fontSize: 12.5, color: "var(--text-muted)" }}>{company ? `${company} · ` : ""}{email}</div>
      </div>
      <a href={mailHref(email)} style={pill}>Email</a>
      {phones.slice(0, 1).map(p => <a key={p} href={`tel:${digits(p)}`} style={pill}>Call {p}</a>)}
      {children}
    </div>
  )
}

function Stage({ s }: { s: Standing }) {
  const hot = s.group === "needs_you"
  return (
    // Ink on the page's own surface, with the one warm colour as its edge when it waits on him. Lettering on the accent
    // fill measured 4.0 to 1 at night at this size: too faint for 12px.
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, minHeight: 24, padding: "0 10px", borderRadius: 12, fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
      background: "var(--surface-2)", color: hot ? "var(--text)" : "var(--text-muted)", border: `1px solid ${hot ? "var(--spot)" : "var(--border)"}` }}>
      {STAGE_WORDS[s.stage]}
    </span>
  )
}

function Conversation({ s, top, nudgeKept, onChanged }: { s: Listed; top?: boolean; nudgeKept: boolean; onChanged: () => void }) {
  const label = s.action === "reply" ? "Open and reply" : s.action === "nudge" ? "Open and nudge" : "Open"
  return (
    <Card style={top ? { borderLeft: "4px solid var(--spot)" } : undefined}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
        <Stage s={s} />
        <span style={{ ...oneLine, flex: 1, minWidth: 0, fontSize: 13.5, color: "var(--text-muted)" }}>{s.about}</span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{day(s.lastAt)}</span>
      </div>
      <div style={{ fontSize: top ? 17 : 15.5, fontWeight: 650, lineHeight: 1.45, margin: "10px 0 4px" }}>{s.doNext}</div>
      {top && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>On top because: {s.why.join(" · ").toLowerCase()}</div>}
      {/* Said only where it is true: his kept nudge is offered when the last word is his and the silence is long enough. */}
      {s.nudgeReady && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>Your usual nudge will be the first choice when you press Reply.</div>}
      {!nudgeKept && s.action === "nudge" && s.lastMine && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>Keep your usual nudge on Follow-ups and it will be written for you here.</div>}
      {/* One of his recruiters is in this conversation: said, so it is clear why nobody is to be chased. */}
      {s.through && <div style={{ fontSize: 12.5, color: "var(--text-muted)", marginBottom: 6 }}>Through your recruiter {s.through.name || s.through.email}.{s.introduced ? ` ${s.contact.name || s.contact.email} has not written yet.` : ""}</div>}
      <div style={{ margin: "10px 0 12px" }}><ContactBox {...s.contact}><RecruiterButton email={s.contact.email} name={s.contact.name} onChanged={onChanged} /></ContactBox></div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Link href={openHref(s.threadId)} className={s.action === "none" ? "btn-outline" : "btn-accent"} style={{ minHeight: 44, padding: "0 18px", fontSize: 15, display: "inline-flex", alignItems: "center", textDecoration: "none" }}>{label}</Link>
        {s.others > 0 && <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>and {s.others} more {s.others === 1 ? "person" : "people"} in this conversation</span>}
      </div>
    </Card>
  )
}

export default function StandingSection({ account = "" }: { account?: string }) {
  const [data, setData] = useState<Answer | null>(null)
  const [error, setError] = useState("")
  const [group, setGroup] = useState<Group | null>(null)
  const [all, setAll] = useState(false)
  const [find, setFind] = useState("")
  const [morePeople, setMorePeople] = useState(0)   // how many more people than the first few are shown
  const [showHidden, setShowHidden] = useState(false)
  const [busy, setBusy] = useState("")

  const load = useCallback(() => {
    fetch(`/api/gmail/overview${account ? `?account=${encodeURIComponent(account)}` : ""}`, { cache: "no-store" })
      .then(r => r.json())
      .then((j: Answer) => { if (j?.ok) { setData(j); setError("") } else setError(j?.error || "Your mail could not be looked through just now.") })
      .catch(() => setError("Your mail could not be looked through just now."))
  }, [account])
  useEffect(() => { load() }, [load])

  // Hiding and showing again are the inbox's own ignore rules: read the list as it is now, change one entry, save it.
  const setRule = async (key: string, change: (rules: Rule[]) => Rule[]) => {
    if (busy) return
    setBusy(key)
    try {
      const now = await fetch("/api/gmail/ignore-rules").then(r => r.json())
      if (!now?.ok) throw new Error(now?.error || "Your hidden list could not be read.")
      const res = await fetch("/api/gmail/ignore-rules", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rules: change(now.rules || []) }) })
      const saved = await res.json().catch(() => ({}))
      if (!res.ok || !saved.ok) throw new Error(saved.error || "That could not be saved.")
      setError("")
      load()
    } catch (e) { setError(e instanceof Error ? e.message : "That could not be saved.") } finally { setBusy("") }
  }
  const hide = (who: { account: string; email: string }) => setRule(`hide:${who.email}`, rules => [...rules.filter(r => !(r.account === who.account && r.kind === "sender" && r.value === who.email)), { account: who.account, kind: "sender", value: who.email }])
  const showAgain = (rule: { account: string; kind: string; value: string }) => setRule(`show:${rule.value}`, rules => rules.filter(r => !(r.account === rule.account && r.kind === rule.kind && r.value === rule.value && r.action !== "allow")))

  const people = useMemo(() => {
    const q = find.trim().toLowerCase()
    const list = (data?.people || []).filter(p => !p.hidden)
    return q ? list.filter(p => `${p.name} ${p.email} ${p.company} ${p.about || ""}`.toLowerCase().includes(q)) : list
  }, [data, find])

  if (error && !data) return <p role="status" style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 20px" }}>{error}</p>
  if (!data) return <div style={{ padding: "18px 0 24px" }}><TypingDots label="Working out what matters now…" /></div>
  if (!data.looked.conversations) return null

  const lists: Record<Group, Listed[]> = { needs_you: data.needsYou, gone_quiet: data.goneQuiet, moving: data.moving }
  const open: Group = group ?? (data.needsYou.length ? "needs_you" : data.goneQuiet.length ? "gone_quiet" : "moving")
  const onTop = new Set(data.highlights.map(s => `${s.account}:${s.threadId}`))
  const rest = lists[open].filter(s => !onTop.has(`${s.account}:${s.threadId}`))
  const started = data.needsYou.length + data.goneQuiet.length + data.moving.length
  const shownPeople = FIRST_PEOPLE + morePeople
  const tag = (p: Shown) => p.recruiter ? "Your recruiter: nothing to chase" : p.via && !p.conversations ? `Your recruiter ${p.via} wrote to them. Let them reach out.` : p.working && p.stage ? `${STAGE_WORDS[p.stage]}${p.about ? ` · ${p.about}` : ""}` : p.answered ? "You have written to them" : p.conversations >= 3 ? `Wrote ${p.conversations} times, never answered` : "Wrote to you"

  return (
    <section aria-labelledby="standing-heading" style={{ marginBottom: 32 }}>
      <h2 id="standing-heading" style={{ margin: "0 0 6px", fontSize: 24, letterSpacing: "-0.02em" }}>What matters now</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14.5, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 760 }}>
        {started === 0
          ? `Nothing has started yet. MarketFit read ${data.looked.conversations} ${data.looked.conversations === 1 ? "conversation" : "conversations"}.`
          : `${started} ${started === 1 ? "application has" : "applications have"} started. ${data.needsYou.length} ${data.needsYou.length === 1 ? "needs" : "need"} you, ${data.goneQuiet.length} ${data.goneQuiet.length === 1 ? "has" : "have"} gone quiet, ${data.moving.length} ${data.moving.length === 1 ? "is" : "are"} moving along.`}
      </p>
      {error && <p role="alert" style={{ fontSize: 13.5, color: "var(--danger)", margin: "0 0 12px" }}>{error}</p>}

      {data.highlights.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
          {data.highlights.map(s => <Conversation key={`${s.account}:${s.threadId}`} s={s} top nudgeKept={data.nudgeKept} onChanged={load} />)}
        </div>
      )}

      {started > 0 && (
        <>
          <div role="group" aria-label="Started applications, by whose turn it is" style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {GROUPS.map(([g, label]) => (
              <button key={g} type="button" aria-pressed={open === g} onClick={() => { setGroup(g); setAll(false) }}
                style={{ minHeight: 40, padding: "0 16px", borderRadius: 20, cursor: "pointer", fontSize: 14.5, fontWeight: open === g ? 600 : 500, fontFamily: "var(--font-label)",
                  border: `1px solid ${open === g ? "var(--accent)" : "var(--border)"}`, background: open === g ? "var(--accent)" : "var(--surface)", color: open === g ? "var(--bg)" : "var(--text-muted)" }}>
                {label} <span style={{ opacity: 0.75, fontVariantNumeric: "tabular-nums", marginLeft: 4 }}>{lists[g].length}</span>
              </button>
            ))}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(all ? rest : rest.slice(0, FIRST)).map(s => <Conversation key={`${s.account}:${s.threadId}`} s={s} nudgeKept={data.nudgeKept} onChanged={load} />)}
            {rest.length === 0 && <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>{lists[open].length ? (lists[open].length === 1 ? "It is the one shown on top." : "They are the ones shown on top.") : open === "needs_you" ? "Nobody is waiting on you." : open === "gone_quiet" ? `Nobody has been quiet for ${data.nudgeAfterDays} ${data.nudgeAfterDays === 1 ? "day" : "days"} or more.` : "Nothing else is under way."}</p>}
          </div>
          {rest.length > FIRST && (
            <button type="button" className="btn-ghost" aria-expanded={all} onClick={() => setAll(v => !v)} style={{ minHeight: 40, padding: "0 12px", marginTop: 8, fontSize: 14 }}>
              {all ? "Show fewer" : `Show all ${rest.length}`}
            </button>
          )}
          {(data.counts.closed > 0 || data.counts.cold > 0 || data.counts.lapsed > 0) && (
            <p style={{ margin: "12px 0 0", fontSize: 12.5, color: "var(--text-muted)" }}>
              Not shown: {data.counts.closed} that ended with a no, {data.counts.cold} silent for more than a month, {data.counts.lapsed} where you were asked something more than two weeks ago and left it.
            </p>
          )}
        </>
      )}

      <h3 style={{ margin: "28px 0 4px", fontSize: 18 }}>Everyone who wrote to you</h3>
      <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--text-muted)" }}>
        {data.looked.people} {data.looked.people === 1 ? "person" : "people"}, the ones you are working with first.{data.looked.machines > 0 ? ` ${data.looked.machines} automatic ${data.looked.machines === 1 ? "sender is" : "senders are"} left out: there is nobody there to call.` : ""}
      </p>
      <input type="text" inputMode="search" aria-label="Find a person" placeholder="Find a person or a company" value={find} onChange={e => { setFind(e.target.value); setMorePeople(0) }}
        style={{ width: "100%", maxWidth: 420, height: 44, padding: "0 14px", borderRadius: 12, border: "1px solid var(--border-strong)", background: "var(--surface)", color: "var(--text)", fontSize: 15, marginBottom: 12 }} />
      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
        {people.slice(0, shownPeople).map(p => (
          <li key={`${p.account}:${p.email}`} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
            <Tile name={p.name || p.email} size={40} />
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <div style={{ ...oneLine, fontSize: 15, fontWeight: 650 }}>{p.name || p.email}{p.company ? <span style={{ fontWeight: 400, color: "var(--text-muted)" }}> · {p.company}</span> : null}</div>
              <div style={{ ...oneLine, fontSize: 13, color: p.working ? "var(--text)" : "var(--text-muted)" }}>{tag(p)}</div>
              <div style={{ ...oneLine, fontSize: 12.5, color: "var(--text-muted)" }}>{p.email}{p.phones.length ? ` · ${p.phones.join(" · ")}` : ""} · {p.conversations} {p.conversations === 1 ? "conversation" : "conversations"}, last {day(p.lastAt)}</div>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              <a href={mailHref(p.email)} style={pill}>Email</a>
              {p.phones.slice(0, 1).map(n => <a key={n} href={`tel:${digits(n)}`} style={pill}>Call</a>)}
              <Link href={openHref(p.lastThreadId)} style={pill}>Open</Link>
              <RecruiterButton email={p.email} name={p.name} onChanged={load} />
              <button type="button" onClick={() => hide(p)} disabled={!!busy} title={`Stop showing mail from ${p.name || p.email}. Nothing is deleted.`} style={{ ...pill, cursor: "pointer", color: "var(--text-muted)", borderColor: "var(--border)" }}>{busy === `hide:${p.email}` ? "Hiding…" : "Hide"}</button>
            </div>
          </li>
        ))}
        {people.length === 0 && <li style={{ fontSize: 14, color: "var(--text-muted)" }}>{find.trim() ? "Nobody by that name." : "Nobody to show: everyone who wrote is hidden or is an automatic sender."}</li>}
      </ul>
      {/* Everyone can be reached: more are shown with each press until the list is whole, and it says how many are left. */}
      {people.length > shownPeople && (
        <button type="button" className="btn-ghost" onClick={() => setMorePeople(n => n + MORE_PEOPLE)} style={{ minHeight: 40, padding: "0 12px", marginTop: 8, fontSize: 14 }}>
          Show {Math.min(MORE_PEOPLE, people.length - shownPeople)} more ({people.length - shownPeople} not shown)
        </button>
      )}
      {morePeople > 0 && people.length <= shownPeople && people.length > FIRST_PEOPLE && (
        <button type="button" className="btn-ghost" onClick={() => setMorePeople(0)} style={{ minHeight: 40, padding: "0 12px", marginTop: 8, fontSize: 14 }}>Show fewer</button>
      )}

      {(data.recruiters || []).length > 0 && (
        <>
          <h3 style={{ margin: "28px 0 4px", fontSize: 18 }}>My recruiters</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--text-muted)" }}>They work for you, so nothing here ever asks you to chase them. Whoever they write to is shown as the one to watch.</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {(data.recruiters || []).map(r => (
              <li key={`${r.kind}:${r.value}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
                <span style={{ ...oneLine, flex: 1, minWidth: 0, fontSize: 14 }}>{r.kind === "company" ? `Everyone at ${r.value}` : r.name ? `${r.name} · ${r.value}` : r.value}</span>
                <button type="button" className="btn-ghost" disabled={!!busy} style={{ minHeight: 36, padding: "0 12px", fontSize: 13.5 }}
                  onClick={() => { setBusy(`rec:${r.value}`); changeRecruiter("DELETE", { kind: r.kind, value: r.value }).then(() => { setError(""); load() }, e => setError(e instanceof Error ? e.message : "That could not be saved.")).finally(() => setBusy("")) }}>
                  {busy === `rec:${r.value}` ? "Saving…" : "Take off the list"}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {(data.suggestHide.length > 0 || data.hidden.length > 0) && (
        <>
          <h3 style={{ margin: "28px 0 4px", fontSize: 18 }}>Not worth your time</h3>
          <p style={{ margin: "0 0 12px", fontSize: 13.5, color: "var(--text-muted)" }}>Hiding only stops MarketFit showing their mail. Nothing is deleted, it all stays in Gmail, and you can bring anyone back.</p>
          <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            {data.suggestHide.map(s => (
              <li key={`${s.account}:${s.email}`} style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", padding: "12px 14px", borderRadius: 14, background: "var(--surface)", border: "1px solid var(--border)" }}>
                <Tile name={s.name || s.email} />
                <div style={{ flex: "1 1 220px", minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 650, lineHeight: 1.45 }}>{s.name || s.email} wrote to you {s.count} times and you never answered.</div>
                  <div style={{ ...oneLine, fontSize: 12.5, color: "var(--text-muted)" }}>{s.email}</div>
                </div>
                <button type="button" className="btn-outline" onClick={() => hide(s)} disabled={!!busy} style={{ minHeight: 40, padding: "0 16px", fontSize: 14 }}>{busy === `hide:${s.email}` ? "Hiding…" : "Hide them"}</button>
              </li>
            ))}
          </ul>
          {data.hidden.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <button type="button" className="btn-ghost" aria-expanded={showHidden} onClick={() => setShowHidden(v => !v)} style={{ minHeight: 40, padding: "0 12px", fontSize: 14 }}>
                {showHidden ? "Close the hidden list" : `Hidden already: ${data.hidden.length}`}
              </button>
              {showHidden && (
                <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                  {data.hidden.map(r => (
                    <li key={`${r.account}:${r.kind}:${r.value}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
                      <span style={{ ...oneLine, flex: 1, minWidth: 0, fontSize: 14 }}>{r.kind === "domain" ? `Everyone at ${r.value}` : r.value}</span>
                      <button type="button" className="btn-ghost" onClick={() => showAgain(r)} disabled={!!busy} style={{ minHeight: 36, padding: "0 12px", fontSize: 13.5 }}>{busy === `show:${r.value}` ? "Saving…" : "Show again"}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
