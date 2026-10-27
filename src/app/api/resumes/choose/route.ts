// Which resume a job posting starts from, for Apply on the website: the same choice the WhatsApp bot makes
// (src/lib/library-choose.ts). Owner, 20 Oct 2026: "Give a drop down at the top after the search. The resume will be
// automatically selected and updated by automatically grabbing the JD from the job postings", "just like how WhatsApp
// resume apply is working". It reads and chooses; nothing is tailored here (POST /api/tailor with `save` does that).
//
//   POST { jd, email?, hint?, log? }
//     jd     the job posting's text (60 to 80000 characters)
//     email  the profile (an email the person's resumes carry); when it is missing, the email whose resumes fit best
//     hint   a resume by its title ("Cybersecurity Analyst"), as on WhatsApp
//     log    true: write the pick to the pick log (do this when the resume is used, not for every posting looked at)
//   -> { ok, emails: [{ email, resumes }], email, made, pick, notice }
//        made  the resume already made for this job, when there is one: { filepath, rel, name, role, company, at, category }
//        pick  { filepath, rel, name, title, folder, depth, shows, of, why, role, titled, pool }, or null
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { authenticatedUserId, signInRequired } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { live } from "@/lib/library-pick"
import { libraryOf, numberedEmails } from "@/lib/library-pick-store"
import { bestEmailFor, chooseResume, logChoice, type Choice } from "@/lib/library-choose"
import { existingForJob, relOf } from "@/lib/resume-library-store"
import { madeMeetsFloor } from "@/lib/made-floor"
import { titlesOf } from "@/lib/role-match"
import { jobKeyOf } from "@/lib/resume-library"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }

// A posting opened twice in a few minutes is chosen once: the AI agent is asked for the first look only.
const KEPT_MS = 10 * 60_000, MOST_KEPT = 200
const kept = new Map<string, { at: number; choice: Choice }>()

export async function POST(request: NextRequest) {
  const userId = await authenticatedUserId(request)
  if (!userId) return signInRequired()
  if (!checkRateLimit(`resume-choose:${userId}`, { max: 60, windowMs: 60_000 }).ok) return NextResponse.json({ ok: false, error: "That is a lot of postings in a minute. Try again shortly." }, { status: 429, ...PRIVATE })
  const body = (await request.json().catch(() => ({}))) as { jd?: unknown; email?: unknown; hint?: unknown; log?: unknown }
  const jd = typeof body.jd === "string" ? body.jd.trim() : ""
  if (jd.length < 60 || jd.length > 80_000) return NextResponse.json({ ok: false, error: "This posting has no job description to choose a resume against." }, { status: 400, ...PRIVATE })

  const userDir = path.join(USER_RESUMES_DIR, userId)
  const resumes = await libraryOf(userDir)
  const { slots } = await numberedEmails(userId, resumes.counts, "", false)
  const emails = live(slots)
  const emailList = emails.map(email => ({ email, resumes: resumes.counts[email] || 0 }))
  if (!emails.length) return NextResponse.json({ ok: true, emails: [], email: "", made: null, pick: null, notice: "Your Files hold no resume yet. Add one in My files and it will be chosen for each job." }, PRIVATE)

  const asked = typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
  const email = asked && emails.includes(asked) ? asked : await bestEmailFor(userDir, emails, jd)
  const hint = typeof body.hint === "string" ? body.hint.trim().slice(0, 80) : ""

  // Made before for this job: the outcome is known (one job, one file); it is offered, not made again, as long as it
  // still meets the 90% floor (made-floor.ts). Below it, the job is made again.
  const found = hint ? null : await existingForJob(userDir, email, jd).catch(() => null)
  const have = found && await madeMeetsFloor(found.abs, jd, found.file.at) ? found : null
  const made = have ? { filepath: have.abs, rel: relOf(userDir, have.abs), name: path.basename(have.abs).replace(/\.docx$/i, "").replace(/__[a-f0-9]{16}$/i, ""), role: have.file.role, company: have.file.company, at: have.file.at, category: have.file.category } : null

  const key = `${userId}\n${email}\n${jobKeyOf(jd)}\n${hint}`
  let hit = kept.get(key)
  if (!hit || Date.now() - hit.at > KEPT_MS) {
    // The choice is logged only when asked (the resume is being used), by a second call that finds this one kept.
    // Made again because the earlier one is below the floor: from what the person wrote, never from that copy.
    hit = { at: Date.now(), choice: await chooseResume({ userDir, userId, email, jd, prefer: hint ? { hint } : {}, log: false, ...(found && !have ? { redo: true } : {}) }) }
    kept.set(key, hit)
    if (kept.size > MOST_KEPT) kept.delete(kept.keys().next().value as string)
  }
  const choice = hit.choice

  let pick = null, notice = ""
  if (choice.kind === "ok") {
    const c = choice.picked.candidate
    pick = {
      filepath: c.path, rel: choice.rel, name: c.name, title: c.title || "", folder: c.folder, depth: c.depth, shows: choice.picked.shows, of: choice.picked.of,
      why: choice.why.replace(/^because /, ""), role: choice.role, titled: choice.titled, pool: titlesOf(choice.pool, 6),
    }
    if (body.log === true) await logChoice({ userDir, userId, email, jd, choice, ...(hint ? { hint } : {}) })
  } else if (choice.kind === "none") notice = `Your Files hold no resume of ${email} to start from.`
  else if (choice.kind === "unnamed") notice = `No resume called "${choice.hint}" under ${email}. You have: ${choice.have.join(", ")}.`
  else notice = `None of the resumes under ${email} could be opened.`
  return NextResponse.json({ ok: true, emails: emailList, email, made, pick, notice }, PRIVATE)
}
