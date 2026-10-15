// POST /api/gmail/form-fill { id, account }
// A recruiter's "please fill this in" table in one conversation, filled in from what the person has sent before
// (src/lib/mail-forms.ts): the rows as they asked them, each with the answer the person last typed for that detail in
// replies from the SAME inbox, else from their profile; and the reply laid out as plain "Label: value" lines.
// A date of birth, any part of a Social Security number, a passport or other identity number is never filled and never
// read from old mail: those rows come back empty and marked `sensitive`.
// -> { ok, form: null } when their last mail holds no form, else { ok, form: { fields, summary }, reply: { subject, body } }.
// Reads the kept mail and the profile. Calls no model, stores nothing.
import { NextResponse } from "next/server"
import { requireAuth, isAuthContext, TRACKING_DAYS } from "../_lib"
import { keptThreads } from "../_kept"
import { checkRateLimit } from "@/lib/rateLimit"
import { senderEmail, senderName, ownPart, dropFooter, tidy } from "@/lib/mail-reading"
import { formIn, answersFrom, fillForm, formReply, formSummary } from "@/lib/mail-forms"

export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

export async function POST(req: Request) {
  try {
    const ctx = await requireAuth()
    if (!isAuthContext(ctx)) return NextResponse.json({ ok: false, error: ctx.error }, { status: ctx.status })
    if (!checkRateLimit(`gmail-form-fill:${ctx.userId}`, { max: 60, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "Too many requests" }, { status: 429 })
    const body = (await req.json().catch(() => ({}))) as { id?: unknown; account?: unknown }
    const id = String(body.id || "").slice(0, 200), account = String(body.account || "").trim().toLowerCase().slice(0, 200)
    if (!id) return NextResponse.json({ ok: false, error: "Which conversation?" }, { status: 400 })

    const { data: { user } } = await ctx.supabase.auth.getUser()
    const kept = await keptThreads(ctx, TRACKING_DAYS, { fetchWhenEmpty: false })
    const thread = kept.threads.find(t => t.threadId === id && (!account || t.accountEmail.toLowerCase() === account))
    if (!thread) return NextResponse.json({ ok: true, form: null }, PRIVATE)
    const inbox = thread.accountEmail.toLowerCase()
    const mine = new Set([...ctx.accounts.map(a => a.google_email.toLowerCase()), String(user?.email || "").toLowerCase()].filter(Boolean))
    // The form is looked for in the last thing THEY wrote, in their own words (not in mail they quoted).
    const theirs = [...thread.messages].sort((a, b) => Number(a.internalDate || 0) - Number(b.internalDate || 0)).filter(m => !mine.has(senderEmail(m.from))).pop()
    const fields = theirs ? formIn(theirs.bodyText ? dropFooter(tidy(ownPart(theirs.bodyText))).text : "") : []
    if (!theirs || !fields.length) return NextResponse.json({ ok: true, form: null }, PRIVATE)

    const { data: profile } = await ctx.supabase.from("profiles").select("full_name,phone,location,linkedin,visa_status,work_auth,relo_ok").eq("id", ctx.userId).maybeSingle()
    const p = (profile || {}) as { full_name?: string; phone?: string; location?: string; linkedin?: string; visa_status?: string; work_auth?: string; relo_ok?: boolean | null }
    const filled = fillForm(fields, inbox, answersFrom(kept.threads, inbox), { name: p.full_name || "", phone: p.phone || "", location: p.location || "", linkedin: p.linkedin || "", visa: p.visa_status || p.work_auth || "", relocation: p.relo_ok ?? null })
    const myName = (filled.find(f => f.key === "name")?.value || p.full_name || "").split(/\s+/)[0] || ""
    const who = senderName(theirs.from)
    const subject = /^re:/i.test(theirs.subject) ? theirs.subject : `Re: ${theirs.subject}`
    return NextResponse.json({ ok: true, form: { fields: filled, summary: formSummary(filled, who) }, reply: { subject: subject.slice(0, 180), body: formReply(filled, who, myName) } }, PRIVATE)
  } catch (err) {
    console.error("gmail/form-fill error:", err)
    return NextResponse.json({ ok: false, error: "The form could not be read just now." }, { status: 500 })
  }
}
