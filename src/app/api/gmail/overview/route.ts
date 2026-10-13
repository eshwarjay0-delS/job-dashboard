import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, jdFitScore, TRACKING_DAYS } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { overviewOf } from "@/lib/mail-overview"
import { findHabits, validDecision } from "@/lib/mail-habits"
import { ignoreReason, validIgnoreRule, type IgnoreRule } from "@/lib/gmail-ignore"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

// GET /api/gmail/overview?account=<one inbox, or nothing for all>
// Overview with the dots connected (src/lib/mail-overview.ts): where every started application stands and what to do
// next about each, the few that matter most on top with the reasons said, a contact box for everyone who wrote, who is
// suggested for hiding (they keep writing and were never answered: src/lib/mail-habits.ts), and who is hidden already.
// It reads the kept copy of the mail and the person's own ignore rules. It calls no model and changes nothing: hiding
// and showing again go through /api/gmail/ignore-rules, the same rules the inbox's Tidy up keeps.
// Output { ok, kept, looked, nudgeAfterDays, nudgeKept, highlights, needsYou, goneQuiet, moving (each conversation with
//          `nudgeReady`), counts, people (each
//          with `hidden`), suggestHide: [{ name, email, account, count }], hidden: [{ account, kind, value }] }

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    const rl = checkRateLimit(`gmail-overview:${ctx.userId}`, { max: 20, windowMs: 60 * 1000 })
    if (!rl.ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })

    const account = (new URL(req.url).searchParams.get("account") || "").trim().toLowerCase().slice(0, 200)
    const { data: { user } } = await ctx.supabase.auth.getUser()
    const storedRules = user?.user_metadata?.gmail_ignore_rules
    const rules: IgnoreRule[] = Array.isArray(storedRules) ? storedRules.filter(validIgnoreRule) : []
    const storedHabits = user?.user_metadata?.mail_habits
    const decisions = Array.isArray(storedHabits) ? storedHabits.filter(validDecision) : []

    // The people who work for him (his own list): no nudge is ever said to be due to them, and whoever they write to is
    // shown as the one to watch (src/lib/my-recruiters.ts).
    const recruiters = await readRecruiters(ctx.userId)

    const kept = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true })
    // All the mail is read whichever inbox is shown: someone answered from another inbox is answered, and how long he
    // waits before writing again is one habit, not one per inbox. Only what is shown is kept to the inbox chosen.
    const threads = kept.threads
    // His own addresses: every inbox he has connected, and the address he signs in with. A mail from one of his own
    // addresses to another is not a person who wrote to him.
    const mine = [...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)
    const now = Date.now()

    // How long he himself waits before writing again, and who he never answers: both from his own mail.
    const habits = findHabits(threads, mine, now, decisions, TRACKING_DAYS).habits
    const chase = habits.find(h => h.kind === "chase")
    // Hidden means what the inbox means by it: the same rules read the same way (a rule for one conversation first, and
    // "Bring it back" wins), so what he hid there is not put on top here and what he brought back is not left out.
    const hiddenBy = (inbox: string, email: string, threadId = "") => !!ignoreReason({ account: inbox, id: threadId, fromEmail: email }, rules)
    // How close each conversation is to the work he looks for: the same score the inbox shows.
    const fit = new Map<string, number>()
    for (const t of threads) {
      const latest = t.messages[t.messages.length - 1]
      const titled = [...t.messages].reverse().find(m => m.jobTitle)
      if (latest) fit.set(t.threadId, jdFitScore(titled?.jobTitle || "", latest.subject, latest.snippet).score)
    }

    const o = overviewOf(threads, mine, now, { nudgeAfterDays: chase?.days, fit: id => fit.get(id), hidden: hiddenBy, account, recruiter: email => isMyRecruiter(recruiters, email) })
    // His kept nudge is offered in the reply box only when the last word is his and the silence has reached the days
    // kept with it. Each conversation is told which it is, so the page never promises words that will not be there.
    const nudge = decisions.find(d => d.kind === "chase" && d.state === "on" && !!d.message)
    const ready = <T extends { lastMine: boolean; quietDays: number; action: string }>(s: T) => ({ ...s, nudgeReady: !!nudge && s.action !== "reply" && s.lastMine && s.quietDays >= (nudge.days || 1) })
    return NextResponse.json({
      ok: true, kept: kept.kept, ...o,
      highlights: o.highlights.map(ready), needsYou: o.needsYou.map(ready), goneQuiet: o.goneQuiet.map(ready), moving: o.moving.map(ready),
      nudgeKept: !!nudge,
      recruiters,
      people: o.people.map(p => ({ ...p, hidden: hiddenBy(p.account, p.email) })),
      suggestHide: habits.filter(h => h.kind === "never_answered" && h.sender && h.state !== "off" && (!account || h.sender.account === account) && !hiddenBy(h.sender.account, h.sender.email))
        .map(h => ({ name: h.sender!.name, email: h.sender!.email, account: h.sender!.account, count: h.count })),
      hidden: rules.filter(r => r.action !== "allow" && (r.kind === "sender" || r.kind === "domain") && (!account || r.account === account)).map(r => ({ account: r.account, kind: r.kind, value: r.value })),
    })
  } catch (err) {
    console.error("gmail/overview error:", err)
    return NextResponse.json({ ok: false, error: "Your mail could not be looked through just now." }, { status: 500 })
  }
}
