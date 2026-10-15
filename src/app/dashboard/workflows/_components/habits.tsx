"use client"
import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { Check, Repeat } from "lucide-react"
import { Card, Btn } from "../../_suite/ui"
import TypingDots from "../../_components/typing-dots"
import type { Habit } from "@/lib/mail-habits"

// "What you keep doing by hand", on the Follow-ups page. The owner, 12 Oct 2026: "show suggestions on what are the things
// that you are basically repeating yourself over and over again, and how we can help you with automating it, without you
// even defining what you might be needed to automate ... taking that task off the user's hand."
// Nothing is typed in here and no rule is written. Each card is something the mail itself shows was done three times or
// more: one sentence saying what, the person's own words, and one button to hand it over. The times it happened are one
// tap away, so every card can be checked. What is handed over still waits for the person: nothing is sent from this page.

interface Answer { ok: boolean; kept: boolean; looked: { conversations: number; written: number; days: number }; suggestions: Habit[]; on: Habit[]; off: number; error?: string }
const FIRST = 3   // suggestions shown before "Show more": three is what can be taken in at a glance

const day = (at: number) => at ? new Date(at).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""
const daysQuiet = (at: number, now: number) => Math.max(1, Math.floor((now - at) / 86_400_000))
const ABOUT: Record<string, string> = { rate: "asks about your rate", availability: "asks when you are free", rtr: "asks for your go-ahead", documents: "asks for papers", requirement: "sends a job requirement", outreach: "", "": "writes to you" }

function Words({ text }: { text: string }) {
  const [all, setAll] = useState(false)
  const long = text.length > 260 || text.split("\n").length > 4
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 6 }}>Your words</div>
      <blockquote style={{
        margin: 0, padding: "10px 14px", borderLeft: "3px solid var(--border-strong)", borderRadius: "0 10px 10px 0", background: "var(--surface-2)",
        fontSize: 14, lineHeight: 1.6, color: "var(--text)", whiteSpace: "pre-wrap", overflowWrap: "anywhere",
        ...(long && !all ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" } : {}),
      }}>{text}</blockquote>
      {long && <button type="button" className="btn-ghost" aria-expanded={all} onClick={() => setAll(v => !v)} style={{ minHeight: 32, padding: "0 8px", marginTop: 4, fontSize: 13 }}>{all ? "Show less" : "Show all of it"}</button>}
    </div>
  )
}

function Times({ habit }: { habit: Habit }) {
  return (
    <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
      {habit.examples.map(e => (
        <li key={`${e.account}:${e.threadId}:${e.at}`} style={{ display: "flex", gap: 10, alignItems: "baseline", fontSize: 13, lineHeight: 1.5 }}>
          <span style={{ flex: "none", width: 52, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{day(e.at)}</span>
          <span style={{ flex: "none", maxWidth: "38%", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.who}</span>
          <span style={{ flex: 1, minWidth: 0, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.text}</span>
        </li>
      ))}
      {habit.count > habit.examples.length && <li style={{ fontSize: 12.5, color: "var(--text-muted)" }}>and {habit.count - habit.examples.length} more before these</li>}
    </ul>
  )
}

export default function Habits() {
  const [data, setData] = useState<Answer | null>(null)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState("")        // the habit being saved
  const [shown, setShown] = useState("")      // the card whose times are open
  const [more, setMore] = useState(false)
  const [now] = useState(() => Date.now())

  const load = useCallback(() => {
    fetch("/api/gmail/habits")
      .then(r => r.json())
      .then((j: Answer) => { if (j?.ok) { setData(j); setError("") } else setError(j?.error || "Your mail could not be looked through just now.") })
      .catch(() => setError("Your mail could not be looked through just now."))
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (id: string, state: "on" | "off" | "undo") => {
    if (busy) return
    setBusy(id)
    try {
      const res = await fetch("/api/gmail/habits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, state }) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok || !j.ok) setError(j.error || "That could not be saved. Try again.")
      else load()
    } catch { setError("That could not be saved. Try again.") } finally { setBusy("") }
  }

  if (error && !data) return <p role="status" style={{ fontSize: 13.5, color: "var(--text-muted)", margin: "0 0 20px" }}>{error}</p>
  if (!data) return <div style={{ padding: "18px 0 24px" }}><TypingDots label="Looking at what you keep doing by hand…" /></div>
  if (!data.looked.conversations) return null   // no mail to look through: the page above already says to connect Gmail

  const list = more ? data.suggestions : data.suggestions.slice(0, FIRST)
  return (
    <section aria-labelledby="habits-heading" style={{ marginBottom: 28 }}>
      <h2 id="habits-heading" style={{ margin: "0 0 6px", fontSize: 22, letterSpacing: "-0.02em" }}>What you keep doing by hand</h2>
      <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)", maxWidth: 720 }}>
        MarketFit read the {data.looked.written} {data.looked.written === 1 ? "message" : "messages"} you wrote in {data.looked.conversations} conversations over the last {data.looked.days} days and looked for what repeats.
        {" "}You set nothing up. Nothing is sent without your OK.
      </p>
      {error && <p role="alert" style={{ fontSize: 13.5, color: "var(--danger)", margin: "0 0 12px" }}>{error}</p>}

      {data.suggestions.length === 0 && data.on.length === 0 && (
        <Card><div style={{ fontSize: 14.5, lineHeight: 1.6 }}>Nothing repeats often enough yet. A thing shows up here once you have done it three times.</div></Card>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {list.map(h => (
          <Card key={h.id}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <Repeat size={18} aria-hidden="true" style={{ flex: "none", marginTop: 3 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 16, fontWeight: 650, lineHeight: 1.45 }}>{h.title}</div>
                <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 4 }}>{h.offer}</div>
                {h.typical && <Words text={h.typical} />}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 14 }}>
                  <Btn onClick={() => decide(h.id, "on")} disabled={!!busy}>{busy === h.id ? "Saving…" : h.action}</Btn>
                  <Btn variant="ghost" onClick={() => decide(h.id, "off")} disabled={!!busy}>Not now</Btn>
                  <button type="button" className="btn-ghost" aria-expanded={shown === h.id} onClick={() => setShown(s => s === h.id ? "" : h.id)} style={{ minHeight: 36, padding: "0 10px", fontSize: 13.5, marginLeft: "auto" }}>
                    {shown === h.id ? "Hide the times" : `Show the ${h.count} times`}
                  </button>
                </div>
                {shown === h.id && <Times habit={h} />}
              </div>
            </div>
          </Card>
        ))}
      </div>
      {data.suggestions.length > FIRST && (
        <button type="button" className="btn-ghost" aria-expanded={more} onClick={() => setMore(v => !v)} style={{ minHeight: 40, padding: "0 12px", marginTop: 8, fontSize: 14 }}>
          {more ? "Show fewer" : `Show ${data.suggestions.length - FIRST} more`}
        </button>
      )}

      {data.on.length > 0 && (
        <div style={{ marginTop: data.suggestions.length ? 22 : 0 }}>
          <h3 style={{ margin: "0 0 10px", fontSize: 15, fontWeight: 700 }}>Handed over to MarketFit</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {data.on.map(h => (
              <Card key={h.id}>
                <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  <Check size={18} aria-hidden="true" style={{ flex: "none", marginTop: 2 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14.5, fontWeight: 650, lineHeight: 1.5 }}>
                      {h.kind === "same_reply" && (h.when === "outreach" ? "Your usual opening is kept." : `When someone ${ABOUT[h.when || ""] || "writes to you"}, your usual reply is already written.`)}
                      {h.kind === "chase" && `After ${h.days || 1} ${(h.days || 1) === 1 ? "day" : "days"} of silence, ${h.typical ? "your nudge is ready." : "MarketFit lists who went quiet."}`}
                      {h.kind === "never_answered" && `Mail from ${h.sender?.name || h.sender?.email || "this sender"} is no longer shown.`}
                    </div>
                    <div style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--text-muted)", marginTop: 3 }}>
                      {h.kind === "same_reply" && "Open the conversation, press Reply, and it is the first choice. It goes out only when you press send."}
                      {h.kind === "chase" && (h.quiet?.length ? `${h.quiet.length} ${h.quiet.length === 1 ? "conversation is" : "conversations are"} quiet that long right now. ${h.typical ? "Open one, press Reply, and your nudge is the first choice." : "Open one to write to them: your second messages were each different, so the words stay yours."}` : "Nobody is quiet that long right now.")}
                      {h.kind === "never_answered" && "Nothing was deleted. It is all still in Gmail."}
                    </div>
                    {h.kind === "chase" && !!h.quiet?.length && (
                      <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
                        {h.quiet.slice(0, 8).map(q => (
                          <li key={`${q.account}:${q.threadId}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 12px", borderRadius: 10, background: "var(--surface-2)" }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.who}</div>
                              <div style={{ fontSize: 12.5, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{q.text} · quiet {daysQuiet(q.at, now)} {daysQuiet(q.at, now) === 1 ? "day" : "days"}</div>
                            </div>
                            <Link href={`/dashboard/mail?open=${encodeURIComponent(q.threadId)}`} className="btn-outline" style={{ minHeight: 36, padding: "0 14px", display: "inline-flex", alignItems: "center", fontSize: 13.5, textDecoration: "none", flex: "none" }}>Open</Link>
                          </li>
                        ))}
                        {h.quiet.length > 8 && <li style={{ fontSize: 12.5, color: "var(--text-muted)" }}>and {h.quiet.length - 8} more</li>}
                      </ul>
                    )}
                    <div style={{ marginTop: 10 }}>
                      <Btn variant="ghost" onClick={() => decide(h.id, "undo")} disabled={!!busy}>{busy === h.id ? "Saving…" : h.kind === "never_answered" ? "Show them again" : "Take it back"}</Btn>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
