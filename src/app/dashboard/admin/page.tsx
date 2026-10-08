"use client"

// The admin's one page (owner, 2026-10-07): "a centralized place for job-dashboard and kompas usage. API costs, tokens costs",
// "how much usage is left. How many were interacted. clear picture of resume gen costs. How many generated this week and today".
//
// Every number comes from GET /api/admin/usage, which checks on the server that the person asking is an admin; this page holds
// no data of its own and shows nothing to anyone else. It is built from the dashboard's own tokens and shared parts (PageIntro,
// Card, Meta, Chip), so it reads as one more page of MarketFit and follows the Paper and Night themes with the rest.
//
// A figure that is missing is said to be missing. A blank is never shown as a zero: see the notes under the intro.

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react"
import PageIntro from "../_components/page-intro"
import { Card, Chip, Meta } from "../_suite/ui"
import KeysPanel from "./keys-panel"
import type { GroqAllowance } from "@/lib/llm"
import type { CallSummary } from "@/lib/llmLedger"
import type { LlmStatus } from "@/lib/llmStatus"
import type { TailorOverview, TailorWindow } from "@/lib/tailorLedger"

type Usage = {
  at: string
  timeZone: string
  today: string
  resumes: TailorOverview
  calls: { today: CallSummary; week: CallSummary; month: CallSummary }
  left: {
    openai: { budgetUsd: number | null; spentMonthUsd: number; leftUsd: number | null; resumesLeft: number | null }
    groq: GroqAllowance[]
    providers: LlmStatus["providers"]
    perPersonWeeklyLimit: number | null
  }
  prices: { model: string; in: number; out: number; source: string; read: string }[]
  gaps: { unreadable: number; truncated: boolean; kompasReporting: boolean; recordingSince: string | null }
}

type Span = "today" | "week" | "month"
const SPANS: { id: Span; label: string }[] = [{ id: "today", label: "Today" }, { id: "week", label: "Last 7 days" }, { id: "month", label: "This month" }]

// A cost here is often a fraction of a cent, so small sums keep the digits that carry the meaning.
const money = (usd: number) => (usd === 0 ? "$0" : usd < 0.01 ? `$${usd.toFixed(4)}` : usd < 1 ? `$${usd.toFixed(3)}` : `$${usd.toFixed(2)}`)
const count = (n: number) => n.toLocaleString("en-US")
const tokens = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : count(n))
const words = (slug: string) => { const s = slug.replace(/[-_]+/g, " "); return s.charAt(0).toUpperCase() + s.slice(1) }

const APP: Record<string, string> = { marketfit: "MarketFit", kompas: "Kompas" }
const PROVIDER: Record<string, string> = { openai: "OpenAI", groq: "Groq", openrouter: "OpenRouter", anthropic: "Anthropic", gemini: "Gemini", cerebras: "Cerebras", nvidia: "NVIDIA" }
const provider = (id: string) => PROVIDER[id] ?? words(id)
const CHANNEL: Record<string, string> = { whatsapp: "WhatsApp", web: "Website", "auto-reply": "Auto reply" }
const OUTCOME: Record<string, string> = { whole: "Written", partial: "Partly written", unchanged: "No change", cached: "Served again", failed: "Failed" }
const STATE: Record<string, string> = {
  ok: "Working", rate_limited: "At its limit", key_rejected: "Key rejected", no_credit: "Out of credit",
  model_not_found: "Model not found", slow_or_down: "Slow or down", refused: "Refused",
}

const NUM: CSSProperties = { fontFamily: "var(--font-num)", fontVariantNumeric: "tabular-nums" }
const TH: CSSProperties = {
  fontFamily: "var(--font-mono)", fontSize: 11, fontWeight: 500, letterSpacing: ".12em", textTransform: "uppercase",
  color: "var(--text-soft)", padding: "0 12px 10px 0", borderBottom: "0.8px solid var(--border-strong)", whiteSpace: "nowrap",
}
const TD: CSSProperties = { padding: "11px 12px 11px 0", borderBottom: "1px solid var(--border)", color: "var(--text)", verticalAlign: "top" }
const H2: CSSProperties = { fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 700, letterSpacing: "-0.01em", color: "var(--text)", margin: "0 0 4px" }
const LEDE: CSSProperties = { fontSize: 15, lineHeight: 1.55, color: "var(--text-muted)", margin: "0 0 18px", maxWidth: 680 }
const SMALL: CSSProperties = { fontSize: 14, lineHeight: 1.55, color: "var(--text-muted)", margin: 0 }

// `left` is how many leading columns hold words; the rest are figures and line up on the right.
function Table({ head, rows, empty, left = 1 }: { head: string[]; rows: ReactNode[][]; empty: string; left?: number }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14.5 }}>
        <thead>
          <tr>{head.map((h, i) => <th key={h} scope="col" style={{ ...TH, textAlign: i < left ? "left" : "right" }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.length === 0
            ? <tr><td colSpan={head.length} style={{ ...TD, color: "var(--text-soft)", borderBottom: "none" }}>{empty}</td></tr>
            : rows.map((row, r) => (
              <tr key={r}>{row.map((cell, c) => <td key={c} style={{ ...TD, ...(c < left ? {} : { ...NUM, whiteSpace: "nowrap" }), textAlign: c < left ? "left" : "right" }}>{cell}</td>)}</tr>
            ))}
        </tbody>
      </table>
    </div>
  )
}

function Tag({ children, tone = "plain" }: { children: ReactNode; tone?: "plain" | "good" | "warn" | "bad" }) {
  const c = tone === "good" ? ["var(--success-soft)", "var(--success)", "var(--success-border)"]
    : tone === "warn" ? ["var(--warning-soft)", "var(--warning)", "var(--warning-border)"]
    : tone === "bad" ? ["var(--danger-soft)", "var(--danger)", "var(--danger-border)"]
    : ["var(--surface-2)", "var(--text-muted)", "var(--border)"]
  return (
    <span style={{
      display: "inline-block", fontFamily: "var(--font-label)", fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
      padding: "2px 9px", borderRadius: 100, background: c[0], color: c[1], border: `1px solid ${c[2]}`,
    }}>{children}</span>
  )
}

function Section({ title, lede, children, aside }: { title: string; lede: string; children: ReactNode; aside?: ReactNode }) {
  return (
    <section style={{ marginTop: 44 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div><h2 style={H2}>{title}</h2><p style={LEDE}>{lede}</p></div>
        {aside && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>{aside}</div>}
      </div>
      {children}
    </section>
  )
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderTop: "1px solid var(--border)", fontSize: 14.5 }}>
      <span style={{ color: "var(--text-muted)" }}>{label}</span>
      <span style={{ ...NUM, color: "var(--text)", fontWeight: 600 }}>{value}</span>
    </div>
  )
}

function ResumeCard({ label, w }: { label: string; w: TailorWindow }) {
  return (
    <Card>
      <Meta>{label}</Meta>
      <div style={{ ...NUM, fontFamily: "var(--font-display)", fontSize: 46, fontWeight: 700, lineHeight: 1.05, color: "var(--text)", marginTop: 10 }}>{count(w.generated)}</div>
      <div style={{ fontSize: 14.5, color: "var(--text-muted)", margin: "2px 0 14px" }}>{w.generated === 1 ? "resume written" : "resumes written"}</div>
      <Fact label="People who asked" value={count(w.people)} />
      <Fact label="Cost" value={<>{money(w.costUsd)}{w.unpricedCalls > 0 ? " or more" : ""}</>} />
      <Fact label="Cost for one resume" value={w.costPerResumeUsd > 0 ? money(w.costPerResumeUsd) : "–"} />
      <Fact label="Failed" value={count(w.failed)} />
      <Fact label="Came back unchanged" value={count(w.unchanged)} />
      <Fact label="Served again, no cost" value={count(w.cached)} />
    </Card>
  )
}

function Bar({ part, whole }: { part: number; whole: number }) {
  const share = whole > 0 ? Math.max(0, Math.min(1, part / whole)) : 0
  return (
    <div aria-hidden style={{ height: 8, borderRadius: 100, background: "var(--surface-2)", border: "1px solid var(--border)", overflow: "hidden" }}>
      <div style={{ width: `${share * 100}%`, height: "100%", background: "var(--accent)" }} />
    </div>
  )
}

export default function AdminPage() {
  const [data, setData] = useState<Usage | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "not-admin" | "failed">("loading")
  const [busy, setBusy] = useState(false)
  const [span, setSpan] = useState<Span>("week")
  const loadedAt = useRef(0)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const response = await fetch("/api/admin/usage", { cache: "no-store" })
      if (response.status === 401 || response.status === 403) { setState("not-admin"); return }
      if (!response.ok) { setState(s => (s === "ready" ? s : "failed")); return }
      setData(await response.json())
      loadedAt.current = Date.now()
      setState("ready")
    } catch { setState(s => (s === "ready" ? s : "failed")) } finally { setBusy(false) }
  }, [])

  useEffect(() => {
    void load()
    // Fresh when the admin comes back to the tab, without a timer reading the ledgers all day for a page nobody is looking at.
    const onShow = () => { if (document.visibilityState === "visible" && Date.now() - loadedAt.current > 60_000) void load() }
    document.addEventListener("visibilitychange", onShow)
    return () => document.removeEventListener("visibilitychange", onShow)
  }, [load])

  const intro = <PageIntro page="/dashboard/admin" action={{ label: busy ? "Refreshing…" : "Refresh", onClick: () => { if (!busy) void load() } }} />

  if (state !== "ready" || !data) {
    return (
      <div style={{ maxWidth: 1080 }}>
        {intro}
        <Card>
          <p style={{ ...SMALL, fontSize: 15.5 }} role="status" aria-live="polite">
            {state === "loading" ? "Reading the records…"
              : state === "not-admin" ? "This page is for admins. Sign in with an admin account to see it."
              : "The records could not be read just now. Nothing is lost: press Refresh to try again."}
          </p>
        </Card>
      </div>
    )
  }

  const { resumes, calls, left, gaps } = data
  const c = calls[span]
  const time = (at: string | number, withDay = true) => new Date(at).toLocaleString("en-US", {
    timeZone: data.timeZone, hour: "numeric", minute: "2-digit", ...(withDay ? { month: "short", day: "numeric" } : {}),
  })
  const dayName = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" })

  const notes: string[] = []
  if (!gaps.kompasReporting) notes.push("Kompas has not reported a model call this month. Its numbers are missing from this page; they are not zero.")
  if (gaps.recordingSince) notes.push(`Counting began ${time(gaps.recordingSince)}. Nothing before that is in these numbers.`)
  else notes.push("Nothing has been recorded yet. Counting began when this page went live; the next resume or model call will show here.")
  if (calls.month.unpricedCalls > 0) notes.push(`${count(calls.month.unpricedCalls)} ${calls.month.unpricedCalls === 1 ? "call" : "calls"} this month went to a model with no price in the table at the bottom, so the cost shown is the least it can be.`)
  if (gaps.unreadable > 0) notes.push(`${count(gaps.unreadable)} ${gaps.unreadable === 1 ? "record or day" : "records or days"} could not be read and ${gaps.unreadable === 1 ? "is" : "are"} left out.`)
  if (gaps.truncated) notes.push("There are more resume records this month than one page load reads, so the monthly resume figures are short.")

  const maxDay = Math.max(1, ...resumes.days.map(d => d.generated + d.failed))
  const week = resumes.week

  return (
    <div style={{ maxWidth: 1080 }}>
      {intro}

      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <Meta>Updated {time(data.at, false)} · days are {data.timeZone.replace(/_/g, " ")} time</Meta>
      </div>

      {notes.length > 0 && (
        <div style={{ marginTop: 14, padding: "14px 18px", borderRadius: "var(--radius-lg)", background: "var(--warning-soft)", border: "1px solid var(--warning-border)" }}>
          <Meta style={{ color: "var(--warning)" }}>Read these first</Meta>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18 }}>
            {notes.map(n => <li key={n} style={{ fontSize: 14.5, lineHeight: 1.6, color: "var(--text)" }}>{n}</li>)}
          </ul>
        </div>
      )}

      <Section title="Resumes" lede="How many resumes were written for a job, how many people asked, and what the writing cost.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
          <ResumeCard label="Today" w={resumes.today} />
          <ResumeCard label="Last 7 days" w={resumes.week} />
          <ResumeCard label="This month" w={resumes.month} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
          <Card>
            <Meta style={{ marginBottom: 14 }}>The last 7 days, day by day</Meta>
            {resumes.days.map(d => (
              <div key={d.day} style={{ display: "grid", gridTemplateColumns: "104px 1fr auto", alignItems: "center", gap: 12, padding: "7px 0" }}>
                <span style={{ fontSize: 14, color: "var(--text-muted)" }}>{dayName(d.day)}</span>
                <Bar part={d.generated} whole={maxDay} />
                <span style={{ ...NUM, fontSize: 14, color: "var(--text)", minWidth: 150, textAlign: "right" }}>
                  {count(d.generated)} written{d.failed > 0 ? ` · ${count(d.failed)} failed` : ""} · {money(d.costUsd)}
                </span>
              </div>
            ))}
          </Card>
          <Card>
            <Meta style={{ marginBottom: 14 }}>Where they came from, last 7 days</Meta>
            <Table head={["From", "Written", "Failed", "People", "Cost"]} empty="No resumes in the last 7 days."
              rows={Object.entries(week.byChannel).map(([channel, v]) => [CHANNEL[channel] ?? words(channel), count(v.generated), count(v.failed), count(v.people), money(v.costUsd)])} />
          </Card>
        </div>
      </Section>

      <Section title="How much is left" lede="What each model provider still allows, as far as it says. Where a provider does not say, this page says that instead of guessing.">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
          <Card>
            <Meta>OpenAI, paid</Meta>
            {left.openai.budgetUsd !== null && left.openai.leftUsd !== null ? (
              <>
                <div style={{ ...NUM, fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: left.openai.leftUsd <= 0 ? "var(--danger)" : "var(--text)", margin: "10px 0 2px" }}>{money(Math.max(0, left.openai.leftUsd))}</div>
                <p style={{ ...SMALL, marginBottom: 12 }}>left of your {money(left.openai.budgetUsd)} for this month</p>
                <Bar part={Math.max(0, left.openai.leftUsd)} whole={left.openai.budgetUsd} />
                <div style={{ marginTop: 12 }}>
                  <Fact label="Spent this month" value={money(left.openai.spentMonthUsd)} />
                  <Fact label="Resumes that would buy" value={left.openai.resumesLeft === null ? "–" : `about ${count(left.openai.resumesLeft)}`} />
                </div>
              </>
            ) : (
              <>
                <div style={{ ...NUM, fontFamily: "var(--font-display)", fontSize: 38, fontWeight: 700, color: "var(--text)", margin: "10px 0 2px" }}>{money(left.openai.spentMonthUsd)}</div>
                <p style={{ ...SMALL, marginBottom: 10 }}>spent this month</p>
                <p style={SMALL}>OpenAI does not tell a key how much credit remains, so there is no &ldquo;left&rdquo; to show yet. Set a monthly budget on Vercel (OPENAI_MONTHLY_BUDGET_USD, a number of dollars) and this card counts down from it.</p>
              </>
            )}
          </Card>

          <Card>
            <Meta>Groq, free allowance</Meta>
            {left.groq.length === 0 ? (
              <p style={{ ...SMALL, marginTop: 12 }}>No answer from Groq on this server yet. Groq sends what is left with every answer; the figures show here after the next call that uses it.</p>
            ) : (
              left.groq.map(g => (
                <div key={g.model} style={{ marginTop: 12 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: "var(--text)", marginBottom: 6, overflowWrap: "anywhere" }}>{g.model}</div>
                  <Fact label="Requests left today" value={g.requestsLeft === null ? "–" : `${count(g.requestsLeft)}${g.requestsLimit === null ? "" : ` of ${count(g.requestsLimit)}`}`} />
                  <Fact label="Tokens left this minute" value={g.tokensLeft === null ? "–" : `${count(g.tokensLeft)}${g.tokensLimit === null ? "" : ` of ${count(g.tokensLimit)}`}`} />
                  <Fact label="As Groq last said, at" value={time(g.at, false)} />
                </div>
              ))
            )}
          </Card>

          <Card>
            <Meta>Every provider, right now</Meta>
            <div style={{ marginTop: 12 }}>
              {left.providers.length === 0
                ? <p style={SMALL}>The providers could not be checked just now.</p>
                : left.providers.map(p => (
                  <div key={p.provider} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "8px 0", borderTop: "1px solid var(--border)" }}>
                    <span style={{ fontSize: 14.5, color: "var(--text)" }}>
                      {provider(p.provider)}
                      {(p.model || p.scope || p.limit) && <span style={{ color: "var(--text-soft)" }}> · {[p.model, p.scope, p.limit].filter(Boolean).join(" · ")}</span>}
                    </span>
                    <Tag tone={p.state === "ok" ? "good" : p.state === "rate_limited" || p.state === "slow_or_down" ? "warn" : "bad"}>{STATE[p.state] ?? words(p.state)}</Tag>
                  </div>
                ))}
              {left.perPersonWeeklyLimit !== null && <Fact label="Resumes one person may ask for in a week" value={count(left.perPersonWeeklyLimit)} />}
            </div>
          </Card>
        </div>
      </Section>

      <Section title="Model calls and cost" lede="Every call either app made to a model: how many, how many tokens went in and came out, and what it cost."
        aside={SPANS.map(s => <Chip key={s.id} label={s.label} active={span === s.id} onClick={() => setSpan(s.id)} />)}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
          {([
            ["Cost", money(c.costUsd), c.unpricedCalls > 0 ? "or more: some calls have no known price" : ""],
            ["Calls", count(c.calls), c.failed > 0 ? `${count(c.failed)} of them failed` : "none failed"],
            ["Time to answer", c.meanMs > 0 ? `${(c.meanMs / 1000).toFixed(1)} s` : "–", "on average, for calls that answered"],
            ["Tokens in", tokens(c.input), "what was sent to the models"],
            ["Tokens out", tokens(c.output), "what the models wrote back"],
            ["Tokens in all", tokens(c.input + c.output), "in and out together"],
          ] as const).map(([label, value, under]) => (
            <Card key={label} style={{ padding: 16 }}>
              <Meta>{label}</Meta>
              <div style={{ ...NUM, fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 700, color: "var(--text)", marginTop: 8 }}>{value}</div>
              <div style={{ fontSize: 13.5, color: "var(--text-soft)", marginTop: 2, minHeight: 20 }}>{under}</div>
            </Card>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginTop: 16 }}>
          <Card>
            <Meta style={{ marginBottom: 14 }}>By app</Meta>
            <Table head={["App", "Calls", "Failed", "Tokens in", "Tokens out", "Cost"]} empty="No calls in this time."
              rows={Object.entries(c.byApp).map(([app, v]) => [APP[app] ?? words(app), count(v.calls), count(v.failed), tokens(v.input), tokens(v.output), `${money(v.costUsd)}${v.unpricedCalls > 0 ? " or more" : ""}`])} />
          </Card>
          <Card>
            <Meta style={{ marginBottom: 14 }}>By job</Meta>
            <Table left={2} head={["App", "What it was for", "Calls", "Failed", "Tokens", "Cost"]} empty="No calls in this time."
              rows={c.byPurpose.map(p => [APP[p.app] ?? words(p.app), words(p.purpose), count(p.calls), count(p.failed), tokens(p.input + p.output), money(p.costUsd)])} />
          </Card>
        </div>

        <Card style={{ marginTop: 16 }}>
          <Meta style={{ marginBottom: 14 }}>By model</Meta>
          <Table left={2} head={["Provider", "Model", "Calls", "Tokens in", "Tokens out", "Cost"]} empty="No calls in this time."
            rows={c.byModel.map(m => [
              provider(m.provider),
              <span key="m">{m.model} {m.kind === "free" ? <Tag tone="good">Free</Tag> : m.kind === "unpriced" ? <Tag tone="warn">No price known</Tag> : null}</span>,
              count(m.calls), tokens(m.input), tokens(m.output), m.kind === "unpriced" ? "–" : money(m.costUsd),
            ])} />
        </Card>
      </Section>

      <Section title="API keys" lede="Add or replace any provider's key here, and tick what may use it. A key is sealed before it is stored and is never shown again; a change takes effect within half a minute, with no redeploy.">
        <KeysPanel />
      </Section>

      <Section title="The latest resumes" lede="The newest twenty requests, newest first. No names and no words from anyone's resume are kept here.">
        <Card>
          <Table left={3} head={["When", "From", "What happened", "Took", "Written by", "Cost"]} empty="No resumes yet."
            rows={resumes.recent.map(r => [
              time(r.at),
              `${CHANNEL[r.channel] ?? words(r.channel)}${r.kind === "refine" ? ", a change" : ""}`,
              <Tag key="o" tone={r.outcome === "failed" ? "bad" : r.outcome === "whole" ? "good" : r.outcome === "cached" ? "plain" : "warn"}>{OUTCOME[r.outcome] ?? r.outcome}{r.failure ? `: ${r.failure}` : ""}</Tag>,
              `${(r.ms / 1000).toFixed(1)} s`,
              <span key="v" style={{ fontFamily: "var(--font-body)", color: "var(--text-muted)" }}>{r.via || "–"}</span>,
              money(r.costUsd),
            ])} />
        </Card>
      </Section>

      <Section title="The prices used" lede="Dollars for a million tokens. Cost is worked out from these when the page loads, so a corrected price corrects the past too.">
        <Card>
          <Table head={["Model", "In", "Out", "Checked"]} empty="No prices."
            rows={data.prices.map(p => [
              <span key="p">{p.model} <span style={{ color: "var(--text-soft)", fontSize: 13 }}>· {p.source}</span></span>,
              `$${p.in}`, `$${p.out}`, p.read,
            ])} />
        </Card>
      </Section>
    </div>
  )
}
