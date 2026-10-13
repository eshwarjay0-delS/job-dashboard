// GET /api/gmail/papers?account=<one inbox, or nothing for all>
// The conversations that carry an RTR (right to represent) or a rate confirmation, for the inbox's "RTR and rate" filter:
// what they wrote in their own sentence, a form they named, whether he has answered since, who sent it, and everyone
// else in the conversation with how to reach them. Someone on his recruiter list is marked as his recruiter.
// -> { ok, kept, papers: [...], waiting, answered }. Reads the kept copy of the mail; calls no model; changes nothing.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, TRACKING_DAYS } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { papersOf } from "@/lib/mail-papers"
import { ignoreReason, validIgnoreRule, type IgnoreRule } from "@/lib/gmail-ignore"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

export const dynamic = "force-dynamic"

export async function GET(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`gmail-papers:${ctx.userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const account = (new URL(req.url).searchParams.get("account") || "").trim().toLowerCase().slice(0, 200)
    const { data: { user } } = await ctx.supabase.auth.getUser()
    const stored = user?.user_metadata?.gmail_ignore_rules
    const rules: IgnoreRule[] = Array.isArray(stored) ? stored.filter(validIgnoreRule) : []
    const [kept, recruiters] = await Promise.all([keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: true }), readRecruiters(ctx.userId)])
    const mine = [...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)
    const out = papersOf(kept.threads, mine, {
      account, recruiter: email => isMyRecruiter(recruiters, email),
      hidden: (inbox, email, threadId) => !!ignoreReason({ account: inbox, id: threadId, fromEmail: email }, rules),
    })
    return NextResponse.json({ ok: true, kept: kept.kept, ...out }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (err) {
    console.error("gmail/papers error:", err)
    return NextResponse.json({ ok: false, error: "Your mail could not be looked through just now." }, { status: 500 })
  }
}
