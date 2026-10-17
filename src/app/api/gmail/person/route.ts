// POST /api/gmail/person { q?: "mullins", email?: "tom@vendor.example" }
// The history with one person: who they are and how to reach them, each conversation by its subject with one line on how
// it went, and a sentence that sums it up. Found by address, or by words of their name (the person the words fit best
// is shown; the others they fit are offered). The words are sent in the body, so a name is never in an address or a log.
// -> { ok, person, matches, conversations, firstAt, lastAt, theirs, mine, summary }. Reads kept mail; calls no model.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, TRACKING_DAYS } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { historyWith } from "@/lib/mail-papers"
import { isMyRecruiter } from "@/lib/my-recruiters"
import { readRecruiters } from "@/lib/my-recruiters-store"

export const dynamic = "force-dynamic"

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`gmail-person:${ctx.userId}`, { max: 90, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const body = (await req.json().catch(() => ({}))) as { q?: unknown; email?: unknown; account?: unknown }
    const q = String(body.q || "").slice(0, 120), email = String(body.email || "").trim().toLowerCase().slice(0, 200)
    if (!email && q.trim().length < 2) return NextResponse.json({ ok: true, person: null, matches: [], conversations: [], summary: "" })
    const account = typeof body.account === "string" ? body.account.toLowerCase() : ""
    if (account && !ctx.accounts.some(a => a.google_email.toLowerCase() === account)) return NextResponse.json({ ok: false, error: "Inbox is not connected" }, { status: 403 })
    const { data: { user } } = await ctx.supabase.auth.getUser()
    const [kept, recruiters] = await Promise.all([keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: false }), readRecruiters(ctx.userId)])
    const mine = [...ctx.accounts.map(a => a.google_email), user?.email || ""].filter(Boolean)
    const history = historyWith(kept.threads.filter(t => !account || t.accountEmail.toLowerCase() === account), mine, email ? { email } : { q }, Date.now(), { recruiter: e => isMyRecruiter(recruiters, e) })
    return NextResponse.json({ ok: true, ...history }, { headers: { "Cache-Control": "private, no-store" } })
  } catch (err) {
    console.error("gmail/person error:", err)
    return NextResponse.json({ ok: false, error: "The history could not be read just now." }, { status: 500 })
  }
}
