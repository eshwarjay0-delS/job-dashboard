import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, TRACKING_DAYS, type AuthContext } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { findHabits, validDecision, wordsOfMessage, neverId, type Decision, type Habit, type HabitThread, type Kept } from "@/lib/mail-habits"
import { validIgnoreRule, type IgnoreRule } from "@/lib/gmail-ignore"

// What the person keeps doing by hand in their job mail, and what they decided about each (src/lib/mail-habits.ts).
//
// GET  /api/gmail/habits            { ok, kept, looked: { conversations, written, days }, suggestions: Habit[], on: Habit[], off }
//                                   suggestions are not decided yet; `on` are the ones kept; `off` counts the ones set aside.
// GET  /api/gmail/habits?saved=1    { ok, decisions }   the kept decisions with their words, for the reply box. It reads
//                                   only the few conversations the decisions point at, never the whole of the mail.
// POST /api/gmail/habits            { id, state: "on" | "off" | "undo" }
//      "on" keeps a habit, "off" sets a suggestion aside, "undo" forgets either. What is kept is worked out here on the
//      server from the habit's id: the page cannot hand in words of its own to become "the usual reply".
//      409 when as many are kept as may be: one has to be taken back first. Nothing kept is ever dropped to make room.
//
// Nothing here sends mail or changes Gmail. Keeping a reply or a nudge lets the reply box offer the person's own words;
// the message still goes out only when they press send there. Keeping "stop showing these" adds the same kind of rule the
// inbox's Tidy up makes (shown mail only; Gmail is untouched), and undo takes that one rule away again.
//
// WHERE A DECISION IS KEPT, AND WHY IT HOLDS NO WORDS. Decisions are kept with the account (next to the ignore rules), so
// they follow the person to any browser with no new table. Everything kept there is carried in the sign-in cookie on
// every request, so a decision is only a pointer: which message of theirs the words are. The words are read back from
// the kept mail when they are needed (wordsOfMessage). A hidden sender is kept as its name alone: the address is in the
// ignore rule it made, and is found there again by that name.

const MOST_ON = 6        // usual replies and the nudge that may be kept
const MOST_HIDDEN = 12   // senders hidden from here (Tidy up in the inbox hides more)
const MOST_OFF = 8       // suggestions set aside; the oldest "not now" falls away, and that suggestion may then come back

async function decisionsOf(ctx: AuthContext): Promise<{ decisions: Decision[]; rules: IgnoreRule[]; own: string }> {
  const { data: { user } } = await ctx.supabase.auth.getUser()
  const stored = user?.user_metadata?.mail_habits
  const rules = user?.user_metadata?.gmail_ignore_rules
  return {
    decisions: Array.isArray(stored) ? stored.filter(validDecision) : [],
    rules: Array.isArray(rules) ? rules.filter(validIgnoreRule) : [],
    // The address he signs in with is his own too, connected as an inbox or not.
    own: user?.email || "",
  }
}

async function look(ctx: AuthContext, decisions: Decision[], own = "") {
  const { threads, kept } = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true })
  const mine = [...ctx.accounts.map(a => a.google_email), own].filter(Boolean)
  return { ...findHabits(threads, mine, Date.now(), decisions, TRACKING_DAYS), kept }
}

// The words each kept decision points at, read from the conversation it names: one small query, not the whole mail.
async function withWords(ctx: AuthContext, decisions: Decision[]): Promise<Kept[]> {
  const pointed = decisions.filter(d => d.thread && d.message)
  if (!pointed.length) return decisions
  let threads: HabitThread[] = []
  try {
    const rows = await ctx.supabase.from("mfit_gmail_threads").select("data").eq("user_id", ctx.userId).in("thread_id", [...new Set(pointed.map(d => d.thread!))]).limit(40)
    threads = ((rows.data || []) as Array<{ data: HabitThread }>).map(r => r.data).filter(t => Array.isArray(t?.messages))
  } catch { /* no kept copy to read: the decisions are returned without words, and nothing is offered from them */ }
  return decisions.map(d => {
    if (!d.thread || !d.message) return d
    const thread = threads.find(t => t.threadId === d.thread && (!d.account || String(t.accountEmail || "").toLowerCase() === d.account))
    const words = thread ? wordsOfMessage(thread, d.message) : null
    return words ? { ...d, ...words } : d
  })
}

// The rule a "stop showing these" made: the sender rule whose inbox and address give this habit's name.
const ruleOf = (id: string, rules: IgnoreRule[]) => rules.find(r => r.kind === "sender" && r.action !== "allow" && neverId(r.account, r.value) === id)
// Someone already hidden by a rule of the person's own is not offered for hiding again.
const hidden = (h: Habit, rules: IgnoreRule[]) => !!h.sender && rules.some(r => r.action !== "allow" && r.account === h.sender!.account
  && ((r.kind === "sender" && r.value === h.sender!.email) || (r.kind === "domain" && h.sender!.email.endsWith("@" + r.value))))

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    const { decisions, rules, own } = await decisionsOf(ctx)
    const kept = decisions.filter(d => d.state === "on")
    if (new URL(req.url).searchParams.get("saved") === "1") {
      const rl = checkRateLimit(`gmail-habits-saved:${ctx.userId}`, { max: 90, windowMs: 60 * 1000 })
      if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
      const words = kept.filter(d => d.kind !== "never_answered")
      return NextResponse.json({ ok: true, decisions: words.length ? await withWords(ctx, words) : [] })
    }
    const rl = checkRateLimit(`gmail-habits:${ctx.userId}`, { max: 20, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const found = await look(ctx, decisions, own)

    // A decision points at one message. When that message has grown too old to be among what is read, the habit is still
    // known by its name, and the pointer is moved to a message that is there, so the words can go on being read back.
    const moved = found.habits.filter(h => h.moved && h.anchor)
    if (moved.length) {
      const next = decisions.map(d => {
        const h = moved.find(x => x.id === d.id)
        return h ? { ...d, account: h.anchor!.account, thread: h.anchor!.thread, message: h.anchor!.message } : d
      })
      if (next.every(validDecision)) await ctx.supabase.auth.updateUser({ data: { mail_habits: next } }).catch(() => null)
    }

    const on = found.habits.filter(h => h.state === "on" && !(h.kind === "never_answered" && !ruleOf(h.id, rules)))
    // What was kept and has not happened lately is still kept: it is listed from the decision itself.
    const rest = kept.filter(d => !on.some(h => h.id === d.id))
    for (const d of rest.length ? await withWords(ctx, rest) : []) {
      if (d.kind === "never_answered") {
        // Its rule was taken away in the inbox's Tidy up: then the sender is shown again and there is nothing to list.
        const rule = ruleOf(d.id, rules)
        if (rule) on.push({ id: d.id, kind: d.kind, count: 0, people: 1, lastAt: 0, examples: [], state: "on", title: `Mail from ${rule.value} is not shown.`, offer: "", action: "", sender: { name: rule.value, email: rule.value, account: rule.account } })
        continue
      }
      on.push({
        id: d.id, kind: d.kind, count: 0, people: 0, lastAt: 0, examples: [], state: "on",
        title: d.kind === "chase" ? "You write a second time to people who go quiet." : "Your usual reply.",
        offer: "", action: "", ...(d.text ? { typical: d.text } : {}), ...(d.when !== undefined ? { when: d.when } : {}), ...(d.days ? { days: d.days } : {}),
      })
    }
    return NextResponse.json({
      ok: true, kept: found.kept, looked: found.looked,
      // Hidden already by a rule of the person's own, here or in Tidy up: not offered again.
      suggestions: found.habits.filter(h => (h.kind === "never_answered" ? !hidden(h, rules) && h.state !== "off" : !h.state)),
      on,
      off: decisions.filter(d => d.state === "off").length,
    })
  } catch (err) {
    console.error("gmail/habits error:", err)
    return NextResponse.json({ ok: false, error: "Your mail could not be looked through just now." }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    const rl = checkRateLimit(`gmail-habits-set:${ctx.userId}`, { max: 30, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const input = await req.json().catch(() => null) as { id?: unknown; state?: unknown } | null
    const id = typeof input?.id === "string" ? input.id.slice(0, 40) : ""
    const state = input?.state
    if (!id || (state !== "on" && state !== "off" && state !== "undo")) return NextResponse.json({ ok: false, error: "Say which habit, and on, off or undo." }, { status: 400 })

    const { decisions, rules, own } = await decisionsOf(ctx)
    const before = decisions.find(d => d.id === id)
    let next = decisions.filter(d => d.id !== id)
    let nextRules = rules
    // Only the one rule this habit made is ever taken away: a rule made by hand in Tidy up for someone else stays.
    const without = () => { const rule = ruleOf(id, rules); return rule ? rules.filter(r => r !== rule) : rules }

    if (state === "undo") {
      if (!before) return NextResponse.json({ ok: false, error: "There is nothing kept under that name." }, { status: 404 })
      if (before.kind === "never_answered" && before.state === "on") nextRules = without()
    } else {
      const { habits } = await look(ctx, decisions, own)
      const habit = habits.find(h => h.id === id)
      if (!habit) return NextResponse.json({ ok: false, error: "That is no longer something your mail shows. Reload the page." }, { status: 404 })
      const hides = habit.kind === "never_answered"
      if (state === "on") {
        // As many as may be kept are kept already: say so. Nothing the person kept is ever dropped to make room.
        const same = next.filter(d => d.state === "on" && (d.kind === "never_answered") === hides).length
        if (hides && same >= MOST_HIDDEN) return NextResponse.json({ ok: false, error: `${MOST_HIDDEN} senders are hidden from here already. Bring one back first, or use Tidy up in the inbox to hide more.` }, { status: 409 })
        if (!hides && same >= MOST_ON) return NextResponse.json({ ok: false, error: `${MOST_ON} are kept already. Take one back to keep another.` }, { status: 409 })
      }
      const pointer = habit.anchor ? { account: habit.anchor.account, thread: habit.anchor.thread, message: habit.anchor.message } : {}
      const decision: Decision = hides
        ? { id, kind: habit.kind, state }
        : state === "off"
          // Set aside: only what is needed to know the same suggestion again.
          ? { id, kind: habit.kind, state, ...(habit.kind === "same_reply" && habit.anchor ? { thread: habit.anchor.thread, message: habit.anchor.message } : {}) }
          : { id, kind: habit.kind, state, at: new Date().toISOString().slice(0, 10), ...(habit.when !== undefined ? { when: habit.when } : {}), ...(habit.days ? { days: habit.days } : {}), ...pointer }
      if (!validDecision(decision)) return NextResponse.json({ ok: false, error: "That could not be kept." }, { status: 400 })
      next = [...next, decision]
      next = [...next.filter(d => d.state === "on"), ...next.filter(d => d.state === "off").slice(-MOST_OFF)]
      if (hides && habit.sender) {
        const rule: IgnoreRule = { account: habit.sender.account, kind: "sender", value: habit.sender.email }
        if (state === "on" && !ruleOf(id, rules)) {
          if (!validIgnoreRule(rule) || rules.length >= 100) return NextResponse.json({ ok: false, error: "That sender could not be hidden. Use Tidy up in the inbox." }, { status: 400 })
          nextRules = [...rules, rule]
        }
        if (state === "off" && before?.state === "on") nextRules = without()
      }
    }

    const data: Record<string, unknown> = { mail_habits: next }
    if (nextRules !== rules) data.gmail_ignore_rules = nextRules
    const saved = await ctx.supabase.auth.updateUser({ data })
    if (saved.error) return NextResponse.json({ ok: false, error: "That could not be saved. Try again." }, { status: 500 })
    return NextResponse.json({ ok: true, id, state })
  } catch (err) {
    console.error("gmail/habits error:", err)
    return NextResponse.json({ ok: false, error: "That could not be saved. Try again." }, { status: 500 })
  }
}
