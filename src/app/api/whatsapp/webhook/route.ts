/**
 * WhatsApp chatbot webhook.
 *
 * Conversation: send a JD and a .docx resume in EITHER order. As soon as the bot has
 * both, it tailors and sends the result back as "Eshwar Resume.docx", captioned with
 * the Role / Location / Company it was built for.
 *
 * The resume is sent ONCE (owner, 13 Oct 2026: "he don't have to like keep providing the baseline resume, which was a
 * major hurdle"). It is kept, and after it a job description on its own is enough. Every resume the bot makes is also
 * saved in the person's Files, in a folder named for the kind of job ("SIEM and Incident Response"); the next job of
 * that kind starts from the saved resume that already shows the most of what it asks for. See src/lib/resume-library.ts.
 *
 * WHICH EMAIL (owner, 13 Oct 2026: "WhatsApp should ask which email ... if the person can just send the JD and say
 * number one ... the type of resume would be selected from [that] library ... based on the closest match"). One email
 * is one person's profile, so when Files hold resumes under more than one, the bot asks which the job is for and never
 * guesses. The answer may come with the job description (a line of its own) or as the next message. The job then
 * starts from the closest resume of that email. A resume sent for the job is used as it is, and after every resume the
 * person is told so. See src/lib/library-pick.ts.
 *
 * NEVER THE SAME JOB TWICE (same day, with a picture of Files holding one job twice: "you already know the outcome from
 * the last time, and why do you keep repeating this stuff"). Three things, each small:
 *   1. A job description already made for that email is not made again: the resume is sent again from Files, with no
 *      AI call. "redo" makes it afresh; a resume sent for the job, or "original", does too.
 *   2. While a job is being made, the same job is not started a second time. If a resume arrives for it meanwhile, the
 *      run from that resume takes over and the earlier one stands down without sending or saving anything.
 *   3. In Files a job has one file, the newest (src/lib/resume-library.ts, "One job, one file").
 * What went wrong before: the usage record of 13 Oct shows pairs of runs five to ten seconds apart for one job (a job
 * description, then a resume arriving after the short wait), each paid for, each sent, each saved under its own name.
 *
 * WHO IS ANSWERED (same day: "the other numbers which haven't registered with our databases ... wouldn't get any
 * replies at all ... they should receive an automated message"). Only a registered number. See src/lib/whatsapp-who.ts.
 *
 * Changes: swipe-reply to any resume the bot sent and say what to change. The bot edits
 * THAT exact version (so replying to the newest file stacks changes) and sends the update,
 * which can be swipe-replied to again. A message that is NOT a reply is always a new JD.
 *
 * Serverless note: Vercel freezes a function once it responds, so the work CANNOT be
 * deferred — it runs inline and we answer 200 at the end. Meta retries a webhook it
 * considers failed, so every message id is de-duplicated before doing any work.
 */
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { createHash, randomBytes } from "crypto"
import { blob, writePath, existsPath, deletePath, readPath } from "@/lib/storage"
import { resumeEmails, cleanEmail } from "@/lib/resumeOrganization"
import { categoryForJob, isTailoredName, jobKeyOf, learnedAll, pointsOf, COMMON_AT, NO_EMAIL, type SavedFile } from "@/lib/resume-library"
import { existingForJob, forgetTailored, readLibraryChecked, relOf, saveTailored, saveUpload, type SavedTailored } from "@/lib/resume-library-store"
import { askWhichEmail, choiceIn, live, readChoice, saidOf, DIFFERENT_RESUME } from "@/lib/library-pick"
import { closestFor, keptCandidate, libraryOf, numberedEmails, type Resumes } from "@/lib/library-pick-store"
import { getDossierProfile, saveDossierProfile } from "@/lib/dossier"
import { hashUserId } from "@/lib/sttLedger"
import { claimLinkCode } from "@/lib/whatsapp-link"
import { claimNotice, resolveWhatsAppUser, textCodesWork, FALLBACK_USER_ID, type Who } from "@/lib/whatsapp-who"
import { notRegisteredMessage, siteOf, NOT_CHECKED_MESSAGE } from "@/lib/whatsapp-who-core"
import { collectHeld } from "@/lib/whatsapp-collect"
import { isPdf } from "@/lib/pdf-text"
import { copyName, wordFromPdf } from "@/lib/pdf-to-word"
import { plainFailure } from "@/lib/plain-failure"
import { recoverLibraryResume } from "@/lib/resumeRecovery"
import { extractText, extractZones } from "@/lib/docx"
import { DATA_DIR, USER_RESUMES_DIR } from "@/lib/paths"
import { resolveKeys, hasAnyKey, keysFor, tailorKeys } from "@/lib/llm"
import { runTailor, type TailorResult } from "@/lib/tailor"
import { recordTailor } from "@/lib/tailorLedger"
import { extractJdMeta } from "@/lib/claude"
import { sendText, sendDocument, downloadMedia, verifySignature, senderAllowed, waConfigured } from "@/lib/whatsapp"
import { isOwnerWhatsApp } from "@/lib/owner"
import { extractProfile } from "@/lib/profile"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

const STALE_RESUME_MS = 90_000
const RESUME_GRACE_MS = 8_000
const TAILOR_BUDGET_MS = 52_000

// The file a person gets back is named after them: "Eshwar_Resume.docx". (Owner, 2026-10-05: first "The name should always be
// Eshwar's_Resume", then, on seeing "ESHWAR's_Resume.docx" arrive, "Eshwar_Resume Title is fine actually".) The first name is
// read from the resume itself, so it is right for whoever sent it, and it is written as a name ("Eshwar") however the resume
// prints it ("ESHWAR"); when no name can be read the deployment's default name is used.
async function outputNameFor(resume: Buffer | null): Promise<string> {
  try {
    if (resume) {
      const first = String((await extractProfile(resume)).firstName || "").trim().split(/\s+/)[0] || ""
      if (/^[\p{L}][\p{L}'.-]{1,29}$/u.test(first)) return `${first[0].toUpperCase()}${first.slice(1).toLowerCase()}_Resume`
    }
  } catch { /* fall through to the default */ }
  return OUTPUT_NAME
}
const OUTPUT_NAME = process.env.WHATSAPP_OUTPUT_NAME || "MarketFit Resume"
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
// Every resume the bot sends is kept so a swipe-reply can edit that exact version. This copy lives outside the resume
// library: it is the bot's own record of what it sent, under the id of the message. (Until 13 Oct 2026 it was the ONLY
// copy, "on purpose", so nothing the bot made ever showed in Files. Now a second copy goes to Files: see `deliver`.)
const VERSIONS_DIR = path.join(DATA_DIR, "whatsapp", "versions")
const MAX_VERSIONS = Number(process.env.WHATSAPP_MAX_VERSIONS) || 30
// The resume a person sent, kept for this number alone. It is not in the shared library folder, so tidying Files can
// never move or remove it, and no other number's job can be started from it.
const BASELINE_DIR = path.join(DATA_DIR, "whatsapp", "baseline")
const UUID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i

const digits = (from: string) => from.replace(/\D/g, "")
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
const under = (dir: string, file: string) => path.resolve(file).startsWith(path.resolve(dir) + path.sep)
const userDirOf = (userId: string) => path.join(USER_RESUMES_DIR, userId)

type Meta = { role: string; company: string; location: string }
type Session = {
  jd?: string; resumePath?: string; resumeName?: string; resumeAt?: number; seen?: string[]; updatedAt?: number
  /** The one email written on the kept resume ("" when none or several): which person's folder its jobs are saved in. */
  resumeEmail?: string
  /** The last job description a resume was made for, so "original" can make it again from the resume as sent. */
  lastJd?: string
  /** True from the moment a resume is sent until a job is made from it: "send me that resume first" means the next job. */
  resumeFresh?: boolean
  /** "Which email is this job for?" was asked about the waiting job description: the emails, in the order they were numbered. */
  ask?: string[]
  /** The email chosen for the waiting job description, so sending the same one again after a failure does not ask twice. */
  email?: string
  /** The email the last job was made for, so "redo" does not have to ask. */
  lastEmail?: string
}
const sessionKey = (from: string) => `whatsapp/session-${digits(from)}.json`
// What outlives a finished job and a quiet day: the resume. Only a half-finished exchange (a job description waiting for
// its resume) is forgotten.
const kept = (s: Session): Session => ({ seen: s.seen?.slice(-40), resumePath: s.resumePath, resumeName: s.resumeName, resumeAt: s.resumeAt, resumeEmail: s.resumeEmail, lastJd: s.lastJd, lastEmail: s.lastEmail, resumeFresh: s.resumeFresh })

async function loadSession(from: string): Promise<Session> {
  try {
    const raw = await blob.getText(sessionKey(from))
    if (!raw) return {}
    const s = JSON.parse(raw) as Session
    // A job description left waiting for a day is dropped. The resume is not: it is sent once and kept.
    const ttl = Number(process.env.WHATSAPP_SESSION_TTL_MS) || 24 * 60 * 60 * 1000
    if (s.updatedAt && Date.now() - s.updatedAt > ttl) return { ...kept(s), resumeFresh: false }
    return s
  } catch { return {} }
}

async function saveSession(from: string, s: Session): Promise<void> {
  try { await blob.put(sessionKey(from), JSON.stringify({ ...s, updatedAt: Date.now() })) } catch { /* non-fatal */ }
}

// One resume the bot sent, stored under the id of that WhatsApp message — the id a
// swipe-reply carries back in `context.id`.
type Gen = {
  userId: string
  jd: string
  file: string          // this version's .docx, under VERSIONS_DIR/<sender>/
  meta: Meta
  changes: string[]     // change requests applied so far, oldest first
  source?: string       // the uploaded resume the chain started from
  createdAt: number
  saved?: string        // the copy of this version in the person's Files, when it was saved there
  depth?: number        // 1: made from a resume the person wrote; 2: made from a saved resume that was made for a job
}
const genDir = (from: string) => `whatsapp/gens/${digits(from)}`

async function recordWhatsAppUsage(userId: string, featureKey: string, result: TailorResult) {
  if (!serviceClientAvailable()) return
  try {
    const service = createServiceClient()
    await service.from("usage_events").insert({
      user_id: userId,
      source_channel: "whatsapp",
      feature_key: featureKey,
      units: 1,
      estimated_cost_usd: result.usage?.estCostUSD ?? null,
      metadata: {
        calls: result.usage?.calls ?? null,
        input_tokens: result.usage?.inputTokens ?? null,
        output_tokens: result.usage?.outputTokens ?? null,
        score: result.score,
      },
    })
  } catch { /* metering is best-effort until the GEL hard gate is enabled */ }
}
// Message ids are base64-like ("wamid.HBgL…==") and may contain "/", so hash them into a
// single safe key segment.
const genKey = (from: string, wamid: string) =>
  `${genDir(from)}/${createHash("sha1").update(wamid).digest("hex").slice(0, 24)}.json`

async function loadGen(from: string, wamid: string): Promise<Gen | null> {
  try {
    const raw = await blob.getText(genKey(from, wamid))
    return raw ? (JSON.parse(raw) as Gen) : null
  } catch { return null }
}

// Persist every newly generated resume in its authenticated account library.
// Keep the original WhatsApp version ledger independent for swipe-reply editing.
async function archiveGeneratedResume(from: string, wamid: string, gen: Gen): Promise<void> {
  // Only an explicitly bound UUID may write to the multi-tenant database.
  if (!serviceClientAvailable() || !UUID.test(gen.userId)) return
  const boundUser = (await resolveWhatsAppUser(from)).who?.userId
  if (!boundUser || boundUser !== gen.userId) return
  const bytes = await readPath(gen.file)
  if (!bytes) return
  const plain = await extractText(bytes)
  const emails = resumeEmails(plain)
  if (emails.length !== 1) return
  const email = emails[0]
  const specialization = (gen.meta.role || "General").replace(/[^a-zA-Z0-9 _-]/g, "").trim().slice(0, 65) || "General"
  const fingerprint = createHash("sha256").update(bytes).digest("hex")
  const service = createServiceClient()
  const { data: library, error: libError } = await service.from("resume_email_libraries")
    .upsert({ user_id: boundUser, email }, { onConflict: "user_id,email" }).select("id").single()
  if (libError || !library) throw libError || Error("Cannot create email library")
  let { data: folder } = await service.from("resume_specializations").select("id")
    .eq("user_id", boundUser).eq("library_id", library.id).eq("name", specialization).maybeSingle()
  if (!folder) {
    const created = await service.from("resume_specializations")
      .insert({ user_id: boundUser, library_id: library.id, name: specialization }).select("id").single()
    if (created.error) throw created.error
    folder = created.data
  }
  if (!folder) throw Error("Cannot create specialization")
  const key = [boundUser, library.id, folder.id, fingerprint + ".docx"].join("/")
  const upload = await service.storage.from("resume-library").upload(key, bytes, {
    contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true
  })
  if (upload.error) throw upload.error
  const indexed = await service.from("resume_documents").upsert({
    user_id: boundUser, library_id: library.id, specialization_id: folder.id,
    sha256: fingerprint, storage_path: key, source: "whatsapp",
    searchable_text: plain.slice(0, 50000)
  }, { onConflict: "user_id,sha256" })
  if (indexed.error) throw indexed.error
}

async function saveGen(from: string, wamid: string, gen: Gen): Promise<void> {
  const key = genKey(from, wamid)
  try { await blob.put(key, JSON.stringify(gen)) } catch { await deletePath(gen.file); return }
  try { await archiveGeneratedResume(from, wamid, gen) } catch (error) { console.error("[whatsapp] library archive failed", error) }
  // Keep the newest MAX_VERSIONS per sender; older records and their files are removed.
  try {
    const idxKey = `${genDir(from)}/_index.json`
    const idx = JSON.parse((await blob.getText(idxKey)) || "[]") as { key: string; file: string }[]
    idx.push({ key, file: gen.file })
    const drop = idx.length > MAX_VERSIONS ? idx.splice(0, idx.length - MAX_VERSIONS) : []
    await blob.put(idxKey, JSON.stringify(idx))
    await Promise.all(drop.flatMap(d => [blob.delete(d.key), deletePath(d.file)]))
  } catch { /* pruning is best-effort */ }
}

const HELP = [
  "*Resume Tailor Bot*",
  "",
  "1. Send your *resume* once, as a Word (.docx) file or a PDF. I keep it.",
  "2. Paste a *job description*. I tailor the resume to it and send it back as a Word file named after you.",
  "",
  "After the first time, the job description is all I need: I start from the closest resume saved in your *Files* in MarketFit, and save the new one there in a folder for its kind of job.",
  "",
  "*More than one email?* I ask which email the job is for. Reply with its number, or put the number on a line of its own under the job description.",
  "",
  "*A different resume?* Send me that resume first, then the job description.",
  "",
  "*Want changes?* Swipe right on a resume I sent (or long-press → Reply) and type what to change, e.g. _add more Terraform_ or _make the bullets shorter_.",
  "",
  "Commands: *status* · *original* · *redo* · *reset* · *help*",
].join("\n")

const NOT_IN_FILES = "_Not in your Files yet. In MarketFit, open WhatsApp, press Link this number, and send me the code it shows._"

// ── Meta webhook verification (GET) ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams
  const expected = (process.env.WHATSAPP_VERIFY_TOKEN || "").trim()
  if (sp.get("hub.mode") === "subscribe" && expected && sp.get("hub.verify_token") === expected) {
    return new NextResponse(sp.get("hub.challenge") || "", { status: 200 })
  }
  return new NextResponse("Forbidden", { status: 403 })
}

// ── Inbound messages (POST) ───────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  // Always 200 on the way out: a non-200 makes Meta retry, and a retry storm is worse
  // than a dropped message. Real failures are reported to the user over WhatsApp.
  const ok = () => NextResponse.json({ received: true })

  const raw = await request.text()
  if (!verifySignature(raw, request.headers.get("x-hub-signature-256"))) {
    return new NextResponse("Bad signature", { status: 401 })
  }
  if (!waConfigured()) return ok()

  let body: unknown
  try { body = JSON.parse(raw) } catch { return ok() }

  const value = (body as { entry?: { changes?: { value?: Record<string, unknown> }[] }[] })
    ?.entry?.[0]?.changes?.[0]?.value
  const msg = (value?.messages as Record<string, unknown>[] | undefined)?.[0]
  if (!msg) return ok()                       // status callbacks (delivered/read) — ignore

  const from = String(msg.from || "")
  const msgId = String(msg.id || "")
  if (!from || !senderAllowed(from)) return ok()

  const began = Date.now()
  const sender = await resolveWhatsAppUser(from)
  let who = sender.who
  // "link <code>" is how a number joins an account, so it is answered before anything asks whether it has one.
  const typed = String(msg.type || "") === "text" ? String((msg.text as { body?: string })?.body || "").trim() : ""
  const linking = typed.match(/^link[\s:#-]+([A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4})$/i)
  if (!who && !linking) {
    // Not registered: one automated message a day that says where to register, and no other reply (owner, 13 Oct 2026).
    // When the check itself failed the person is told that instead, never that they are not registered.
    const kind = sender.checked ? "unregistered" : "unchecked"
    if (await claimNotice(from, kind)) {
      try { await sendText(from, kind === "unregistered" ? notRegisteredMessage(siteOf(process.env.NEXT_PUBLIC_APP_URL, request.nextUrl.origin), await textCodesWork()) : NOT_CHECKED_MESSAGE) } catch { /* ignore */ }
    }
    return ok()
  }

  const session = await loadSession(from)
  // De-dupe: Meta re-delivers a webhook it thinks failed, and a duplicate here would
  // mean a second (slow) generation and a second document sent.
  if (msgId && session.seen?.includes(msgId)) return ok()
  session.seen = [...(session.seen || []), msgId].slice(-40)
  await saveSession(from, session)

  try {
    if (linking) who = await link(from, linking[1], who)
    else if (who) await handle(from, msg, session, who)
    // Resumes this number was sent before its account could hold them are put in Files now, once. It is skipped when
    // this message already used most of its minute, and done on the next one.
    if (who?.saves && !linking && Date.now() - began < 20_000) {
      const moved = await moveEarlierIntoFiles(from, who, began + 45_000).catch(e => { console.error("[whatsapp] earlier resumes not moved", String(e).slice(0, 200)); return 0 })
      // Said once, when it happens: the resumes made before this number had an account to save into are in Files now.
      if (moved > 0) { try { await sendText(from, `I put ${moved} resume${moved === 1 ? "" : "s"} I made for you earlier into your Files in MarketFit, each in the folder for its kind of job.`) } catch { /* ignore */ } }
    }
  } catch (e) {
    // The whole of it is for the server log. The person is told what could not be done, in a sentence (owner, 13 Oct
    // 2026: "We should not show any failpoints, at least give minimal of real info").
    console.error("[whatsapp] message failed", String(e).slice(0, 400))
    try { await sendText(from, plainFailure(e, "do that", true)) } catch { /* ignore */ }
  }
  return ok()
}

// ── Joining this number to an account, and the resumes made before it was joined ──────────────────────────────────
async function link(from: string, code: string, before: Who | null): Promise<Who | null> {
  const claim = await claimLinkCode(from, code)
  if (!claim.ok) {
    if (claim.why === "too_many") {
      if (await claimNotice(from, "link_limit")) await sendText(from, "That is five codes in an hour that did not match, so I have stopped checking for now. Try again in an hour with a new code from the WhatsApp page of MarketFit.")
      return before
    }
    await sendText(from, "That code did not match. Codes work once and for 15 minutes. Open WhatsApp in MarketFit, press Link this number for a new one, and send it as: link CODE")
    return before
  }
  const who: Who = { userId: claim.userId, own: true, saves: true }
  const moved = await moveEarlierIntoFiles(from, who, Date.now() + 40_000, true).catch(() => 0)
  await sendText(from, [
    "*Linked.* Every resume I make for this number is now saved in your Files in MarketFit, in a folder for its kind of job.",
    ...(moved ? [`I also put ${moved} resume${moved === 1 ? "" : "s"} I made for you earlier in there.`] : []),
    "Send a job description whenever you are ready.",
  ].join("\n"))
  return who
}

// The versions the bot still holds for this number (the newest MAX_VERSIONS), saved into Files once. A resume and the
// changes made to it are one job: only its newest version is kept. Safe to run again: what is saved is skipped.
async function moveEarlierIntoFiles(from: string, who: Who, until: number, again = false): Promise<number> {
  return collectHeld(from, who.userId, until, again)
}

async function handle(from: string, msg: Record<string, unknown>, session: Session, who: Who) {
  const type = String(msg.type || "")
  const userId = who.userId

  // ── Commands / change requests / JD text ────────────────────────────────────
  if (type === "text") {
    const text = String((msg.text as { body?: string })?.body || "").trim()
    const cmd = text.toLowerCase()

    if (cmd === "resumes" || cmd === "recover resume" || cmd.startsWith("resumes ")) {
      const service = createServiceClient()
      const requestedEmail = cmd.startsWith("resumes ") ? cmd.slice(8).trim() : ""
      const { data: libraries, error: libraryError } = await service.from("resume_email_libraries").select("id,email").eq("user_id", userId)
      if (libraryError) throw libraryError
      const selected = (libraries || []).filter(l => !requestedEmail || l.email === requestedEmail)
      if (!selected.length) return sendText(from, "No saved email library found in your linked account. Import your resume ZIP in My files first.")
      const { data: docs, error: docsError } = await service.from("resume_documents").select("id,library_id,specialization_id").eq("user_id", userId).in("library_id", selected.map(l => l.id)).limit(100)
      if (docsError) throw docsError
      const { data: folders } = await service.from("resume_specializations").select("id,name").eq("user_id", userId)
      const names = new Map((folders || []).map(f => [f.id, f.name]))
      const emails = new Map(selected.map(l => [l.id, l.email]))
      const lines = (docs || []).map(d => `${emails.get(d.library_id)} · ${names.get(d.specialization_id) || "Resume"}\nresume ${d.id}`)
      if (!lines.length) return sendText(from, "Your email folders are ready, but no resumes have been imported yet.")
      // Stay below Meta's text-message size cap without dropping later libraries.
      let message = "Your original resumes. Copy a resume command below to recover it.\n\n"
      for (const line of lines) {
        if (message.length + line.length > 3500) { await sendText(from, message); message = "" }
        message += line + "\n\n"
      }
      return sendText(from, message)
    }
    const recovery = text.match(/^resume\s+([a-f0-9-]{36})$/i)
    if (recovery) {
      const original = await recoverLibraryResume(userId, recovery[1])
      if (!original) return sendText(from, "That resume is not in your linked account. Send *resumes* for your available files.")
      const filename = original.filename.replace(/__[a-f0-9]{16}(?=\.docx$)/i, "")
      await sendDocument(from, original.bytes, filename, "Original saved resume. Send a job description to tailor this version.")
      if (original.filepath) {
        session.resumePath = original.filepath
        session.resumeName = filename
        session.resumeAt = Date.now()
        // Chosen for the next job, like a resume that is sent; the email on it is read again, not the last one's.
        session.resumeEmail = undefined
        session.resumeFresh = true
        session.ask = undefined
        await saveSession(from, session)
      }
      return
    }
    if (["help", "hi", "hello", "start", "menu"].includes(cmd)) return sendText(from, HELP)
    if (cmd === "reset" || cmd === "clear") {
      // The waiting job description is dropped. The resume is kept: it is sent once. "forget resume" drops it too.
      await saveSession(from, { ...kept(session), resumeFresh: false })
      return sendText(from, session.resumeName ? `Cleared. I still have your resume *${session.resumeName}*. Paste a job description when you are ready, or send *forget resume* to drop it.` : "Cleared. Send your resume as a Word (.docx) file, then a job description.")
    }
    if (cmd === "forget resume" || cmd === "forget my resume") {
      if (session.resumePath && under(path.join(BASELINE_DIR, digits(from)), session.resumePath)) await deletePath(session.resumePath).catch(() => {})
      await saveSession(from, { seen: session.seen })
      return sendText(from, "Done. I no longer have your resume. The ones already in your Files are untouched. Send a Word (.docx) file when you want me to keep a new one.")
    }
    if (cmd === "status") {
      return sendText(from, [
        `Resume: ${session.resumeName ? `${session.resumeName} (kept)` : "none yet. Send it once as a Word (.docx) file."}`,
        `Job description: ${session.jd ? (session.ask?.length ? "received. Which email is it for? Reply with its number." : "received") : "waiting"}`,
        who.saves ? "Files: every resume I make is saved in your Files in MarketFit." : "Files: not joined yet. Open WhatsApp in MarketFit and press Link this number.",
      ].join("\n"))
    }
    if (cmd === "library" || cmd === "files") return library(from, who)
    if (cmd === "original") {
      // "Original" means the original document, never silently generating another tailored resume.
      if (!session.resumePath) return sendText(from, "No original resume is kept for this number. Send *resumes* to retrieve one from your linked Files.")
      const original = await readPath(session.resumePath)
      if (!original) return sendText(from, "I could not open the original resume. Send *resumes* to retrieve one from your linked Files.")
      const name = (session.resumeName || "Original_Resume").replace(/\.docx$/i, "") + ".docx"
      return sendDocument(from, original, name, "Your original resume, unchanged. Paste a job description to tailor a new copy.")
    }
    if (cmd === "redo" || cmd === "again" || cmd === "make it again") {
      // The last job made afresh. Without this word a job that was made already is sent again as it is.
      if (!session.lastJd) return sendText(from, "Paste the job description and I will make it.")
      return generate(from, { ...session, jd: session.lastJd }, who, TAILOR_BUDGET_MS, false, { redo: true, email: session.lastEmail })
    }
    // A swipe-reply is a change request for the resume being replied to. Checked before
    // the JD path: a reply is never a new JD (new JDs are always pasted as their own message).
    const replyTo = (msg.context as { id?: string } | undefined)?.id
    // The answer to "Which email is this job for?": its number, or the address. It is read first, because people
    // answer a question by replying to it, and a reply would otherwise be taken for a change to a resume.
    const waiting = session.ask?.length && session.jd ? session.ask : null
    const answer = waiting ? choiceIn(text, waiting) : ""
    if (waiting && answer) {
      session.email = answer
      session.ask = undefined
      await saveSession(from, session)
      return generate(from, session, who, TAILOR_BUDGET_MS, false, { email: answer, slots: waiting })
    }
    // An address or option sent after the bot already started the wrong email is a correction
    // to the most recent job, not a new 1-character "job description".
    if (!waiting && who.own && text.length <= 85 && (session.jd || session.lastJd)) {
      const current = await libraryOf(userDirOf(userId))
      const slots = (await numberedEmails(userId, current.counts, await keptEmailOf(session))).slots
      const corrected = choiceIn(text, slots)
      if (corrected) {
        const jd = session.jd || session.lastJd
        if (jd) {
          session.jd = jd
          session.email = corrected
          session.ask = undefined
          session.resumeFresh = false
          await saveSession(from, session)
          return generate(from, session, who, TAILOR_BUDGET_MS, false, { email: corrected, slots, redo: true })
        }
      }
    }
    if (replyTo) return refine(from, replyTo, text, who)
    // Anything else short while the question waits: it is asked again.
    if (waiting && text.length < 60) return sendText(from, askWhichEmail(waiting))

    // Too short to be a JD — most likely a stray message, so guide instead of guessing.
    if (text.length < 60) {
      return sendText(from, `That looks too short to be a job description (${text.length} characters).\n\n${HELP}`)
    }

    // A new job description. Which email it is for may be said with it, on a line of its own ("1", "number one").
    // Only an account of the number's own is looked in: the default every unjoined number shares holds other people's.
    const lookedAt = Date.now()
    const resumes = who.own ? await libraryOf(userDirOf(userId)) : null
    const numbered = resumes ? await numberedEmails(userId, resumes.counts, await keptEmailOf(session)) : { slots: [] as string[], sure: true }
    const slots = numbered.slots
    // A number is read with the job description only when the numbering is the one this account has always had.
    const said = numbered.sure ? readChoice(text, slots) : { email: "", rest: text.trim() }
    // The same job description sent again (after a failure) keeps the email it was given.
    const again = session.jd && session.email && live(slots).includes(session.email) && jobKeyOf(session.jd) === jobKeyOf(said.rest) ? session.email : ""
    const email = said.email || again
    // For every new job with multiple email libraries, ask FIRST. Do not start from the
    // number's previous baseline resume while the user has yet to choose this job's email.
    if (who.own && live(slots).length > 1 && !email) {
      session.jd = said.rest
      session.email = undefined
      session.ask = slots
      await saveSession(from, session)
      return sendText(from, askWhichEmail(slots))
    }
    // A job description that was still waiting for its email is given up for this one, and the person is told.
    const replaced = !!(session.ask?.length && session.jd && jobKeyOf(session.jd) !== jobKeyOf(said.rest))
    session.jd = said.rest
    session.email = email || undefined
    session.ask = undefined
    await saveSession(from, session)
    const choice: Choice = { email, slots, resumes: resumes || undefined, replaced }
    const budget = () => TAILOR_BUDGET_MS - (Date.now() - lookedAt)
    if (!session.resumePath) {
      // No resume was ever sent from this number. An account of its own may already hold resumes in Files: the closest
      // one of the email is used.
      if (resumes && Object.keys(resumes.index).length) return generate(from, session, who, budget(), false, choice)
      return sendText(from, "Got the job description. Now send your resume as a Word (*.docx*) file. I keep it, so you only send it once.")
    }
    // The stored resume is from an earlier attempt and a new one is usually right behind the JD: tailoring at once ran two
    // tailors side by side (2026-10-05, 13:07), the old resume and the new one, on the same allowance. Wait briefly; if a
    // new resume lands, its own message tailors it. When the email has to be asked first nothing is tailored yet, so
    // there is nothing to wait for.
    const willAsk = live(slots).length > 1 && !email && !session.resumeFresh
    const askedAt = Date.now()
    if (!willAsk && askedAt - (session.resumeAt || 0) > STALE_RESUME_MS) {
      await new Promise(r => setTimeout(r, RESUME_GRACE_MS))
      const now = await loadSession(from)
      if ((now.resumeAt || 0) > askedAt) return
      return generate(from, { ...now, jd: said.rest }, who, budget(), false, choice)
    }
    return generate(from, session, who, budget(), false, choice)
  }

  // ── Resume upload ───────────────────────────────────────────────────────────
  if (type === "document") {
    const doc = msg.document as { id?: string; filename?: string; mime_type?: string } | undefined
    const filename = doc?.filename || "resume.docx"
    const pdf = doc?.mime_type === "application/pdf" || /\.pdf$/i.test(filename)
    if (!doc?.id || (!pdf && doc.mime_type !== DOCX && !filename.toLowerCase().endsWith(".docx"))) {
      return sendText(from, "Send your resume as a Word (*.docx*) file or a *PDF*.")
    }
    const bytes = await downloadMedia(doc.id)
    // A PDF is kept as it is, and a Word copy is made from its words: tailoring edits a Word file in place (owner, 13 Oct
    // 2026: "PDF? format in resumes?"). The copy has the same words in a plain layout, and the person is told so.
    let resume = bytes
    if (pdf) {
      if (!isPdf(bytes)) return sendText(from, "That file is named as a PDF but is not one. Please send it again.")
      if (who.saves) await saveUpload({ userDir: userDirOf(userId), bytes, filename, kind: "pdf" }).catch(() => {})
      const word = await wordFromPdf(bytes)
      if (!word) return sendText(from, `I could not read the words in that PDF (it may be a scan)${who.saves ? ", so I only kept it in your Files" : ""}. Send the same resume as a Word (*.docx*) file and I will tailor from that.`)
      resume = word.docx
    }
    // The resume this number tailors from. It is kept for this number alone, under one name per file so sending the
    // same file again replaces it.
    const safe = (pdf ? copyName(filename) : filename).replace(/[^A-Za-z0-9._\- ()]/g, "_").replace(/\.docx$/i, "") + ".docx"
    const dest = path.join(BASELINE_DIR, digits(from), safe)
    await writePath(dest, resume)
    // A copy goes to Files, as before, in its own folder: the resumes sent over WhatsApp as they were sent.
    if (who.saves) await writePath(path.join(userDirOf(userId), "WhatsApp", safe), resume).catch(() => {})

    session.resumePath = dest
    session.resumeName = safe.replace(/\.docx$/i, "")
    session.resumeAt = Date.now()
    session.resumeEmail = await emailOn(resume)
    // Sent for the next job: that job starts from this resume as it is, with no question about which email.
    session.resumeFresh = true
    session.ask = undefined
    await saveSession(from, session)
    const fromPdf = pdf ? " I made a Word copy from your PDF to work on: same words, a plain layout." : ""
    if (!session.jd) return sendText(from, `Saved *${session.resumeName}*.${fromPdf} Paste the job description and I will start from this resume. I keep it too.`)
    if (fromPdf) await sendText(from, fromPdf.trim())
    return generate(from, session, who)
  }

  return sendText(from, HELP)
}

// The one email written on a resume, or "" when there is none or more than one.
async function emailOn(bytes: Buffer): Promise<string> {
  try { const emails = resumeEmails(await extractText(bytes)); return emails.length === 1 ? emails[0] : "" } catch { return "" }
}

// "library": what the jobs of each kind keep asking for, read from the resumes saved in Files.
async function library(from: string, who: Who) {
  if (!who.saves || !who.own) return sendText(from, `Nothing is saved in Files for this number yet.\n\n${NOT_IN_FILES}`)
  const kinds = learnedAll(await readLibraryChecked(userDirOf(who.userId))).filter(k => k.files > 0)
  if (!kinds.length) return sendText(from, "Your Files hold no resumes made for a job yet. Paste a job description and the first one is saved there.")
  const lines = kinds.slice(0, 8).flatMap(k => [
    `*${k.category}*${k.email && k.email !== NO_EMAIL ? ` (${k.email})` : ""}: ${k.files} saved, ${k.jobs} job${k.jobs === 1 ? "" : "s"}`,
    ...(k.common.length ? [`Asked for by ${COMMON_AT} or more: ${k.common.slice(0, 10).map(c => c.word).join(", ")}`] : k.jobs < COMMON_AT ? [`After ${COMMON_AT} jobs of this kind I can say what they all ask for.`] : []),
    ...(k.recent.length ? [`Newest asks: ${k.recent.slice(0, 6).join(", ")}`] : []),
    "",
  ])
  return sendText(from, ["*Your library*", "", ...lines].join("\n").trim())
}

// The one email on the kept resume, read once and then remembered. "" when it has none or several, or no resume is kept.
async function keptEmailOf(session: Session): Promise<string> {
  if (!session.resumePath) return ""
  if (session.resumeEmail === undefined) session.resumeEmail = await emailOn((await readPath(session.resumePath).catch(() => null)) || Buffer.alloc(0))
  // An email remembered before 13 Oct 2026 may carry the word that ran into it ("x@gmail.comlinkedin").
  else if (session.resumeEmail) session.resumeEmail = cleanEmail(session.resumeEmail)
  return session.resumeEmail || ""
}

// Where the next resume starts from.
type Source = { dir: string; givenPath?: string; depth: number; said: string; from?: string; email?: string }
// Either a place to start, or the question that has to be answered first, or the reason there is nowhere to start.
// `have`: the resume was made for this job already, and is sent again as it is.
type Have = { abs: string; file: SavedFile; email: string }
type Start = { source: Source } | { ask: string[] } | { say: string } | { have: Have }
// What is already known about which email the job is for: the one chosen, the emails by their numbers (slots[n - 1]
// is email number n), the person's resumes when they were already read, whether a waiting job was given up for it,
// and whether the person asked for the job to be made afresh ("redo").
type Choice = { email?: string; slots?: string[]; resumes?: Resumes; replaced?: boolean; redo?: boolean }
const NO_RESUME = "I do not have a resume from you yet. Send it once as a Word (*.docx*) file and I will keep it."

// The resume this number sent and the bot kept. Null when there is none.
async function keptSource(from: string, session: Session, who: Who): Promise<Source | null> {
  const mine = path.join(BASELINE_DIR, digits(from)), userDir = userDirOf(who.userId)
  if (!session.resumePath || !(await existsPath(session.resumePath))) return null
  const said = `your resume *${session.resumeName || "as sent"}*`
  const dir = under(mine, session.resumePath) ? mine : under(userDir, session.resumePath) ? userDir : ""
  if (dir) return { dir, givenPath: session.resumePath, depth: 1, said }
  // Kept under the folder of the account this number wrote as before it was joined: brought along, once.
  const bytes = await readPath(session.resumePath)
  if (!bytes) return null
  const dest = path.join(mine, path.basename(session.resumePath))
  await writePath(dest, bytes)
  session.resumePath = dest
  return { dir: mine, givenPath: dest, depth: 1, said }
}

/**
 * 1. A resume sent for this job (or "original") is used as it is.
 * 2. Otherwise the email is settled: the one said, the only one there is, or it is asked. It is never guessed.
 * 3. Then the closest resume of that email: the one that already shows the most of what the job asks for.
 */
async function startFor(from: string, session: Session, who: Who, jd: string, original: boolean, choice: Choice): Promise<Start> {
  const userDir = userDirOf(who.userId)
  const own = await keptSource(from, session, who)
  if (own && original) return { source: own }
  const keptEmail = own ? await keptEmailOf(session) : ""
  // A resume sent for this job is used as it is. The one exception: the person said the job is for another email than
  // the one written on that resume. Then what they said wins, and the resume waits for a job of its own email.
  if (own && session.resumeFresh && (!choice.email || (keptEmail && choice.email === keptEmail))) return { source: { ...own, email: keptEmail || undefined } }
  // The default account every unjoined number shares holds other people's resumes: it is never looked through, not
  // even for the email on the resume this number sent (found in review: a resume carrying someone's email was enough
  // to be handed that person's saved resume).
  if (!who.own) return own ? { source: own } : { say: NO_RESUME }
  // Made already? One small read of that folder's record. Not asked when the person said "redo".
  const already = async (mail: string): Promise<Start | null> => {
    if (choice.redo) return null
    const had = await existingForJob(userDir, mail, jd).catch(() => null)
    return had ? { have: { abs: had.abs, file: had.file, email: mail } } : null
  }
  const resumes = choice.resumes || await libraryOf(userDir)
  const slots = choice.slots || (await numberedEmails(who.userId, resumes.counts, keptEmail)).slots
  const emails = live(slots)
  const email = choice.email && emails.includes(choice.email) ? choice.email : emails.length === 1 ? emails[0] : ""
  if (!email) {
    if (emails.length > 1) return { ask: slots }
    if (own) return (await already(keptEmail)) || { source: own }
    // No resume in Files carries an email that can be read, and none came from this number: whatever Files hold (the tailor picks).
    return Object.keys(resumes.index).length ? { source: { dir: userDir, depth: 1, said: "the closest resume in your Files" } } : { say: NO_RESUME }
  }
  // A resume with no email that can be read cannot be said to be this email's. With one email in all it is used as it
  // always was; it is never put among another email's resumes.
  if (own && !keptEmail && emails.length === 1) return (await already("")) || { source: own }
  const made = await already(email)
  if (made) return made
  const kept_ = own && keptEmail === email ? await keptCandidate({ path: own.givenPath as string, email, name: session.resumeName || "", at: session.resumeAt || 0 }) : null
  const found = await closestFor(userDir, email, jd, kept_, resumes.index, choice.redo ? jobKeyOf(jd) : "")
  if (found.pick) {
    const c = found.pick.candidate, said = saidOf(found.pick)
    if (c.kept && own) return { source: { ...own, email, said } }
    // Made from a resume the person wrote: 1. Made from a saved resume that was made for a job: 2, and never built on again.
    return { source: { dir: userDir, givenPath: c.path, depth: c.depth === 0 ? 1 : 2, from: relOf(userDir, c.path), email, said } }
  }
  const why = found.unread && !found.wrongEmail
    ? `I could not open the resumes of ${email} just now. This is on our side. Send the job description again in a minute, or`
    : found.wrongEmail
      ? `The resumes filed under ${email} carry a different email inside, so I did not use them. To go on,`
      : found.builtOnAlready
        ? `The resumes saved for ${email} were each built on another saved resume, and I do not build on those again. To go on,`
        : `I have no resume of ${email} to start from. To go on,`
  return { say: `${why} send me a resume for ${email} as a Word (*.docx*) file and I will start from it.` }
}

// A job being made right now, for one number: which job, since when, and by which run.
type Flight = { job: string; at: number; token: string }
const IN_FLIGHT_MS = 75_000
const flightKey = (from: string) => `whatsapp/making/${digits(from)}.json`
async function inFlight(from: string): Promise<Flight | null> {
  try { const raw = await blob.getText(flightKey(from)); return raw ? (JSON.parse(raw) as Flight) : null } catch { return null }
}
async function clearFlight(from: string, token: string): Promise<void> {
  try { const now = await inFlight(from); if (now && now.token === token) await blob.delete(flightKey(from)) } catch { /* it expires by its age */ }
}

/**
 * The job is done, so its description is put away. The resume stays: it is sent once. What is put away is THIS job
 * only: the session is read again first, because a minute has passed. Another job description may have arrived and be
 * waiting for its email (found in review: writing back the copy from a minute ago wiped that question), or a newer
 * resume may have been sent.
 */
async function putAway(from: string, session: Session, usedKept: boolean, email?: string): Promise<void> {
  const loaded = await loadSession(from)
  const now = loaded.seen?.length ? loaded : session
  const another = !!now.jd && jobKeyOf(now.jd) !== jobKeyOf(session.jd || "")
  const sameResume = (now.resumeAt || 0) <= (session.resumeAt || 0)
  await saveSession(from, {
    ...(another ? now : kept(now)),
    ...(sameResume ? { resumePath: session.resumePath, resumeEmail: session.resumeEmail } : {}),
    resumeFresh: sameResume && usedKept ? false : now.resumeFresh,
    lastJd: session.jd,
    lastEmail: email || undefined,
  })
}

/**
 * The resume made for this job before is sent again, as it is. No AI is asked, nothing new is saved: the outcome is
 * already known (owner, 13 Oct 2026). A copy is kept under the new message so a reply to it can still change it.
 */
async function sendAgain(from: string, session: Session, who: Who, have: Have): Promise<void> {
  const file = await readPath(have.abs)
  if (!file) { await sendText(from, "I made this one before, but its file could not be opened just now. Send *redo* and I will make it again."); return }
  const name = await outputNameFor(file)
  const when = new Date(have.file.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const caption = [
    `*${name}*`,
    ...(have.file.role ? [`Role: ${have.file.role}`] : []),
    ...(have.file.company ? [`Company: ${have.file.company}`] : []),
    "",
    `You already have this one: I made it for this job on ${when}. Nothing was made again.`,
    `In your Files: ${have.email && have.email !== NO_EMAIL ? `${have.email} / ` : ""}${have.file.category}`,
    "",
    "_Swipe-reply to this file with any changes, or send *redo* to make it afresh._",
  ].join("\n")
  await deliver(from, file, name, caption, {
    userId: who.userId, jd: session.jd as string, meta: { role: have.file.role, company: have.file.company, location: "" }, changes: [], source: session.resumeName, depth: have.file.depth, saved: have.abs,
  })
  await putAway(from, session, false, have.email)
}

// ── Tailor + reply ────────────────────────────────────────────────────────────
async function generate(from: string, session: Session, who: Who, maxMs = TAILOR_BUDGET_MS, original = false, choice: Choice = {}) {
  const userId = who.userId
  // GPT Luna leads (OPENAI_TAILOR_FOR, llm.ts), within the admin's checklist of what each key may be used for (keyVault.ts).
  const keys = await keysFor("resume-tailor", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(from) }))
  if (!hasAnyKey(keys)) return sendText(from, "I cannot tailor yet: no AI service is switched on for this. The owner of this site can switch one on from the Admin page.")
  if (!session.jd) return sendText(from, HELP)
  const lookedAt = Date.now()
  const start = await startFor(from, session, who, session.jd, original, choice)
  if ("ask" in start) {
    // Asked once for this job description. It waits in the session; the answer is a number or the address.
    session.ask = start.ask
    await saveSession(from, session)
    return sendText(from, `${choice.replaced ? "_This job description takes the place of the one that was waiting for its email._\n\n" : ""}${askWhichEmail(start.ask)}`)
  }
  if ("say" in start) return sendText(from, start.say)
  if ("have" in start) return sendAgain(from, session, who, start.have)
  const source = start.source
  // Finding the closest resume is part of this minute: the tailoring gets what is left of it.
  maxMs = Math.max(20_000, maxMs - (Date.now() - lookedAt))

  // The same job is never made twice at once. A run that brings a newer resume takes over; anything else is told the
  // job is on its way and starts nothing.
  const job = jobKeyOf(session.jd), mine = randomBytes(6).toString("hex")
  const flight = await inFlight(from)
  if (flight && flight.job === job && Date.now() - flight.at < IN_FLIGHT_MS && !((session.resumeAt || 0) > flight.at)) {
    return sendText(from, "I am already making the resume for this job. It will be with you within a minute.")
  }
  await blob.put(flightKey(from), JSON.stringify({ job, at: Date.now(), token: mine })).catch(() => {})

  await sendText(from, `${source.email ? `For *${source.email}*. ` : ""}Tailoring from ${source.said}… every client role gets its own pass, so this takes up to a minute.`)

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  const metaPromise = extractJdMeta({ keys, jd: session.jd })

  // Every generation is written down as it ends, failed ones included: the admin page counts them (src/lib/tailorLedger.ts).
  const began = Date.now()
  let result: TailorResult
  try {
    result = await runTailor({
      jd: session.jd,
      keys,
      // The folder the starting resume is in: this number's own kept resume, or the account's Files. The tailor refuses
      // a file outside the folder it is given, so a record can never point it at someone else's.
      userResumeDir: source.dir,
      givenPath: source.givenPath,
      mode: "full",
      maxMs,
      // "redo" asks for a fresh draft, so an earlier result for the same job and resume is not replayed.
      noCache: !!choice.redo,
      // Match the dashboard defaults: summary left as written, skills + experience retargeted.
      sections: { summary: false, skills: true, experience: true },
    })
    await recordTailor({ channel: "whatsapp", kind: "tailor", personId: digits(from), startedAt: began, result })
  } catch (e) {
    await clearFlight(from, mine)
    await recordTailor({ channel: "whatsapp", kind: "tailor", personId: digits(from), startedAt: began, error: e })
    // The job description and the resume stay in the session, so sending either again retries without starting over.
    console.error("[whatsapp] tailor failed", String(e).slice(0, 300))
    return sendText(from, "I could not tailor your resume just now: the AI services that write it are busy or out of their allowance. Nothing was changed. Send the job description again in a few minutes.")
  }

  // Nothing came back different: the same file with "Match 28% -> 28%" on it is not a tailored resume, so it is not sent as one.
  // (The job description and the resume stay in the session, as above.)
  if (result.unchanged) {
    await clearFlight(from, mine)
    console.error("[whatsapp] tailor changed nothing", (result.notes || []).find(n => n.startsWith("Tailored with")) || "")
    return sendText(from, "I read the job description against your resume and no line came back changed, so I am not sending you the same file. This usually means the AI services were short of capacity. Send the job description again in a few minutes.")
  }

  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) { await clearFlight(from, mine); return sendText(from, "The resume generated but the file could not be read back. Please try again.") }
  // Never deliver an altered identity: the name and contact email must remain those
  // of the exact source document selected from the user's chosen email library.
  const sourceBytes = await readPath(source.givenPath || result.matched.filepath)
  if (!sourceBytes) {
    await clearFlight(from, mine)
    return sendText(from, "The original resume could not be verified, so I did not send the generated copy.")
  }
  const [beforeZones, afterZones, beforeText, afterText] = await Promise.all([
    extractZones(sourceBytes), extractZones(file), extractText(sourceBytes), extractText(file),
  ])
  const sourceName = (beforeZones.header?.name || "").trim().replace(/\s+/g, " ")
  const outputName = (afterZones.header?.name || "").trim().replace(/\s+/g, " ")
  const baselineEmail = resumeEmails(beforeText)
  const outputEmails = resumeEmails(afterText)
  const identityChanged = !!sourceName && sourceName !== outputName
  const emailChanged = baselineEmail.length === 1 &&
    (outputEmails.length !== 1 || outputEmails[0] !== baselineEmail[0])
  const wrongLibrary = !!source.email && (baselineEmail.length !== 1 || baselineEmail[0] !== source.email)
  if (identityChanged || emailChanged || wrongLibrary) {
    await clearFlight(from, mine)
    console.error("[whatsapp] identity validation blocked generated resume", { identityChanged, emailChanged, wrongLibrary })
    return sendText(from, "I stopped this resume because the name or contact email did not match the selected original. Your original was not changed. Please choose the email again.")
  }

  // A newer run for this same job took over while this one worked (a resume arrived for it): this one stands down.
  // Nothing is sent and nothing is saved, so the person gets one resume for the job and Files gets one file.
  const still = await inFlight(from)
  if (still && still.job === job && still.token !== mine) { console.error("[whatsapp] stood down: a newer run for the same job took over"); return }

  const meta = await metaPromise
  const name = await outputNameFor(file)
  // A resume the tailor picked from Files may itself have been made for a job: what is made from it is never started from again.
  const depth = source.depth === 2 || (!source.givenPath && isTailoredName(result.matched?.filename || "")) ? 2 : 1
  const keep: Keep | undefined = who.saves ? { userDir: userDirOf(userId), depth, from: source.from, result } : undefined
  const where = who.saves ? [`Saved in your Files: ${source.email ? `${source.email} / ` : ""}${categoryForJob(session.jd)}`] : [NOT_IN_FILES]
  const started = source.depth === 2 ? ["Started from a resume saved in your Files."] : []
  await deliver(from, file, name, captionFor(name, meta, result, undefined, [...where, ...started]), { userId, jd: session.jd, meta, changes: [], source: session.resumeName, depth }, keep)
  await recordWhatsAppUsage(userId, "resume_tailor", result)

  // "Sent for the next job" ends when a job is made from that resume, not when one is made from another.
  await putAway(from, session, !!source.givenPath && source.givenPath === session.resumePath, source.email)
  await clearFlight(from, mine)
  // Said after every resume (owner, 13 Oct 2026: "after every completion of a resume, you then tell that to the user
  // as a small message"): how to start the next one from a different resume.
  try { await sendText(from, DIFFERENT_RESUME) } catch { /* ignore */ }
}

// ── Swipe-reply: change a resume the bot already sent ─────────────────────────
async function refine(from: string, replyTo: string, request: string, who: Who) {
  const userId = who.userId
  const gen = await loadGen(from, replyTo)
  if (!gen) {
    return sendText(from, [
      "To change a resume, swipe right on the *resume file* I sent and type what to change.",
      "",
      "(If that was a resume, it's no longer on file. Send the JD and resume again.)",
    ].join("\n"))
  }
  // The record was found under this number, so it is this number's. A resume made before the number was joined to an
  // account was written as the default bot user: it may still be changed. Anything else is refused.
  if (gen.userId !== userId && gen.userId !== FALLBACK_USER_ID) return sendText(from, "That resume was made under a different MarketFit account, so I cannot change it from here.")
  if (request.length < 3) {
    return sendText(from, "Tell me what to change, e.g. _add more Terraform and AWS_ or _make the bullets shorter_.")
  }
  // "save": put this exact version in Files (it was not saved when it was made, or the number was joined since). No AI.
  if (/^save(?: (?:it|this|to files|in files))?[.!]?$/i.test(request)) {
    if (!who.saves) return sendText(from, NOT_IN_FILES)
    const dir = userDirOf(userId)
    if (gen.saved && under(dir, gen.saved) && (await existsPath(gen.saved))) return sendText(from, `That one is already in your Files: ${categoryForJob(gen.jd)}.`)
    const bytes = await readPath(gen.file)
    if (!bytes) return sendText(from, "That version is no longer on file, so I cannot save it. Paste the job description again.")
    const filed = await saveTailored({ userDir: dir, bytes, jd: gen.jd, role: gen.meta?.role, company: gen.meta?.company, depth: gen.depth === 2 ? 2 : 1 })
    await blob.put(genKey(from, replyTo), JSON.stringify({ ...gen, userId, saved: filed.abs }))
    return sendText(from, `Saved in your Files: ${filed.category}.`)
  }
  const keys = await keysFor("resume-change", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(from) }))
  if (!hasAnyKey(keys)) return sendText(from, "I cannot change it yet: no AI service is switched on for this. The owner of this site can switch one on from the Admin page.")
  if (!(await existsPath(gen.file))) return sendText(from, "That version is no longer on file. Paste the job description again.")

  await sendText(from, `Updating your resume: "${clip(request, 200)}"…`)

  // The role/company/location lookup is best-effort; if it came back empty the first time,
  // retry it alongside the edit so this caption still names the job.
  const metaPromise: Promise<Meta> = gen.meta?.role || gen.meta?.company || gen.meta?.location
    ? Promise.resolve(gen.meta)
    : extractJdMeta({ keys, jd: gen.jd })

  // Summary and header title stay as they are (the dashboard default) unless the request
  // is about them; skills and experience are always open to the edit.
  const asksHeadline = /\b(title|headline|header|tagline|designation)\b/i.test(request)
  const asksSummary = /\b(summary|profile|objective|about me|intro|introduction)\b/i.test(request)

  const began = Date.now()
  const result = await runTailor({
    jd: gen.jd,
    keys,
    // Scoped to THIS sender's versions, so runTailor's inside-the-folder check also
    // guarantees a record can only ever point at the sender's own files.
    userResumeDir: path.join(VERSIONS_DIR, digits(from)),
    givenPath: gen.file,
    refine: request,
    noCache: true, // sending the same request again should redraft, not replay the last result
    mode: "full",
    sections: { headline: asksHeadline, summary: asksSummary, skills: true, experience: true },
  }).catch(async (e: unknown) => {
    await recordTailor({ channel: "whatsapp", kind: "refine", personId: digits(from), startedAt: began, error: e })
    throw e
  })
  await recordTailor({ channel: "whatsapp", kind: "refine", personId: digits(from), startedAt: began, result })

  const lines = result.diff.length + (result.edits.extras || []).filter(e => (e.text || "").trim()).length
  if (!lines) {
    return sendText(from, `Nothing needed changing for "${clip(request, 200)}". Try naming the exact skill, section, or bullet.`)
  }

  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) return sendText(from, "The update generated but the file could not be read back. Please try again.")

  const meta = await metaPromise
  const changes = [...(gen.changes || []), request]
  const name = await outputNameFor(file)
  // The changed resume takes the place of the one it changed in Files: one job, one file, the newest.
  const userDir = userDirOf(userId)
  const keep: Keep | undefined = who.saves ? { userDir, depth: gen.depth === 2 ? 2 : 1, result, replaces: gen.saved && under(userDir, gen.saved) ? gen.saved : undefined } : undefined
  await deliver(from, file, name, captionFor(name, meta, result, { request, number: changes.length, lines }, who.saves ? [`Saved in your Files: ${categoryForJob(gen.jd)}`] : []), {
    userId, jd: gen.jd, meta, changes, source: gen.source, depth: gen.depth,
  }, keep)
  await recordWhatsAppUsage(userId, "resume_refine", result)
}

// Add what a new job taught to the person's dossier: nothing already there is removed.
async function feedDossier(userId: string, filed: SavedTailored): Promise<void> {
  const hash = hashUserId(userId), had = await getDossierProfile(hash)
  const join = (a: string[] = [], b: string[] = []) => [...new Set([...a, ...b])].slice(0, 200)
  await saveDossierProfile(hash, { skills: had?.skills || [], projects: had?.projects || [], keywords: join(had?.keywords, filed.learned.common.map(c => c.word)), fields: join(had?.fields, [filed.category]) })
}

// What saving a resume into Files needs beyond the file: whose library, how it was made, and what the tailoring found.
type Keep = { userDir: string; depth: number; from?: string; result?: TailorResult; replaces?: string }

// Send the document and keep a copy of this exact version, recorded under the sent
// message's id, so a later swipe-reply to it can be traced back and edited.
async function deliver(from: string, file: Buffer, name: string, caption: string, gen: Omit<Gen, "file" | "createdAt">, keep?: Keep) {
  const vfile = path.join(VERSIONS_DIR, digits(from), `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.docx`)
  // Store the copy while the upload runs, so it costs no extra wall time.
  const stored = writePath(vfile, file).then(() => true, () => false)
  // The copy for Files is saved while the upload runs too: in the folder for this kind of job, with what the job asked
  // for counted. This is what was missing until 13 Oct 2026: the bot kept its own copy and Files never got one.
  const ka = keep?.result?.keyword_analysis
  const filing = keep
    ? saveTailored({
        userDir: keep.userDir, bytes: file, jd: gen.jd, role: gen.meta?.role, company: gen.meta?.company, depth: keep.depth, from: keep.from,
        asked: ka ? [...ka.matched, ...ka.added, ...ka.missing] : undefined, covers: ka ? [...ka.matched, ...ka.added] : undefined, points: pointsOf(keep.result?.diff),
      }).catch(e => { console.error("[whatsapp] not saved in Files", String(e).slice(0, 300)); return null })
    : Promise.resolve(null)
  let wamid = ""
  try {
    wamid = await sendDocument(from, file, `${name}.docx`, caption)
  } catch (e) {
    if (await stored) await deletePath(vfile)
    // It never reached the person, so it is not left in their Files as if it had. The resume it would have taken the
    // place of is still there: that one is only removed after a send that worked.
    const filed = await filing
    if (filed && keep) await forgetTailored(keep.userDir, filed.abs).catch(() => {})
    throw e
  }
  // The record a swipe-reply needs is written first: if the minute runs out during what follows, the person can still
  // reply to the file they hold.
  const kept_ = (await stored) && !!wamid
  if (kept_) await saveGen(from, wamid, { ...gen, file: vfile, createdAt: Date.now() })
  else if (await stored) await deletePath(vfile)
  const filed = await filing
  // The caption said where it was saved. When that did not happen, the person is told, so the caption is not left wrong.
  if (keep && !filed) { try { await sendText(from, "One thing: I could not save that resume in your Files this time. The file above is complete; swipe-reply to it with *save* and I will try again.") } catch { /* ignore */ } }
  if (!filed || !keep) return
  if (kept_) await blob.put(genKey(from, wamid), JSON.stringify({ ...gen, file: vfile, createdAt: Date.now(), saved: filed.abs })).catch(() => {})
  // A change the person asked for takes the place of the file it changed: one job, one file, the newest.
  if (keep.replaces && keep.replaces !== filed.abs) await forgetTailored(keep.userDir, keep.replaces).catch(() => {})
  // The person's own dossier grows with every new job (owner, 13 Oct 2026: it "keeps on improving with every ... resume
  // updation"): the kind of work, and what jobs of that kind keep asking for. Kompas reads the dossier when it prepares.
  if (filed.counted && UUID.test(gen.userId)) await feedDossier(gen.userId, filed).catch(e => console.error("[whatsapp] dossier not fed", String(e).slice(0, 200)))
  // What each kind of job keeps asking for is kept for the tailoring, not shown to the person (owner, 13 Oct 2026, on
  // seeing it listed in Files: "we don't need show this user as well").
}

// "Experience: 41 bullets rewritten across 4/4 roles" + the listed JD skills each role's bullets
// show: proof the JD reached every client role, not only the skills section.
function experienceLine(result: TailorResult): string[] {
  const roles = (result.role_alignment || []).filter(r => r.bullets >= 2)
  const bullets = roles.reduce((n, r) => n + r.rewritten, 0)
  const added = roles.reduce((n, r) => n + (r.added || 0), 0)
  if (!roles.length || (!bullets && !added)) return []
  const es = result.experience_skills
  return [
    `Experience: ${bullets} bullet${bullets === 1 ? "" : "s"} rewritten${added ? `, ${added} new bullet${added === 1 ? "" : "s"} added` : ""} across ${roles.filter(r => r.rewritten || r.added).length}/${roles.length} roles`,
    `Listed JD skills shown per role: ${roles.map(r => (r.required ? `${r.skills}/${r.required}` : `${r.skills}`)).join(" · ")}`,
    ...(es?.listed ? [`Listed JD skills shown in your experience: ${es.shown}/${es.listed}`] : []),
  ]
}

function captionFor(name: string, meta: Meta, result: TailorResult, update?: { request: string; number: number; lines: number }, more: string[] = []): string {
  // Measured coverage of the document being sent (older cached results lack it).
  const cov = result.coverage ?? result.keyword_analysis.coverage_after
  const added = result.keyword_analysis.added.length
  const stats = update
    ? [
        `Change: ${clip(update.request, 200)}`,
        `Keywords: ${cov}% covered`,
        `${update.lines} line${update.lines === 1 ? "" : "s"} changed`,
        ...experienceLine(result),
      ]
    : [
        `Match: ${result.score_before}% -> *${result.score}%*`,
        `Keywords: ${cov}% covered${added ? ` (+${added} added)` : ""}`,
        `${result.diff.length} lines rewritten`,
        ...experienceLine(result),
      ]
  return [
    update ? `*${name}* (update ${update.number})` : `*${name}*`,
    // Said first, before any number: part of the draft was refused by the AI services and left as it was.
    ...(result.partial ? [`_${result.partial.failed} of ${result.partial.total} parts could not be rewritten (the AI services were busy) and are unchanged. Send the job description again in a few minutes for a full pass._`] : []),
    ...(meta.role ? [`Role: ${meta.role}`] : []),
    ...(meta.company ? [`Company: ${meta.company}`] : []),
    ...(meta.location ? [`Location: ${meta.location}`] : []),
    "",
    ...stats,
    ...(more.length ? ["", ...more] : []),
    "",
    "_Swipe-reply to this file with any changes and I'll update it._",
  ].join("\n")
}
