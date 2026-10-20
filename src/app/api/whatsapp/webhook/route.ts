/**
 * WhatsApp chatbot webhook.
 *
 * Conversation (owner, 19 Oct 2026, restoring what the library was built for): send a job description. The bot asks
 * which email it is for ("1 = …05, 2 = …44", numbers kept for good; with one email it does not ask; a number on its
 * own line under the job description answers it), then starts from the closest resume of that email in the person's
 * MarketFit Files: an AI agent (Gemini) picks it from the folders, their keyword records and how often each was
 * picked, with the code's pick beside it and the two logged (src/lib/library-agent.ts). The result is sent back and
 * filed in Files in the folder for its kind of job, one job one file; a job made before is sent again as it is
 * ("redo" makes it afresh). A .docx resume sent with the job description is used instead, as before (the Oct 5 flow).
 *
 * Changes: swipe-reply to any resume the bot sent and say what to change. The bot edits
 * THAT exact version (so replying to the newest file stacks changes) and sends the update,
 * which can be swipe-replied to again. A message that is NOT a reply is always a new JD.
 *
 * Serverless note: Vercel freezes a function once it responds, so the work CANNOT be
 * deferred — it runs inline and we answer 200 at the end. Meta retries a webhook it
 * considers failed, so every message id is de-duplicated before doing any work.
 */
import { NextRequest, NextResponse, after } from "next/server"
import path from "path"
import { createHash, randomBytes } from "crypto"
import { blob, readPath, writePath, existsPath, deletePath } from "@/lib/storage"
import { DATA_DIR, USER_RESUMES_DIR } from "@/lib/paths"
import { resolveKeys, hasAnyKey, keysFor, tailorKeys } from "@/lib/llm"
import { runTailor, type TailorResult } from "@/lib/tailor"
import { extractJdMeta } from "@/lib/claude"
import { sendText as sendTextRaw, sendDocument as sendDocumentRaw, downloadMedia, verifySignature, senderAllowed, waConfigured } from "@/lib/whatsapp"
import { trace } from "@/lib/whatsapp-trace"
import { isOwnerWhatsApp } from "@/lib/owner"
import { resolveWhatsAppUser, claimNotice, textCodesWork } from "@/lib/whatsapp-who"
import { claimLinkCode } from "@/lib/whatsapp-link"
import { notRegisteredMessage, NOT_CHECKED_MESSAGE, siteOf } from "@/lib/whatsapp-who-core"
import { sameResumeIdentity } from "@/lib/resume-identity"
import { extractText } from "@/lib/docx"
import { extractProfile } from "@/lib/profile"
import { plainFailure } from "@/lib/plain-failure"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { isCertification } from "@/lib/keyword-targets"
import { libraryOf, numberedEmails, candidatesFor } from "@/lib/library-pick-store"
import { askWhichEmail, choiceIn, readChoice, live, rankFor, saidOf, DIFFERENT_RESUME, type Ranked } from "@/lib/library-pick"
import { existingForJob, saveTailored, saveUpload, markUsed, readShelf, relOf } from "@/lib/resume-library-store"
import { jobKeyOf, type SavedFile, type Uses } from "@/lib/resume-library"
import { agentPick, logPick } from "@/lib/library-agent"
import { extractKeywords } from "@/lib/keywords"
import { resumeEmails } from "@/lib/resumeOrganization"

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

// Every reply goes through these two, so the conversation trace (src/lib/whatsapp-trace.ts) holds all of it.
async function sendText(to: string, text: string) {
  trace(to, { dir: "out", kind: "text", text })
  return sendTextRaw(to, text)
}
async function sendDocument(to: string, file: Buffer, filename: string, caption: string) {
  trace(to, { dir: "out", kind: "document", file: filename, text: caption })
  return sendDocumentRaw(to, file, filename, caption)
}

const INBOX_DIR = path.join(DATA_DIR, "whatsapp", "inbox")
// A real account (a registered number), as opposed to the shared default bot user: only its resumes go to Files.
const ACCOUNT_ID = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i
const filesOf = (userId: string): string => (ACCOUNT_ID.test(userId) ? path.join(USER_RESUMES_DIR, userId) : "")
// The rewrite stops by 240 s so reading the result, checking it and sending the file (uploading it to WhatsApp) still fit
// inside the 300 s function. At 280 s only 20 s were left, and a run cut off by the platform sends nothing at all.
const TAILOR_BUDGET_MS = 240_000
// How long the first of a job post and a resume sent together waits for the other before asking for it.
// How long a job from Files holds its claim against being made twice: the function's own limit.
const IN_FLIGHT_MS = 300_000
const PAIR_WAIT_MS = process.env.WHATSAPP_PAIR_WAIT_MS !== undefined ? Number(process.env.WHATSAPP_PAIR_WAIT_MS) || 0 : 2_000

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
// Every resume the bot sends is kept so a swipe-reply can edit that exact version. It lives
// OUTSIDE the resume library on purpose: versions never appear on the dashboard (as files
// or folders) and never compete in auto-select matching.
const VERSIONS_DIR = path.join(DATA_DIR, "whatsapp", "versions")
const MAX_VERSIONS = Number(process.env.WHATSAPP_MAX_VERSIONS) || 30

const digits = (from: string) => from.replace(/\D/g, "")
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type Meta = { role: string; company: string; location: string }
type Session = {
  version?: 3; jd?: string; jdId?: string; resumePath?: string; resumeName?: string; resumeAt?: number; seen?: string[]; updatedAt?: number
  /** Where the resume sent here was filed in the person's Files (the run itself uses the inbox copy). */
  resumeFiled?: string
  /** A job description waiting for "which email is this job for?". `slots[n - 1]` is email number n. */
  pending?: { jd: string; jdId: string; slots: string[]; at: number }
  /** The last job made from Files, for "redo". */
  last?: { jd: string; email: string; at: number }
}
const sessionKey = (from: string) => `whatsapp/session-${digits(from)}.json`

async function loadSession(from: string): Promise<Session> {
  try {
    const raw = await blob.getText(sessionKey(from))
    if (!raw) return {}
    const s = JSON.parse(raw) as Session
    // Old versions kept resumes indefinitely. Do not reuse them after the rollback.
    if (s.version !== 3) return { version: 3, seen: s.seen?.slice(-40) }
    const ttl = Number(process.env.WHATSAPP_SESSION_TTL_MS) || 24 * 60 * 60 * 1000
    if (s.updatedAt && Date.now() - s.updatedAt > ttl) {
      if (s.resumePath?.startsWith(path.join(INBOX_DIR, digits(from)) + path.sep))
        await deletePath(s.resumePath).catch(() => {})
      return { version: 3, seen: s.seen?.slice(-40) }
    }
    return s
  } catch { return {} }
}

async function saveSession(from: string, s: Session): Promise<void> {
  await blob.put(sessionKey(from), JSON.stringify({ ...s, version: 3, updatedAt: Date.now() }))
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
  saved?: string        // where it was filed in the person's Files (whatsapp-collect.ts skips it then)
  depth?: number
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

async function saveGen(from: string, wamid: string, gen: Gen): Promise<void> {
  const key = genKey(from, wamid)
  try { await blob.put(key, JSON.stringify(gen)) } catch { await deletePath(gen.file); return }
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
  "Here's what I do:",
  "",
  "Paste a *job description* — I tailor your resume to it and send the file back. That's the whole loop.",
  "",
  "Send a *.docx* with the job description to start from that resume instead of your Files.",
  "",
  "*Want changes?* Reply to a resume I sent and type what to change, e.g. _add more Terraform_. Each update builds on the last.",
  "",
  "Say _use my Houston resume_ or _use my St. Louis resume_ to switch profiles.",
  "",
  "Commands: *redo* · *reset* · *status*",
].join("\n")

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

  // Preserve verified account linking from the newer release.
  const typed = String(msg.type || "") === "text" ? String((msg.text as { body?: string })?.body || "").trim() : ""
  const linking = typed.match(/^link[\s:#-]+([A-Za-z0-9]{4}[\s-]?[A-Za-z0-9]{4})$/i)
  if (linking) {
    try {
      const claim = await claimLinkCode(from, linking[1])
      if (claim.ok) await sendText(from, "Linked to MarketFit. Paste a job description: I start from the closest resume in your Files and save the result there.")
      else await sendText(from, claim.why === "too_many"
        ? "Too many incorrect link codes. Try again in an hour."
        : "That link code did not match or has expired. Open Connections in MarketFit to create another one.")
    } catch { /* Preserve the original webhook retry semantics. */ }
    return ok()
  }
  const sender = await resolveWhatsAppUser(from)
  if (!sender.who) {
    const kind = sender.checked ? "unregistered" : "unchecked"
    if (await claimNotice(from, kind)) {
      try { await sendText(from, sender.checked
        ? notRegisteredMessage(siteOf(process.env.NEXT_PUBLIC_APP_URL, request.nextUrl.origin), await textCodesWork())
        : NOT_CHECKED_MESSAGE) } catch { /* ignore */ }
    }
    return ok()
  }
  const userId = sender.who.userId

  if (!msgId) return ok()
  const receipt = createHash("sha256").update(`${from}:${msgId}`).digest("hex")
  if (!await blob.putIfAbsent(`whatsapp/receipts/${receipt}`, "1")) return ok()
  const session = await loadSession(from)
  // De-dupe: Meta re-delivers a webhook it thinks failed, and a duplicate here would
  // mean a second (slow) generation and a second document sent.
  if (msgId && session.seen?.includes(msgId)) return ok()
  session.seen = [...(session.seen || []), msgId].slice(-40)

  const doc = msg.document as { filename?: string } | undefined
  trace(from, { dir: "in", kind: String(msg.type || "unknown"), ...(typed ? { text: typed } : {}), ...(doc?.filename ? { file: doc.filename } : {}) })
  // WhatsApp is answered at once and the work goes on after it (Next's after(), kept alive up to maxDuration on Vercel).
  // Until 19 Oct 2026 the answer waited for the whole resume, minutes, and Meta re-sent what it took for a failure.
  const work = async () => {
    try {
      await handle(from, msg, session, userId)
    } catch (e) {
      try { await sendText(from, plainFailure(e, "do that", true)) } catch { /* ignore */ }
    }
  }
  if (typeof after === "function") after(work)
  else await work()
  return ok()
}

async function handle(from: string, msg: Record<string, unknown>, session: Session, userId: string) {
  const type = String(msg.type || "")

  // ── Commands / change requests / JD text ────────────────────────────────────
  if (type === "text") {
    const text = String((msg.text as { body?: string })?.body || "").trim()
    const cmd = text.toLowerCase()

    if (["help", "hi", "hello", "start", "menu"].includes(cmd)) return sendText(from, HELP)
    if (cmd === "reset" || cmd === "clear") {
      if (session.resumePath?.startsWith(path.join(INBOX_DIR, digits(from)) + path.sep))
        await deletePath(session.resumePath).catch(() => {})
      await saveSession(from, { seen: session.seen })
      return sendText(from, "Cleared. Send a new job description and resume.")
    }
    if (cmd === "redo") {
      if (!session.last) return sendText(from, "There is no job made from your Files to make again. Paste a job description.")
      return fromLibrary(from, { jd: session.last.jd, jdId: `redo-${Date.now()}` }, session.last.email, userId, true)
    }
    if (cmd === "status") {
      return sendText(from, session.pending
        ? `A job description is waiting for its email. ${askWhichEmail(session.pending.slots)}`
        : [`JD: ${session.jd ? "received" : "waiting"}`, `Resume: ${session.resumeName ? session.resumeName : "from your Files"}`].join("\n"))
    }
    const replyTo = (msg.context as { id?: string } | undefined)?.id

    // The answer to "Which email is this job for?": a number or an email, typed or swipe-replied to the question. The job
    // description is cleared with the question, so a resume sent later is never fitted to it (found in review).
    if (session.pending && text.length < 60) {
      const email = choiceIn(text, session.pending.slots)
      if (email) {
        const job = { jd: session.pending.jd, jdId: session.pending.jdId }
        const cur = await loadSession(from)
        if (cur.pending?.jdId === job.jdId) delete cur.pending
        if (cur.jdId === job.jdId) { delete cur.jd; delete cur.jdId }
        await saveSession(from, cur)
        return fromLibrary(from, job, email, userId)
      }
      if (!replyTo) return sendText(from, askWhichEmail(session.pending.slots))
    }
    // A swipe-reply is a change request for the resume being replied to. Checked before
    // the JD path: a reply is never a new JD (new JDs are always pasted as their own message).
    if (replyTo) return refine(from, replyTo, text, userId)

    // Short message that's not a command — reply conversationally, not robotically.
    if (text.length < 60) {
      const lower = text.toLowerCase()
      // Natural profile switching: "use my Houston resume", "switch to st louis", etc.
      if (/houston/.test(lower) && /resume|profile|use|switch/.test(lower)) {
        const { slots } = await emailSlots(userId)
        const houston = slots.find(s => s.includes('eshwarjay05'))
        if (houston) {
          if (session.last) session.last.email = houston
          else session.last = { jd: '', email: houston, at: Date.now() }
          await saveSession(from, session)
          return sendText(from, "Got it — I'll use your Houston resume (eshwarjay05) from now on. Send a job description whenever you're ready.")
        }
      }
      if (/st\.?\s*louis|saint louis/.test(lower) && /resume|profile|use|switch/.test(lower)) {
        const { slots } = await emailSlots(userId)
        const stl = slots.find(s => s.includes('jayeshwar44'))
        if (stl) {
          if (session.last) session.last.email = stl
          else session.last = { jd: '', email: stl, at: Date.now() }
          await saveSession(from, session)
          return sendText(from, "Got it — I'll use your St. Louis resume (jayeshwar44) from now on. Send a job description whenever you're ready.")
        }
      }
      if (/thank|thanks/.test(lower)) {
        return sendText(from, "Anytime. Send the next job description when you're ready.")
      }
      // Anything else short: friendly nudge, not a character count.
      return sendText(from, "Send me a job description and I'll tailor your resume to it. Or type *help* to see what I can do.")
    }

    session = await loadSession(from)
    session.jd = text
    session.jdId = String(msg.id)
    delete session.pending
    await saveSession(from, session)
    if (session.resumePath) return generate(from, session, userId)
    // A resume sent with the job description arrives as its own message a second or two later, and it wins: without
    // this short wait the run from Files claimed the job first and the resume was ignored without a word (found 19 Oct
    // 2026, his ask: "if the user had decided to send a resume ... just prepare the resume the usual way").
    await new Promise(r => setTimeout(r, PAIR_WAIT_MS))
    if ((await loadSession(from)).jdId !== String(msg.id)) return
    // Fast routine: JD arrives → tailor immediately with last-used resume. No waiting, no questions.
    // If a .docx arrives within a moment, it starts its own run. Otherwise we go with what we know.
    const cur0 = await loadSession(from)
    const lastEmail = cur0.last?.email || ""
    const { slots, failed } = await emailSlots(userId)
    if (failed) return sendText(from, "Got the job description, but I could not read your MarketFit Files just now. Send it again in a minute, or send your resume as a *.docx* file with it.")
    if (!live(slots).length) return sendText(from, "Got the job description. Your MarketFit Files hold no resume yet, so send your resume as a *.docx* file.")
    // Use last email silently. If never used before and multiple emails, default to the first.
    const email = lastEmail || (live(slots).length >= 1 ? live(slots)[0] : "")
    const cur = await loadSession(from)
    if (cur.jdId !== String(msg.id) || cur.resumePath) return   // a newer message or a resume took over meanwhile
    if (email) {
      delete cur.jd; delete cur.jdId
      await saveSession(from, cur)
      await sendText(from, "On it — tailoring your resume now.")
      return fromLibrary(from, { jd: text, jdId: String(msg.id) }, email, userId)
    }
    cur.pending = { jd: text, jdId: String(msg.id), slots, at: Date.now() }
    await saveSession(from, cur)
    return sendText(from, askWhichEmail(slots))
  }

  // ── Resume upload ───────────────────────────────────────────────────────────
  if (type === "document") {
    const doc = msg.document as { id?: string; filename?: string; mime_type?: string } | undefined
    const filename = doc?.filename || "resume.docx"
    if (!doc?.id || (doc.mime_type !== DOCX && !filename.toLowerCase().endsWith(".docx"))) {
      return sendText(from, "I can only read *.docx* resumes. Please export from Word and resend.")
    }
    const bytes = await downloadMedia(doc.id)
    // Temporary inbox only. Do not write originals into MarketFit Files or its resume libraries.
    const safe = filename.replace(/[^A-Za-z0-9._\- ()]/g, "_").replace(/\.docx$/i, "") + ".docx"
    const dest = path.join(INBOX_DIR, digits(from), `${randomBytes(8).toString("hex")}-${safe}`)
    await writePath(dest, bytes)
    // Filed in the person's Files too, once (the same file sent again is the same path), under the email written in it
    // and its kind of work, so a later job can start from it. Until 19 Oct 2026 a resume sent with a job description
    // never reached Files, nor did what was made from it (owner: "Files weren't saved and mapped properly").
    const filesDir = filesOf(userId)
    const kept = filesDir ? await saveUpload({ userDir: filesDir, bytes, filename: safe, kind: "docx" })
      .catch(e => { console.error("[whatsapp] resume not filed", String(e).slice(0, 200)); return null }) : null

    session = await loadSession(from)
    session.resumePath = dest
    if (kept) session.resumeFiled = kept.abs; else delete session.resumeFiled
    session.resumeName = safe.replace(/\.docx$/i, "")
    session.resumeAt = Date.now()
    await saveSession(from, session)
    if (!session.jd) {
      await new Promise(r => setTimeout(r, PAIR_WAIT_MS))
      const now = await loadSession(from)
      if (now.jd || now.resumePath !== dest) return
      return sendText(from, `Saved *${now.resumeName || session.resumeName}*. Now paste the job description.`)
    }
    return generate(from, session, userId)
  }

  return sendText(from, HELP)
}

// ── Tailor + reply ────────────────────────────────────────────────────────────
// Where a run starts when it starts from the person's Files: their folder, the email, and what was picked.
type FromFiles = { userDir: string; email: string; said: string; depth: number; rel: string; abs: string; redo?: boolean }

async function generate(from: string, session: Session, userId: string, maxMs = TAILOR_BUDGET_MS, files?: FromFiles) {
  const keys = await keysFor("resume-tailor", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(from) }))
  if (!hasAnyKey(keys)) return sendText(from, "No AI provider key is configured on the server.")
  if (!session.jd || !session.resumePath) return sendText(from, HELP)
  const retry = files ? "Send *redo* to try again." : "Please resend the job description and resume to retry."

  // One claim per JD, across all workers and either input order. Claim before any AI call.
  const job = createHash("sha256").update(`${from}:${session.jdId || session.jd}`).digest("hex")
  if (!await blob.putIfAbsent(`whatsapp/jobs/${job}`, "1")) return
  // Consume this pair now. Completion must not erase a newer request arriving meanwhile: the session is read again and
  // only what belongs to this job is cleared (a job from Files spends seconds picking before this; found in review).
  const cur = await loadSession(from)
  if (cur.jdId === session.jdId) { delete cur.jd; delete cur.jdId }
  if (cur.resumePath === session.resumePath) { delete cur.resumePath; delete cur.resumeName; delete cur.resumeAt }
  if (cur.pending?.jdId === session.jdId) delete cur.pending
  cur.seen = [...new Set([...(cur.seen || []), ...(session.seen || [])])].slice(-40)
  if (files) cur.last = { jd: session.jd, email: files.email, at: Date.now() }
  await saveSession(from, cur)

  await sendText(from, files
    ? `Updating ${files.said}. I’ll send one Word file when this run finishes.`
    : "Updating your resume. I’ll send one Word file when this run finishes.")

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  const metaPromise = extractJdMeta({ keys, jd: session.jd })

  let result: TailorResult
  try {
    result = await runTailor({
      jd: session.jd,
      keys,
      userResumeDir: files ? files.userDir : path.join(INBOX_DIR, digits(from)),
      givenPath: session.resumePath,
      mode: "full",
      maxMs,
      // "redo" asks for a fresh rewrite, not the one kept for the same inputs.
      ...(files?.redo ? { noCache: true } : {}),
      // Match the dashboard defaults: summary left as written, skills + experience retargeted.
      sections: { summary: false, skills: true, experience: true },
    })
  } catch (e) {
    // The pair was consumed before generation; a retry supplies a new pair.
    console.error("[whatsapp] tailor failed", String(e).slice(0, 300))
    return sendText(from, `I could not tailor your resume just now: the AI services that write it are busy or out of their allowance. ${retry}`)
  }

  // Nothing came back different: the same file with "Match 28% -> 28%" on it is not a tailored resume, so it is not sent as one.
  // A retry supplies a fresh JD and resume pair.
  if (result.unchanged) {
    console.error("[whatsapp] tailor changed nothing", (result.notes || []).find(n => n.startsWith("Tailored with")) || "")
    return sendText(from, `I read the job description against your resume and no line came back changed, so I am not sending you the same file. This usually means the AI services were short of capacity. ${retry}`)
  }

  // A rewrite below the coverage target is still sent, with what is missing named in the caption. From 18 Oct 2026 the
  // bot held every such file back ("below the 95% floor. I have held the file"), and nearly every real job post asks
  // for something a resume cannot truthfully claim, so the resume almost never arrived (reported 19 Oct 2026: "Resume
  // tailor on whatsapp isn't working at all"). The person decides; the caption tells them what is not covered.
  if (result.quality?.status === "needs_review") {
    // Certificates and platforms the person does not have are qualification gaps, not wording the rewrite missed.
    const UNFILLABLE = /\b(ccsp|cism|crisc|cisa|cissp|oscp|ceh|gsec|gcfa|gcia|security\+|pmp|pmi|itil|cobit|hyperledger|besu|canton|solana|ethereum|blockchain|solidity|web3|defi)\b/i
    const missing = result.quality.missing || []
    const unfillable = missing.filter(t => UNFILLABLE.test(t))
    const fillable = missing.filter(t => !UNFILLABLE.test(t))
    if (unfillable.length > 0 && fillable.length === 0) {
      result.quality = { ...result.quality, status: "delivered_with_gaps" as const,
        missing: [`Qualification gaps (not on your resume): ${unfillable.slice(0, 6).join(", ")}`] }
    }
  }
  // 95-97%: deliver with gaps noted so the user gets a usable resume, not nothing.
  const gapsNote = result.quality?.status === "delivered_with_gaps"
    ? ` Note: ${result.quality.matched}/${result.quality.total} JD terms covered. Missing: ${(result.quality.missing || []).slice(0, 8).join(", ")}.`
    : ""
  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) return sendText(from, "The resume generated but the file could not be read back. Please try again.")

  const source = await readPath(session.resumePath)
  if (!source || !sameResumeIdentity(await extractText(source), await extractText(file))) {
    return sendText(from, "The generated file changed the resume’s contact email, so I stopped delivery. Please resend your JD and resume to retry.")
  }
  const meta = await metaPromise
  const name = await outputNameFor(file)
  // Made from Files: filed back there, in the folder for its kind of job, one job one file (saveTailored).
  const more: string[] = []
  let filed: Awaited<ReturnType<typeof saveTailored>> | null = null
  // Every resume made goes to Files: from Files, back beside where it started; from a resume sent here, beside that
  // resume's filed copy. One job, one file (saveTailored).
  const filesDir = files ? files.userDir : filesOf(userId)
  if (!files && filesDir) {
    const fromRel = session.resumeFiled ? relOf(filesDir, session.resumeFiled) : undefined
    filed = await saveTailored({ userDir: filesDir, bytes: file, jd: session.jd, role: meta.role, company: meta.company, depth: 1,
      ...(fromRel && !fromRel.startsWith("..") ? { from: fromRel } : {}),
      asked: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || []), ...(result.keyword_analysis?.missing || [])],
      covers: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || [])] })
      .catch(e => { console.error("[whatsapp] not filed", String(e).slice(0, 200)); return null })
    if (filed) more.push(`Saved in your Files: ${filed.email} / ${filed.category}`)
  }
  if (files) {
    filed = await saveTailored({ userDir: files.userDir, bytes: file, jd: session.jd, role: meta.role, company: meta.company,
      depth: files.depth === 0 ? 1 : 2, from: files.rel, asked: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || []), ...(result.keyword_analysis?.missing || [])], covers: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || [])] })
      .catch(e => { console.error("[whatsapp] not filed", String(e).slice(0, 200)); return null })
    more.push(`Started from ${files.said}.`)
    if (filed) more.push(`Saved in your Files: ${filed.email} / ${filed.category}`)
    more.push(DIFFERENT_RESUME)
  }
  await deliver(from, file, name, captionFor(name, meta, result, undefined, more), { userId, jd: session.jd, meta, changes: [], source: session.resumeName,
    ...(filed ? { saved: filed.abs, depth: !files || files.depth === 0 ? 1 : 2 } : {}) })
  await recordWhatsAppUsage(userId, "resume_tailor", result)
  // Counted once the resume it started is delivered, so a failed run never makes a resume look more used.
  if (files) await markUsed(files.userDir, files.abs).catch(() => {})

  if (session.resumePath?.startsWith(path.join(INBOX_DIR, digits(from)) + path.sep))
    await deletePath(session.resumePath).catch(() => {})
}

// ── From the person's Files ─────────────────────────────────────────────────────
// The emails a person's resumes carry, numbered for good (library-pick-store.ts).
async function emailSlots(userId: string): Promise<{ slots: string[]; sure: boolean; failed: boolean }> {
  try {
    const { counts } = await libraryOf(path.join(USER_RESUMES_DIR, userId))
    const { slots, sure } = await numberedEmails(userId, counts)
    return { slots, sure, failed: false }
  } catch (e) {
    console.error("[whatsapp] library not read", String(e).slice(0, 200))
    return { slots: [], sure: false, failed: true }
  }
}

// How often each resume of these folders was picked, from the folders' records.
async function usesOf(userDir: string, email: string, ranked: Ranked[]): Promise<Uses> {
  const folders = [...new Set(ranked.map(r => r.candidate.folder).filter(f => f && !f.includes(" / ")))]
  const all: Uses = {}
  await Promise.all(folders.map(async folder => Object.assign(all, (await readShelf(userDir, email, folder).catch(() => null))?.uses || {})))
  return all
}

/** Most recently used resume path for an email, from the pick log. Simple routine: use what worked last time. */
async function recentPickFor(userDir: string, email: string): Promise<string | null> {
  // The pick log is keyed by userId, not userDir. Session.last.email reuse
  // already gives us the routine behavior, so code ranking decides.
  return null
}

/**
 * A job made from the closest resume of one email in the person's Files. Made before for this job: sent again as it is
 * (no AI, nothing new saved), unless `redo`. Otherwise the AI agent and the code each pick, the agent's pick is used
 * when it names a real resume, the file is opened and its email read once more before it is used, and the pick is
 * logged and counted.
 */
async function fromLibrary(from: string, job: { jd: string; jdId: string }, email: string, userId: string, redo = false) {
  const began = Date.now()
  const userDir = path.join(USER_RESUMES_DIR, userId)
  if (!redo) {
    const have = await existingForJob(userDir, email, job.jd).catch(() => null)
    if (have) return sendSaved(from, have, job.jd, email, userId)
  }
  // One run of a job at a time for a number: a job description pasted again, or a second "redo", while it is being made
  // would pay for the pick and the rewrite twice. The claim outlives the longest run (the function's 300 s).
  const flightKey = `whatsapp/making/${digits(from)}-${jobKeyOf(job.jd)}`
  const token = randomBytes(6).toString("hex")
  if (!(await blob.putIfAbsent(flightKey, JSON.stringify({ at: Date.now(), token })))) {
    const held = JSON.parse((await blob.getText(flightKey).catch(() => null)) || "{}") as { at?: number }
    if (held.at && Date.now() - held.at < IN_FLIGHT_MS) return sendText(from, "I am already making the resume for this job. It will arrive in this chat.")
    await blob.put(flightKey, JSON.stringify({ at: Date.now(), token }))
  }
  try {
    return await pickAndMake(from, job, email, userId, userDir, redo, began)
  } finally {
    const now = JSON.parse((await blob.getText(flightKey).catch(() => null)) || "{}") as { token?: string }
    if (now.token === token) await blob.delete(flightKey).catch(() => {})
  }
}

async function pickAndMake(from: string, job: { jd: string; jdId: string }, email: string, userId: string, userDir: string, redo: boolean, began: number) {
  const { index } = await libraryOf(userDir)
  // "redo" starts again from what the person wrote, never from the resume made for this same job (a copy of a copy).
  const candidates = (await candidatesFor(userDir, email, index)).filter(c => !redo || c.job !== jobKeyOf(job.jd))
  const { ranked } = rankFor(candidates, email, extractKeywords(job.jd))
  if (!ranked.length) return sendText(from, `Your Files hold no resume of *${email}* to start from. Send that resume as a *.docx* file with the job description.`)

  // Simple routine: use the most recently used resume for this email. No AI guessing.
  // The pick log records what was used; the newest entry wins. Falls back to code ranking.
  let picked: Ranked | null = null
  const recent = await recentPickFor(userDir, email).catch(() => null)
  if (recent) {
    const match = ranked.find(r => r.candidate.path === recent)
    if (match) picked = match
  }
  if (!picked) {
    for (const one of ranked.slice(0, 8)) {
      const bytes = await readPath(one.candidate.path).catch(() => null)
      if (!bytes) continue
      const emails = resumeEmails(await extractText(bytes).catch(() => ""))
      if (emails.length === 1 && emails[0] === email) { picked = one; break }
    }
  }
  if (!picked) return sendText(from, `I could not open a resume in your Files that carries *${email}*. Send that resume as a *.docx* file with the job description.`)

  const rel = relOf(userDir, picked.candidate.path)
  await logPick(userId, { at: Date.now(), job: jobKeyOf(job.jd), email,
    agent: null, code: rel, used: rel, agree: null })
  const budget = Math.max(120_000, TAILOR_BUDGET_MS - (Date.now() - began))
  return generate(from, { jd: job.jd, jdId: job.jdId, resumePath: picked.candidate.path, resumeName: picked.candidate.name }, userId, budget,
    { userDir, email, said: saidOf(picked), depth: picked.candidate.depth, rel, abs: picked.candidate.path, ...(redo ? { redo } : {}) })
}

// The resume made for this job before, sent again as it is: the outcome is already known (owner, 13 Oct 2026).
async function sendSaved(from: string, have: { abs: string; file: SavedFile }, jd: string, email: string, userId: string) {
  const file = await readPath(have.abs).catch(() => null)
  if (!file) return sendText(from, "I made this one before, but its file could not be opened just now. Send *redo* and I will make it again.")
  const name = await outputNameFor(file)
  const when = new Date(have.file.at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
  const caption = [
    `*${name}*`,
    ...(have.file.role ? [`${have.file.role}${have.file.company ? ` · ${have.file.company}` : ""}`] : []),
    `You already have this one: I made it for this job on ${when}, so nothing was made again.`,
    `In your Files: ${email} / ${have.file.category}`,
    "Send *redo* to make it afresh, or reply to this file with changes.",
  ].join("\n")
  const cur = await loadSession(from)
  cur.last = { jd, email, at: Date.now() }
  await saveSession(from, cur)
  await deliver(from, file, name, caption, { userId, jd, meta: { role: have.file.role, company: have.file.company, location: "" }, changes: [], source: have.file.path, saved: have.abs, depth: have.file.depth })
}

// ── Swipe-reply: change a resume the bot already sent ─────────────────────────
async function refine(from: string, replyTo: string, request: string, userId: string) {
  const gen = await loadGen(from, replyTo)
  if (!gen) {
    return sendText(from, [
      "To change a resume, swipe right on the *resume file* I sent and type what to change.",
      "",
      "(If that was a resume, it's no longer on file. Send the JD and resume again.)",
    ].join("\n"))
  }
  if (gen.userId !== userId) return sendText(from, "That resume version belongs to a different MarketFit identity.")
  if (request.length < 3) {
    return sendText(from, "Tell me what to change, e.g. _add more Terraform and AWS_ or _make the bullets shorter_.")
  }
  const keys = await keysFor("resume-change", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(from) }))
  if (!hasAnyKey(keys)) return sendText(from, "No AI provider key is configured on the server.")
  if (!(await existsPath(gen.file))) return sendText(from, "That version is no longer on file. Send the JD and resume again.")

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
  })

  const lines = result.diff.length + (result.edits.extras || []).filter(e => (e.text || "").trim()).length
  if (!lines) {
    return sendText(from, `Nothing needed changing for "${clip(request, 200)}". Try naming the exact skill, section, or bullet.`)
  }

  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) return sendText(from, "The update generated but the file could not be read back. Please try again.")

  const meta = await metaPromise
  const source = await readPath(gen.file)
  if (!source || !sameResumeIdentity(await extractText(source), await extractText(file))) {
    return sendText(from, "The update changed the resume’s contact email, so I stopped delivery. Reply to the original file to retry.")
  }
  const changes = [...(gen.changes || []), request]
  const name = await outputNameFor(file)
  await deliver(from, file, name, captionFor(name, meta, result, { request, number: changes.length, lines }), {
    userId, jd: gen.jd, meta, changes, source: gen.source,
  })
  await recordWhatsAppUsage(userId, "resume_refine", result)
}

// Send the document and keep a copy of this exact version, recorded under the sent
// message's id, so a later swipe-reply to it can be traced back and edited.
async function deliver(from: string, file: Buffer, name: string, caption: string, gen: Omit<Gen, "file" | "createdAt">) {
  const vfile = path.join(VERSIONS_DIR, digits(from), `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.docx`)
  // Store the copy while the upload runs, so it costs no extra wall time.
  const stored = writePath(vfile, file).then(() => true, () => false)
  let wamid = ""
  try {
    wamid = await sendDocument(from, file, `${name}.docx`, caption)
  } catch (e) {
    if (await stored) await deletePath(vfile)
    throw e
  }
  if (!(await stored)) return
  if (wamid) await saveGen(from, wamid, { ...gen, file: vfile, createdAt: Date.now() })
  else await deletePath(vfile)
}

// What the resume does not carry, said plainly. Since 19 Oct 2026 every job-post keyword is written in and certifications
// are ignored ("Ignore certs always"), so anything left out means the run was cut short.
function notAdded(result: TailorResult): string[] {
  const missing = (result.quality?.missing || []).filter(m => !isCertification(m))
  if (missing.length) return [`This run was cut short before it could add: ${missing.slice(0, 6).join(", ")}. Reply to this file to ask for them.`]
  return result.quality?.status === "needs_review"
    ? ["This run is incomplete: some sections did not finish rewriting. Reply to this file to ask for another pass."] : []
}

function captionFor(name: string, meta: Meta, result: TailorResult, update?: { request: string; number: number; lines: number }, more: string[] = []): string {
  const coverage = result.coverage ?? result.score
  // Never present an unchanged resume as tailored — say so plainly.
  if (result.unchanged) {
    return [
      `*${name}*${update ? ` (update ${update.number})` : ""}`,
      ...(meta.role ? [`${meta.role}${meta.company ? ` · ${meta.company}` : ""}`] : []),
      "No changes were made — the tailor couldn't improve on your resume for this JD, so this file is identical to your original.",
      "Reply to this file to request changes.",
    ].join("\n")
  }
  return [
    `*${name}*${update ? ` (update ${update.number})` : ""}`,
    ...(meta.role ? [`${meta.role}${meta.company ? ` · ${meta.company}` : ""}`] : []),
    `JD keyword coverage: ${coverage}%.`,
    ...notAdded(result),
    ...more,
    "Reply to this file to request changes.",
  ].join("\n")
}
