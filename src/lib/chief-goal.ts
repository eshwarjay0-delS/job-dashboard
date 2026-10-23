// From one goal in plain words to the Chief's own scheduled jobs, each with a day and a time, saved only after the
// person's yes on one approval card.
//
// The mistakes it prevents:
// - the person writing the steps himself. Owner, 23 Oct 2026: "Chief, watch my submissions tonight" becomes the jobs —
//   scan the inboxes, triage (interview invites, RTRs, rate confirmations, document requests), the double-submit check,
//   the threads quiet 7+ days, the Apply refresh — "I give the goal, the Chief does the steps, I only make the calls";
// - a job created behind his back: nothing here writes a job until the card's Yes (chief-commands.ts approvePlan);
// - a job that promises work nothing runs. Each step names the code that runs it (the Chief's briefing, the watchdog's
//   checks). A step with no runner yet is shown as "not built yet" and is never scheduled: a plan is not finished work;
// - a time on the card that is not when it runs. The hosting plan runs the Chief's scheduler once a day (vercel.json, the
//   /api/chief/watch/run cron); every job runs at that one time, and the card says that time.
import type { ClassifiedThread } from "@/app/api/gmail/_lib"
import { runChecks } from "@/lib/agent/watchdog-checks"
import { startFromBrief, type ChiefBrief } from "@/lib/chief-brief"
import { neverContactHit } from "@/lib/chief-guard"

export type JobStep = "scan" | "triage" | "double-submit" | "follow-ups" | "apply-refresh" | "watch"
export type JobDay = "once" | "daily" | "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun"
export type ProposedJob = { step: JobStep; day: JobDay; does: string; subject: string }
export type JobsPlan = { goal: string; jobs: ProposedJob[]; notBuilt: ProposedJob[]; by: "standard" | "ai" }

export const MAX_JOBS = 5

/** What each step does, and whether code runs it today. */
export const STEPS: Record<JobStep, { does: string; built: boolean; why?: string }> = {
  "scan": { does: "Scan your inboxes for new recruiter mail since the last run", built: true },
  "triage": { does: "Triage: interview invites, RTRs, rate confirmations, document requests", built: true },
  "double-submit": { does: "Double-submit check: any vendor filing you where another already filed", built: true },
  "follow-ups": { does: "List threads quiet 7+ days that need a follow-up (never-contact names left out)", built: true },
  "apply-refresh": { does: "Refresh Apply matches for saved searches and score new postings", built: false, why: "the portal crawl runs every morning on its own, but scoring new postings for you is not wired to the Chief yet" },
  "watch": { does: "Watch for new activity, invites, RTRs and rate confirmations", built: true },
}

// The scheduler's one daily run: "17 4 * * *" in vercel.json, 04:17 UTC — 11:17 pm in Chicago in summer time, 10:17 pm
// in winter, so the overnight jobs run overnight. A test holds the two together.
export const RUN_TICK_UTC = { hour: 4, minute: 17 }
export const ZONE = "America/Chicago"
const DAY_MS = 86_400_000
const DOW: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }

const weekdayIn = (ms: number) => ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 } as Record<string, number>)[
  new Intl.DateTimeFormat("en-US", { timeZone: ZONE, weekday: "short" }).format(new Date(ms))] ?? 0

/** The scheduler run a job of this day first runs at (ms). A weekday is the day in Chicago, as the person means it. */
export function firstRunFor(day: JobDay, nowMs: number): number {
  const d = new Date(nowMs)
  let tick = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), RUN_TICK_UTC.hour, RUN_TICK_UTC.minute)
  if (tick <= nowMs) tick += DAY_MS
  if (day in DOW) for (let i = 0; i < 7 && weekdayIn(tick) !== DOW[day]; i++) tick += DAY_MS
  return tick
}

/**
 * The job's next_run_at: a quarter of an hour before the run it is meant for. A scheduled call may come a little early;
 * a job due exactly at the run's minute would then wait a whole day.
 */
export const dueAtFor = (tickMs: number) => tickMs - 15 * 60_000
export const everyMinutesFor = (day: JobDay) => (day === "daily" || day === "once" ? 1440 : 10080)

/**
 * When a job that just ran is due again: one interval on, less an hour. Until 23 Oct 2026 the runner set exactly one
 * interval on, so the next day's call, a minute or two earlier in the clock than this one, found the job not yet due,
 * and a daily job ran every other day.
 */
export function nextRunAfter(nowMs: number, everyMinutes: number): number {
  return nowMs + everyMinutes * 60_000 - 60 * 60_000
}

export function whenLabel(ms: number): string {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true })
  return `${f.format(new Date(ms)).replace(/,/g, "").replace(/\s?(am|pm)$/i, " $1")} Chicago`
}

const DAY_WORDS: Record<JobDay, string> = { once: "Once", daily: "Every night", mon: "Every Monday", tue: "Every Tuesday", wed: "Every Wednesday", thu: "Every Thursday", fri: "Every Friday", sat: "Every Saturday", sun: "Every Sunday" }

// ── The proposal ─────────────────────────────────────────────────────────────
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const one = (s: unknown, n: number) => clip(String(s ?? "").replace(/\s+/g, " ").trim(), n)

/** "watch my submissions tonight", "cover my inbox overnight", "run my job hunt": his overnight run, no AI needed. */
const OVERNIGHT = /\b(?:watch|mind|cover|run|handle|look after|keep an eye on)\b[\s\S]{0,40}\b(?:submissions?|inbox(?:es)?|mail|pipeline|job hunt|search|everything)\b|\b(?:tonight|overnight)\b/i
const ONCE = /\btonight\b/i
const REPEAT = /\b(?:every|each|daily|nightly|weekly)\b/i

function split(plan: Omit<JobsPlan, "jobs" | "notBuilt"> & { all: ProposedJob[] }): JobsPlan {
  const seen = new Set<string>()
  const all = plan.all.filter(j => { const k = `${j.step}|${j.day}|${j.subject.toLowerCase()}`; if (seen.has(k)) return false; seen.add(k); return true }).slice(0, MAX_JOBS)
  return { goal: plan.goal, by: plan.by, jobs: all.filter(j => STEPS[j.step].built), notBuilt: all.filter(j => !STEPS[j.step].built) }
}

/** His overnight run, step by step, as his spec lists it. */
export function overnightPlan(goal: string): JobsPlan {
  const day: JobDay = ONCE.test(goal) && !REPEAT.test(goal) ? "once" : "daily"
  const steps: JobStep[] = ["scan", "triage", "double-submit", "follow-ups", "apply-refresh"]
  return split({ goal: one(goal, 300), by: "standard", all: steps.map(step => ({ step, day, does: STEPS[step].does, subject: "" })) })
}

/** When the AI cannot be asked or answers badly: watch what the goal names, check for double submits, list the quiet. */
export function standardPlan(goal: string): JobsPlan {
  const named = /\b(?:req|requisition|posting|job)\s*#?\s*(\d{4,8})\b/i.exec(goal)?.[1] || /["“]([^"”]{3,60})["”]/.exec(goal)?.[1] || ""
  const all: ProposedJob[] = [
    ...(named ? [{ step: "watch" as const, day: "daily" as const, does: `Watch "${named}" for new activity, invites, RTRs and rate confirmations`, subject: named }] : [{ step: "scan" as const, day: "daily" as const, does: STEPS.scan.does, subject: "" }]),
    { step: "double-submit", day: "daily", does: STEPS["double-submit"].does, subject: "" },
    { step: "follow-ups", day: "mon", does: STEPS["follow-ups"].does, subject: "" },
  ]
  return split({ goal: one(goal, 300), by: "standard", all })
}

const STEP_LIST = (Object.keys(STEPS) as JobStep[]).map(s => `- ${s}: ${STEPS[s].does}${STEPS[s].built ? "" : " (NOT BUILT: only propose it when the goal needs it; it will be shown, not scheduled)"}`).join("\n")

/** The proposal prompt. Like every Chief job prompt, it starts from the person's brief. */
export function proposalPrompt(brief: ChiefBrief | null | undefined): string {
  return startFromBrief(brief, [
    "You are the Chief. The user gives one goal; you turn it into 1 to 5 scheduled jobs. Each job is ONE of these steps, which is all the scheduler can run:",
    STEP_LIST,
    "A job only reads the user's own mail and reports in MarketFit. It never sends, posts, applies, pays or contacts anyone; never propose that.",
    "Days: \"once\", \"daily\", or one weekday (mon, tue, wed, thu, fri, sat, sun). Do not give a time: every job runs at the scheduler's one nightly run.",
    "subject: a req number, client, vendor or role the job is about, or \"\" for everything. Use only words from the goal.",
    "Answer with JSON only, exactly: {\"jobs\":[{\"step\":\"triage\",\"day\":\"daily\",\"subject\":\"\"}]}",
  ].join("\n"))
}

/** The AI's answer, kept only where it names a real step and a real day; null when nothing usable came back. */
export function parseProposal(text: string, goal: string): JobsPlan | null {
  const m = /\{[\s\S]*\}/.exec(String(text || ""))
  if (!m) return null
  let parsed: unknown
  try { parsed = JSON.parse(m[0]) } catch { return null }
  const rows = (parsed as { jobs?: unknown })?.jobs
  if (!Array.isArray(rows)) return null
  const all: ProposedJob[] = []
  for (const r of rows as Record<string, unknown>[]) {
    const step = String(r?.step || "").toLowerCase() as JobStep
    if (!(step in STEPS)) continue
    const rawDay = String(r?.day || "daily").toLowerCase().slice(0, 3)
    const day = (rawDay === "onc" ? "once" : rawDay === "dai" || rawDay === "eve" || rawDay === "nig" ? "daily" : rawDay) as JobDay
    if (!(day in DAY_WORDS)) continue
    const subject = one(r?.subject, 60)
    // A subject the goal does not hold is the AI's own idea, not the person's: dropped.
    const kept = subject && goal.toLowerCase().includes(subject.toLowerCase()) ? subject : ""
    all.push({ step, day, subject: kept, does: kept && step === "watch" ? `Watch "${kept}" for new activity, invites, RTRs and rate confirmations` : STEPS[step].does })
  }
  if (!all.length) return null
  return split({ goal: one(goal, 300), by: "ai", all })
}

export type Ask = (system: string, user: string) => Promise<string>

async function askAI(system: string, user: string): Promise<string> {
  const { callLLM, resolveKeys, hasAnyKey } = await import("@/lib/llm")
  const keys = resolveKeys({})
  if (!hasAnyKey(keys)) throw new Error("no AI key")
  const res = await callLLM({ keys, tier: "light", purpose: "chief-goal", system, user, maxTokens: 600, temperature: 0.2 })
  return res.text || ""
}

/** The Chief's proposal for one goal. His overnight run needs no AI; anything else asks it once and falls back. */
export async function proposeJobs(opts: { goal: string; brief?: ChiefBrief | null; ask?: Ask }): Promise<JobsPlan> {
  const goal = one(opts.goal, 300)
  if (OVERNIGHT.test(goal)) return overnightPlan(goal)
  try {
    const text = await (opts.ask || askAI)(proposalPrompt(opts.brief), `Goal: ${goal}`)
    return parseProposal(text, goal) || standardPlan(goal)
  } catch {
    return standardPlan(goal)
  }
}

/** The approval card's words: each job with its day and its time, and what is not built said plainly. */
export function planCardText(plan: JobsPlan, nowMs: number): string {
  const lines = [`Goal: ${plan.goal}`, ""]
  if (plan.jobs.length) {
    lines.push("I would schedule, in this order:")
    plan.jobs.forEach((j, i) => lines.push(`${i + 1}. ${DAY_WORDS[j.day]} — ${j.does}. First run ${whenLabel(firstRunFor(j.day, nowMs))}.`))
  }
  if (plan.notBuilt.length) {
    lines.push("", "Not built yet, so not scheduled:")
    for (const j of plan.notBuilt) lines.push(`• ${j.does} — ${STEPS[j.step].why || "no code runs it yet"}.`)
  }
  lines.push("", "Each job only reads your mail and reports in MarketFit: it contacts no one and sends nothing.")
  if (plan.by === "standard" && !OVERNIGHT.test(plan.goal)) lines.push("(My standard jobs: I could not work out more from the goal.)")
  return lines.join("\n")
}

// ── Saved after the yes ──────────────────────────────────────────────────────
export type WatchInsert = {
  user_id: string; goal: string; subject: string | null; sub_checks: string[]; check_every_minutes: number
  next_run_at: string; deadline_at: string | null; status: "active"
}

/** The step a saved job runs, kept first in its sub-checks ("step:triage") so no new column is needed. */
export const stepOf = (subChecks: unknown): JobStep | null => {
  const first = Array.isArray(subChecks) ? String(subChecks[0] || "") : ""
  const s = first.startsWith("step:") ? first.slice(5) : ""
  return s in STEPS ? (s as JobStep) : null
}

export function jobsToRows(userId: string, plan: JobsPlan, nowMs: number): WatchInsert[] {
  return plan.jobs.map(j => {
    const tick = firstRunFor(j.day, nowMs)
    return {
      user_id: userId,
      goal: clip(`${j.does} — for your goal: ${plan.goal}`, 500),
      subject: j.subject || null,
      sub_checks: [`step:${j.step}`, j.does],
      check_every_minutes: everyMinutesFor(j.day),
      next_run_at: new Date(dueAtFor(tick)).toISOString(),
      // A job for tonight only is done after its one run (the runner closes a job past its deadline).
      deadline_at: j.day === "once" ? new Date(tick + 60 * 60_000).toISOString() : null,
      status: "active",
    }
  })
}

type Db = { from: (t: string) => any } // eslint-disable-line @typescript-eslint/no-explicit-any

async function defaultDb(): Promise<Db> {
  const { serviceClientAvailable, createServiceClient } = await import("@/lib/supabase/service")
  // WhatsApp's answer carries no browser session: the service client writes the person's own rows by their user id.
  if (serviceClientAvailable()) return createServiceClient()
  const { createClient } = await import("@/lib/supabase/server")
  return createClient()
}

const MIGRATION = "supabase/migrations/20261020_chief_watches.sql"

export async function saveApprovedJobs(userId: string, plan: JobsPlan, opts: { db?: Db; now?: number } = {}): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  if (!plan.jobs.length) return { ok: false, error: "There was no job to schedule." }
  const db = opts.db || await defaultDb()
  const rows = jobsToRows(userId, plan, opts.now ?? Date.now())
  const { error } = await db.from("mfit_chief_watches").insert(rows)
  if (error) {
    const missing = String(error.message || "").includes("mfit_chief_watches")
    return { ok: false, error: missing ? `job storage is not set up yet (${MIGRATION} has not been run)` : "the jobs could not be saved just now" }
  }
  return { ok: true, saved: rows.length }
}

export async function listJobsText(userId: string, opts: { db?: Db } = {}): Promise<string> {
  const db = opts.db || await defaultDb()
  const { data, error } = await db.from("mfit_chief_watches")
    .select("goal, sub_checks, check_every_minutes, next_run_at, last_run_at, status")
    .eq("user_id", userId).eq("status", "active").order("next_run_at", { ascending: true }).limit(20)
  if (error) return String(error.message || "").includes("mfit_chief_watches")
    ? `Job storage is not set up yet, so nothing is scheduled (${MIGRATION} has not been run).`
    : "I could not read your jobs just now. Ask again in a minute."
  const rows = (data || []) as { goal: string; sub_checks: unknown; check_every_minutes: number; next_run_at: string; last_run_at: string | null }[]
  if (!rows.length) return "No jobs are scheduled. Send *goal:* and what you want done, for example _goal: watch my submissions tonight_."
  return [
    `*Your scheduled jobs* (${rows.length}):`,
    ...rows.map((r, i) => {
      const step = stepOf(r.sub_checks)
      const does = step ? STEPS[step].does : clip(r.goal, 120)
      const every = r.check_every_minutes >= 10080 ? "weekly" : "nightly"
      return `${i + 1}. ${does} — ${every}, next ${whenLabel(Date.parse(r.next_run_at) + 15 * 60_000)}${r.last_run_at ? `, last ran ${whenLabel(Date.parse(r.last_run_at))}` : ""}`
    }),
  ].join("\n")
}

// ── What a step finds when it runs ───────────────────────────────────────────
const at = (m: { internalDate?: string }) => Number(m.internalDate) || 0

/** What one scheduled step found in the person's threads. Pure: the runner fetches the threads once for every job. */
export function stepFindings(step: JobStep, threads: ClassifiedThread[], opts: { now: number; subject?: string | null; neverContact?: string[] }): { items: string[]; note?: string } {
  const now = opts.now
  const subject = (opts.subject || "").toLowerCase()
  const about = (t: ClassifiedThread) => !subject || JSON.stringify(t.messages.map(m => [m.subject, m.jobTitle, m.vendor, m.from])).toLowerCase().includes(subject)
  const pool = threads.filter(about)
  const latest = (t: ClassifiedThread) => t.messages[t.messages.length - 1]
  const recent = (t: ClassifiedThread, hours: number) => now - at(latest(t)) <= hours * 3_600_000
  const label = (t: ClassifiedThread) => { const l = latest(t); return `${l.vendor || l.from}: ${l.jobTitle || l.subject}`.slice(0, 120) }

  if (step === "scan") {
    const fresh = pool.filter(t => recent(t, 26))
    return { items: fresh.slice(0, 8).map(label), note: `${fresh.length} thread(s) with new mail since the last run` }
  }
  if (step === "triage" || step === "watch") {
    const KINDS: Record<string, string> = { "Interview Request": "interview invite", "RTR Request": "RTR", "Rate Confirmation": "rate confirmation", "Document Request": "document request" }
    const items: string[] = []
    for (const t of pool) {
      const hit = t.messages.filter(m => KINDS[m.category] && now - at(m) <= 48 * 3_600_000)
      for (const kind of [...new Set(hit.map(m => KINDS[m.category]))]) items.push(`${kind} — ${label(t)}`)
    }
    return { items: items.slice(0, 12) }
  }
  if (step === "double-submit") {
    const found = runChecks(pool).filter(f => f.check === "duplicate-chains" || f.check === "rtr-conflict" || f.check === "rate-drift")
    return { items: found.slice(0, 8).map(f => `${f.title} — call one before anyone files`) }
  }
  if (step === "follow-ups") {
    const ACTIVE = new Set(["RTR Request", "Submission Confirmation", "Interview Request"])
    const quiet = pool.filter(t => {
      const l = latest(t)
      if (!t.messages.some(m => ACTIVE.has(m.category))) return false
      if (neverContactHit(opts.neverContact || [], (l.from.match(/[\w.+-]+@[\w.-]+/) || [""])[0], l.vendor || "")) return false
      return (now - at(l)) / DAY_MS >= 7
    })
    return { items: quiet.slice(0, 10).map(t => `${label(t)} — quiet ${Math.floor((now - at(latest(t))) / DAY_MS)} days`), note: "Drafting these follow-ups overnight is not built yet: ask me for them and each one comes to you as a card." }
  }
  return { items: [] }
}

export function findingsText(step: JobStep, f: { items: string[]; note?: string }): string {
  const head = STEPS[step].does
  if (!f.items.length) return `${head}: nothing new.${f.note && step !== "follow-ups" ? ` (${f.note})` : ""}`
  return [`${head}:`, ...f.items.map(i => `• ${i}`), ...(f.note ? [f.note] : [])].join("\n")
}
