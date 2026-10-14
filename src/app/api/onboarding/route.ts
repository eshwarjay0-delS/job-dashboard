// The setup conversation, one question at a time (13 Oct 2026). The page only shows what this says and sends answers.
//
//   GET  -> where the person is and what the next question needs:
//           { ok, step, hello, resumeName, read, consent, phone: { verified, required, note, suggested },
//             gmail: { inboxes, canAdd }, roles: { domains, domain, branches, suggested } }
//   POST { action } -> the same answer, after:
//           "use_resume"      fill the profile with what was read from the resume (the person said yes)
//           "decline_resume"  they will fill the profile in themselves (also: no resume to hand)
//           "phone_later"     only for exempt accounts: carry on without a verified number
//           "gmail_done"      move past Gmail (inboxes are connected through Google, or left for later)
//           "roles"           { domain, branches } the kind of work and its branches
//           "finish"          setup is complete
// The resume itself is sent to POST /api/onboarding/resume. The rules are in src/lib/onboarding.ts.
import { NextRequest, NextResponse } from "next/server"
import { loadSetup, readWords, writeSetup, type Loaded } from "@/lib/onboarding-store"
import { DOMAINS, domainById, nextStep, validBranches, STEPS, type Setup } from "@/lib/onboarding"
import { getDossierProfile, saveDossierProfile } from "@/lib/dossier"
import { hashUserId } from "@/lib/sttLedger"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const PRIVATE = { headers: { "Cache-Control": "private, no-store" } }
const signIn = () => NextResponse.json({ error: "Sign in again." }, { status: 401, ...PRIVATE })

function answer(at: Loaded, setup: Setup = at.setup, facts = at.facts) {
  const first = (at.profile?.full_name || at.user.name || "").trim().split(/\s+/)[0] || ""
  return {
    ok: true, step: nextStep(setup, facts), steps: STEPS, hello: first,
    resumeOnly: ["janjiaarya@gmail.com", "tryguessup@gmail.com"].includes(at.user.email?.toLowerCase() || ""),
    // Set up already (before this conversation existed, or an admin): there is nothing to ask.
    already: facts.complete && !setup.consent,
    resumeName: setup.resumeName || "", read: setup.read || null, consent: setup.consent || "",
    // The number read from the resume is offered only after the person said the resume may be used.
    phone: { verified: facts.phoneVerified, required: facts.phoneRequired, note: at.phoneNote, whatsappNumber: at.whatsappNumber, suggested: setup.consent === "yes" ? setup.read?.phone || "" : "" },
    gmail: { inboxes: facts.inboxes, canAdd: facts.inboxes < 4 },
    roles: { domains: DOMAINS, domain: setup.domain || "", branches: setup.branches || [], suggested: setup.suggested || null },
  }
}

export async function GET() {
  const at = await loadSetup()
  if (!at) return signIn()
  return NextResponse.json(answer(at), PRIVATE)
}

export async function POST(request: NextRequest) {
  const at = await loadSetup()
  if (!at) return signIn()
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; domain?: unknown; branches?: unknown }
  const action = String(body.action || "")
  const { user, supabase } = at
  // Only the columns named are written: a column left out keeps what it holds.
  const write = (patch: Record<string, unknown>) => supabase.from("profiles").upsert({ id: user.id, email: user.email, ...patch }, { onConflict: "id" })
  let setup: Setup = at.setup
  let facts = at.facts

  if (action === "use_resume") {
    const read = setup.read
    if (!read) return NextResponse.json({ error: "Send your resume first." }, { status: 409, ...PRIVATE })
    const patch: Record<string, unknown> = {}
    // What the person already wrote is never replaced by what a file says.
    if (read.name && !at.profile?.full_name?.trim()) patch.full_name = read.name
    if (read.title && !at.profile?.title?.trim()) patch.title = read.title
    if (read.location && !at.profile?.location?.trim()) patch.location = read.location
    if (read.linkedin && !at.profile?.linkedin?.trim()) patch.linkedin = read.linkedin
    if (Object.keys(patch).length) {
      const { error } = await write(patch)
      if (error) return NextResponse.json({ error: "Your profile could not be saved just now. Try again in a moment." }, { status: 500, ...PRIVATE })
    }
    setup = { ...setup, consent: "yes" }
  } else if (action === "decline_resume") {
    setup = { ...setup, consent: "no" }
  } else if (action === "phone_later") {
    setup = { ...setup, phoneLater: true }
  } else if (action === "gmail_done") {
    setup = { ...setup, gmailDone: true }
  } else if (action === "roles") {
    const domain = String(body.domain || "")
    const branches = validBranches(domain, body.branches)
    if (!domainById(domain) || !branches.length) return NextResponse.json({ error: "Pick a kind of work and tick at least one part of it." }, { status: 400, ...PRIVATE })
    const { error } = await write({ open_to_roles: branches })
    if (error) return NextResponse.json({ error: "Your choices could not be saved just now. Try again in a moment." }, { status: 500, ...PRIVATE })
    setup = { ...setup, domain, branches }
  } else if (action === "finish") {
    const step = nextStep(setup, facts)
    if (step !== "done") return NextResponse.json({ ...answer(at), ok: false, error: "There is one more question to answer first." }, { status: 409, ...PRIVATE })
    // A name and a title are needed for the account to count as set up. When the person chose to fill their profile in
    // themselves, they start as the name on their Google account and the first kind of work they ticked; both can be
    // changed on the Profile page.
    const patch: Record<string, unknown> = { profile_complete: true, open_to_roles: setup.branches }
    if (!at.profile?.full_name?.trim()) patch.full_name = user.name || (user.email || "").split("@")[0] || "MarketFit user"
    if (!at.profile?.title?.trim()) patch.title = (setup.consent === "yes" && setup.read?.title) || (setup.branches || [])[0] || domainById(setup.domain || "")?.label || "Job seeker"
    const { error } = await write(patch)
    if (error) return NextResponse.json({ error: "Setup could not be finished just now. Try again in a moment." }, { status: 500, ...PRIVATE })
    facts = { ...facts, complete: true }
    // The person's own small dossier: what their resume shows and the kinds of work they are after. Later resumes and
    // interview sessions add to it. A failure here never holds the person at the door.
    try {
      const hash = hashUserId(user.id), words = await readWords(user.id), had = await getDossierProfile(hash)
      const join = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])].slice(0, 200)
      await saveDossierProfile(hash, { skills: join(had?.skills, words.skills), projects: had?.projects || [], keywords: join(had?.keywords, words.keywords), fields: join(had?.fields, setup.branches) })
    } catch (error) { console.error("[onboarding] dossier not written", String(error).slice(0, 200)) }
  } else {
    return NextResponse.json({ error: "Unknown action." }, { status: 400, ...PRIVATE })
  }

  if (action !== "finish") await writeSetup(user.id, setup)
  return NextResponse.json(answer(at, setup, facts), PRIVATE)
}
