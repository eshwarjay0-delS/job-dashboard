// Which resume a job would start from, for the signed-in person. It reads and answers; nothing is tailored or sent,
// and the numbering of the emails is not changed unless `keep` is sent. The WhatsApp bot decides with the same code
// (src/lib/library-pick.ts), so this is how that decision is checked without sending the bot a message.
//
//   POST { jd, email?, say?, keep? }
//     keep   true: the numbers shown are kept for this account from now on, exactly as the bot keeps them at the
//            first job description. An email already numbered never moves; this only settles the first numbering.
//     jd     the job description. It may carry the choice on a line of its own ("1", "number one"), as on WhatsApp.
//     email  only this email (otherwise every email the person's resumes carry).
//     say    a reply to "Which email is this job for?", to see how it is read.
//   -> { ok, role, emails: [{ number, email, resumes }], asks, choice, question, picks: [{ email, usable, builtOnAlready, wrongEmail, unread, pick }] }
//        role      the role the post asks for ("Security Analyst"); every resume titled for it is looked at first, then the niche
//        number    the number that email keeps for good
//        asks      true when the bot would ask which email (more than one, and none said)
//        pick      { folder, name, written, shows, of }: the closest resume of that email, or null
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { askWhichEmail, choiceIn, live, readChoice } from "@/lib/library-pick"
import { closestFor, libraryOf, numberedEmails } from "@/lib/library-pick-store"
import { roleOfJob } from "@/lib/role-match"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  if (!checkRateLimit(`library-pick:${userId}`, { max: 30, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "That is a lot of checks in a minute. Try again shortly." }, { status: 429, ...PRIVATE })
  const body = (await request.json().catch(() => ({}))) as { jd?: unknown; email?: unknown; say?: unknown; keep?: unknown }
  const text = typeof body.jd === "string" ? body.jd.trim() : ""
  if (text.length < 60 || text.length > 80_000) return NextResponse.json({ ok: false, error: "Give a job description of 60 to 80000 characters." }, { status: 400, ...PRIVATE })

  const userDir = path.join(USER_RESUMES_DIR, userId)
  const resumes = await libraryOf(userDir)
  // The numbers are shown as the bot would give them. They are kept only when asked for.
  const { slots, sure } = await numberedEmails(userId, resumes.counts, "", body.keep === true)
  const emails = live(slots)
  const withJd = sure ? readChoice(text, slots) : { email: "", rest: text }
  const said = typeof body.say === "string" ? choiceIn(body.say, slots) : ""
  const asked = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const choice = (asked && emails.includes(asked) ? asked : "") || withJd.email || said || (emails.length === 1 ? emails[0] : "")
  const asks = emails.length > 1 && !choice

  const picks = []
  for (const email of (choice ? [choice] : emails).slice(0, 6)) {
    const found = await closestFor(userDir, email, withJd.rest, null, resumes.index)
    const c = found.pick?.candidate
    picks.push({
      email, usable: found.usable, builtOnAlready: found.builtOnAlready, wrongEmail: found.wrongEmail, unread: found.unread,
      pick: found.pick && c ? { folder: c.folder, name: c.name, written: c.depth === 0 ? "by you" : "for a job", shows: found.pick.shows, of: found.pick.of } : null,
    })
  }
  return NextResponse.json({
    ok: true,
    role: roleOfJob(withJd.rest),
    emails: slots.map((email, i) => ({ number: i + 1, email, resumes: resumes.counts[email] || 0 })).filter(e => e.email),
    asks, choice, question: asks ? askWhichEmail(slots) : "", picks,
  }, PRIVATE)
}
