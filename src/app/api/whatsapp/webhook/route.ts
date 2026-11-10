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
 * Serverless note: after(work) keeps processing alive within the 300-second function limit, but a timeout can still
 * interrupt it. Initial-JD and swipe-reply work is persisted before slow generation; the authenticated recovery route
 * resumes only safe pending jobs. Meta retries are de-duplicated by inbound message id, and accepted/uncertain document
 * sends wait for signed delivery reconciliation instead of being resent.
 */
import { NextRequest, NextResponse, after } from "next/server"
import path from "path"
import { createHash, randomBytes } from "crypto"
import { blob, readPath, writePath, existsPath, deletePath, keyOf } from "@/lib/storage"
import { DATA_DIR, USER_RESUMES_DIR } from "@/lib/paths"
import { resolveKeys, hasAnyKey, keysFor, tailorKeys } from "@/lib/llm"
import { runTailor, type TailorResult } from "@/lib/tailor"
import { extractJdMeta } from "@/lib/claude"
import { sendText as sendTextRaw, sendDocument as sendDocumentRaw, downloadMedia, verifySignature, senderAllowed, waConfigured, waSignatureConfigured } from "@/lib/whatsapp"
import { recordUpdateProviderStatus } from "@/lib/mail-update-store"
import { trace } from "@/lib/whatsapp-trace"
import { isOwnerWhatsApp } from "@/lib/owner"
import { resolveWhatsAppUser, claimNotice, textCodesWork } from "@/lib/whatsapp-who"
import { claimLinkCode } from "@/lib/whatsapp-link"
import { notRegisteredMessage, NOT_CHECKED_MESSAGE, siteOf } from "@/lib/whatsapp-who-core"
import { sameResumeIdentity } from "@/lib/resume-identity"
import { docxIdentityText } from "@/lib/resume-round-trip-guard"
import { extractText } from "@/lib/docx"
import { handleWhatsAppKompas } from "@/lib/whatsapp-kompas-channel"
import { speechToWhatsAppText } from "@/lib/whatsapp-voice"
import { extractProfile } from "@/lib/profile"
import { plainFailure } from "@/lib/plain-failure"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { isCertification } from "@/lib/keyword-targets"
import { riskScore } from "@/lib/resume-risk"
import { libraryOf, numberedEmails, candidatesFor } from "@/lib/library-pick-store"
import { askWhichEmail, choiceIn, readChoice, live, rankFor, saidOf, DIFFERENT_RESUME } from "@/lib/library-pick"
import { existingForJob, saveTailored, saveUpload, markUsed, relOf } from "@/lib/resume-library-store"
import { madeMeetsFloor } from "@/lib/made-floor"
import { acceptableWhatsAppResume, chosenResumeMatchesProfile, describeRejectionReasons, whatsappResumeRejectionReasons, whatsappRewriteUsable } from "@/lib/whatsapp-resume-acceptance"
import { confirmedCandidateStatements } from "@/lib/resume-evidence"
import { enqueueResumeRecovery, enqueueResumeRefinement, patchResumeRecovery, patchResumeRefinement, deferResumeRecovery, deferResumeRefinement, dueResumeRecoveries, dueResumeRefinements, claimResumeRefinement, hasResumeRecoveryForJD, markResumeDocumentAccepted, recordResumeDeliveryStatus, readResumeRecovery } from "@/lib/whatsapp-resume-recovery"
import { recoveryTailorBudget, RECOVERY_MIN_TAILOR_MS } from "@/lib/whatsapp-recovery-budget"
import { jobKeyOf, type SavedFile } from "@/lib/resume-library"
import { readPicks } from "@/lib/library-agent"
import { chooseResume, type Prefer } from "@/lib/library-choose"
import { uploadStale, classifyInboundResume, freshUploadBlocksLibrary, pdfLines, textToResumeDocx, unreadableResumeReply } from "@/lib/whatsapp-upload-age"
import { titlesOf, parseInstruction, parseQuestion, splitTailInstruction, type Instruction } from "@/lib/role-match"
import { getApprovalCard, saveApprovalCard, parseCardButton, deliverApprovalCard, sendGmailDraft, updateGmailDraft, deleteGmailDraft, sendLocked, keepOpenFlags } from "@/lib/chief-approvals"
// The first words the Chief answers; the module itself is loaded only when one is sent.
const CHIEF_WORDS = /^(?:my\s+|new\s+)?(?:brief|goal|jobs|never[\s-]+contact|chief\s*[,:])/i

export const runtime = "nodejs"
export const maxDuration = 300
export const dynamic = "force-dynamic"

// Every reply goes through these two, so the conversation trace (src/lib/whatsapp-trace.ts) holds all of it.
async function sendText(to: string, text: string) {
  trace(to, { dir: "out", kind: "text", text })
  return sendTextRaw(to, text)
}
async function sendDocument(to: string, file: Buffer, filename: string, caption: string, opaqueJobId?: string) {
  trace(to, { dir: "out", kind: "document", file: filename, text: caption })
  return sendDocumentRaw(to, file, filename, caption, opaqueJobId)
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
  pending?: { jd: string; jdId: string; slots: string[]; at: number; hint?: string }
  /** The last job made from Files, for "redo" and "make another one with the X resume". `used`: the resume it started from. */
  last?: { jd: string; email: string; at: number; used?: string }
  /** Current profile selection; never rewrites the immutable last JD/source for recovery. */
  preferredEmail?: string
  /** Approval card awaiting the owner's edited draft text (Phase 4, chief-approvals). */
  awaitingEditCardId?: string
  /** The newest photo or PDF could not be read as text, so the older resume must not be tailored. */
  resumeBlocked?: "image" | "pdf"
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
  held?: boolean        // saved from a hold: a reply re-runs from the baseline and the quality gate applies again
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
  "I ask once which email a job is for and remember it. Reply *use 1* or *use 2* any time to switch.",
  "",
  "I start from the resume whose title is the job's. To choose another, say _make another one with the Cybersecurity Analyst resume_, or end the job description with a line such as _use the SOC resume_. Ask _why did you pick that resume?_ or _what resumes do I have?_ any time.",
  "",
  "🎙️ *Voice:* Send a WhatsApp voice note to dictate a message or job description. It is transcribed after you send. For instant phone-side transcription, use the keyboard microphone instead.",
  "",
  "*Kompas interview mode:* Type or say *kompas*, send resume and JD in either order, then type or speak interview questions. Type or say *revert* to go back to resume tailoring.",
  "",
  "Commands: *redo* · *reset* · *status* · *kompas* · *revert*",
  "",
  "*Your Chief:* *brief* shows the brief I read before every job · *goal:* _watch my submissions tonight_ and I propose the jobs for your yes · *jobs* lists what is scheduled · *never contact:* _a name or a domain_.",
].join("\n")

// ── Meta webhook verification (GET) ───────────────────────────────────────────
export async function GET(request: NextRequest) {
  if (/\/recover\/?$/.test(request.nextUrl.pathname)) return recoverResumeJobs(request)
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
  const statuses = (value?.statuses as Record<string, unknown>[] | undefined) || []
  if (statuses.length) {
    // Never turn an unsigned public request into delivered/read evidence.
    if (!waSignatureConfigured()) return ok()
    await Promise.all(statuses.slice(0, 20).map(status => {
      const id = String(status.id || "")
      const state = String(status.status || "") as "sent" | "delivered" | "read" | "failed"
      const seconds = Number(status.timestamp)
      const firstError = (status.errors as { code?: number; title?: string }[] | undefined)?.[0]
      const reason = state === "failed" ? [firstError?.code, firstError?.title].filter(Boolean).join(": ") : ""
      return Promise.all([
        recordUpdateProviderStatus(id, state, Number.isFinite(seconds) ? seconds * 1000 : Date.now(), reason),
        recordResumeDeliveryStatus(id, state, String(status.biz_opaque_callback_data || "")).catch(() => {}),
      ])
    }))
    return ok()
  }
  const msg = (value?.messages as Record<string, unknown>[] | undefined)?.[0]
  if (!msg) return ok()

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
  const verifiedKompasAccount = sender.who.own

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
      // Voice messages arrive as completed media after Send, never as WhatsApp
      // live microphone streams or ready-to-use client-side transcripts.
      // Recognize once and dispatch the result as normal text. This preserves
      // kompas/revert, source intake, resume tailoring, account verification,
      // original wamid deduplication, and all source/answer revision safeguards.
      let input = msg
      if (String(msg.type || "") === "audio") {
        const voice = await speechToWhatsAppText(msg, userId)
        if (!voice.ok) {
          await sendText(from, voice.reply)
          return
        }
        input = voice.message
        // Metrics only: never put raw speech or transcript into server logs.
        console.log("[whatsapp-voice] transcription", JSON.stringify({ ms: voice.elapsedMs, chars: voice.characters }))
        trace(from, { dir: "in", kind: "voice-transcribed", note: "Voice recognized" })
      }
      await handle(from, input, session, userId, verifiedKompasAccount, msgId)
    } catch (e) {
      // Most errors here are session/database/storage faults, not LLM requests.
      // A bare storage 403 used to tell customers "no AI service is on" even for
      // Help and profile switching. Claim provider failure only when the error
      // actually names one; never disclose raw provider or storage exceptions.
      const detail = String((e as Error)?.message || e || "")
      const providerError = /\b(?:OpenRouter|OpenAI|Anthropic|Gemini|Groq)\b/i.test(detail)
      console.error("[whatsapp] message handling error", providerError ? "provider" : "operation", (e as Error)?.name || "error")
      const message = providerError
        ? plainFailure(e, "do that", true)
        : "I couldn't process that message because a MarketFit service is unavailable. Your request was not completed. Please retry."
      try { await sendText(from, message) } catch { /* ignore */ }
    }
  }
  if (typeof after === "function") after(work)
  else await work()
  return ok()
}

async function readablePdfText(bytes: Buffer): Promise<string> {
  try {
    const { isPdf, pdfText } = await import("@/lib/pdf-text")
    if (!isPdf(bytes)) return ""
    return await pdfText(bytes, { requireComplete: true })
  } catch {
    return ""
  }
}

async function handle(from: string, msg: Record<string, unknown>, session: Session, userId: string, verified: boolean, msgId: string) {
  const type = String(msg.type || "")

  // ── Chief approval cards (Phase 4) ─────────────────────────────────────────
  // Interactive button replies land here as type "interactive". Only ids with our
  // appr: prefix are intercepted; anything else falls through to existing behavior.
  if (type === "interactive") {
    const reply = (msg.interactive as { button_reply?: { id?: string; title?: string } } | undefined)?.button_reply
    const parsed = parseCardButton(reply?.id || "")
    if (parsed) {
      const card = await getApprovalCard(parsed.cardId)
      if (!card || card.to !== digits(from) || card.status !== "pending") {
        return sendText(from, "That approval is no longer pending — nothing to do.")
      }
      // A tap acts as the account this number answers as: a card made for another account is never acted on here.
      if (card.userId !== userId) return sendText(from, "That card belongs to another MarketFit account, so nothing was done.")
      // A jobs card (chief-goal.ts): Yes schedules the jobs, Edit takes the change in words, Skip saves nothing.
      if (card.kind === "jobs-plan") {
        const chief = await import("@/lib/chief-commands")
        if (parsed.action === "send") return sendText(from, await chief.approvePlan(card))
        if (parsed.action === "edit") {
          card.awaitingEdit = true
          await saveApprovalCard(card)
          session = await loadSession(from)
          session.awaitingEditCardId = card.id
          await saveSession(from, session)
          return sendText(from, "Reply with what to change, for example _drop 2_, _only Mondays_, _every night_ or _tonight only_.")
        }
        card.status = "skipped"; delete card.awaitingEdit
        await saveApprovalCard(card)
        return sendText(from, "Skipped — no job was scheduled.")
      }
      if (parsed.action === "send") {
        // Nothing the Chief left for him goes out unanswered: a [flag] still in the draft keeps Send locked (chief-guard.ts).
        const open = sendLocked(card)
        if (open.length) return sendText(from, `Not sent: the draft still has ${open.length === 1 ? "a flag" : `${open.length} flags`} only you can answer: ${open.slice(0, 3).join(" ")}. Tap Edit and reply with the full text.`)
        // The list may have grown since the card was made.
        const { readBrief } = await import("@/lib/chief-brief")
        const { neverContactHit } = await import("@/lib/chief-guard")
        const barred = neverContactHit((await readBrief(userId)).neverContact, card.toEmail)
        if (barred) return sendText(from, `Not sent: ${barred} is on your never-contact list.`)
        const err = card.draftId && card.accountEmail
          ? await sendGmailDraft(userId, card.accountEmail, card.draftId)
          : null
        if (err) return sendText(from, `⚠️ ${err}`)
        card.status = "sent"; delete card.awaitingEdit
        await saveApprovalCard(card)
        return sendText(from, `✅ Sent to ${card.toEmail}.`)
      }
      if (parsed.action === "edit") {
        card.awaitingEdit = true
        await saveApprovalCard(card)
        session = await loadSession(from)
        session.awaitingEditCardId = card.id
        await saveSession(from, session)
        return sendText(from, "Reply with your edited version and I'll update the draft.")
      }
      // skip
      const err = card.draftId && card.accountEmail
        ? await deleteGmailDraft(userId, card.accountEmail, card.draftId)
        : null
      card.status = "skipped"; delete card.awaitingEdit
      await saveApprovalCard(card)
      session = await loadSession(from)
      if (session.awaitingEditCardId === card.id) {
        delete session.awaitingEditCardId
        await saveSession(from, session)
      }
      return sendText(from, err ? `Skipped. ⚠️ ${err}` : "Skipped — the draft was discarded.")
    }
  }

  // Global basic assistance must never depend on an optional Kompas state read.
  // Keep "start" in the Kompas reducer because it advances interview setup.
  // Help/menu/greetings are safe in either mode and make troubleshooting possible
  // even when R2 session storage or the model provider is degraded.
  if (type === "text") {
    const command = String((msg.text as { body?: string } | undefined)?.body || "").trim().toLowerCase()
    if (["help", "hi", "hello", "menu"].includes(command)) return sendText(from, HELP)
  }

  // A deliberate profile-selection command is part of resume tailoring, not
  // an interview question. Route it through the existing verified library
  // selection even if the optional Kompas state store is unavailable.
  // This specifically protects "Use 2", which was failing before selection.
  // Help and a numbered profile switch must not wait on the Kompas session store.
  // A storage fault there used to be reported as "no AI service is switched on".
  const profileCommand = type === "text" &&
    /^(?:use|switch(?:\s+to)?|profile|email)\s+[1-9]\d{0,2}$|^(?:help|hi|hello|menu)$/i.test(
      String((msg.text as { body?: string } | undefined)?.body || "").trim(),
    )

  // Kompas has an explicit opt-in command and an independent, account-owned session.
  // All other WhatsApp traffic continues through the original MFit resume workflow.
  // The exact Kompas opt-in and exit commands must never be reinterpreted as
  // ordinary resume/JD text when the optional session service fails.
  const explicitKompasCommand = type === "text" && /^(?:kompas|revert)$/i.test(
    String((msg.text as { body?: string } | undefined)?.body || "").trim(),
  )
  if (!profileCommand && (type === "text" || type === "document")) {
    let consumed = false
    try {
      consumed = await handleWhatsAppKompas({
        from, owner: userId, verified, requestId: String(msg.id || ""), msg,
        send: async message => {
          // A verified number relinked during generation cannot receive the old account's answer.
          const latest = await resolveWhatsAppUser(from)
          if (latest.who?.own && latest.who.userId === userId) await sendText(from, message)
        },
      })
    } catch (error) {
      // A Kompas storage fault must not eat a job description or a profile switch.
      // The channel already answers when it knows the session cannot be read.
      console.error("[whatsapp] kompas handoff failed", (error as Error)?.name || "error")
      if (explicitKompasCommand) {
        return sendText(from, "Kompas is temporarily unavailable. Your interview mode was not changed. Please retry this command.")
      }
    }
    if (consumed) return
  }

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
      if (!session.last?.jd) return sendText(from, "There is no job made from your Files to make again. Paste a job description.")
      return fromLibrary(from, { jd: session.last.jd, jdId: `redo-${Date.now()}` }, session.last.email, userId, true)
    }
    if (cmd === "status") {
      return sendText(from, session.pending
        ? `A job description is waiting for its email. ${askWhichEmail(session.pending.slots)}`
        : [`JD: ${session.jd ? "received" : "waiting"}`, `Resume: ${session.resumeName ? session.resumeName : "from your Files"}`].join("\n"))
    }
    // The owner's edited draft text for a tapped Edit card: replaces the draft body,
    // updates the Gmail draft, and re-sends the card. Commands above stay as escapes.
    if (session.awaitingEditCardId && text.length > 0) {
      const card = await getApprovalCard(session.awaitingEditCardId)
      const cur = await loadSession(from)
      delete cur.awaitingEditCardId
      if (!card || card.to !== digits(from) || card.status !== "pending") {
        await saveSession(from, cur)
        return sendText(from, "That draft is no longer pending — nothing to edit.")
      }
      if (card.kind === "jobs-plan") {
        await saveSession(from, cur)
        const { revisePlan } = await import("@/lib/chief-commands")
        const said = await revisePlan(card, text)
        return said ? sendText(from, said) : undefined
      }
      // His own words are his: nothing in them is flagged again, and a [flag] he left in stays open.
      card.body = text
      keepOpenFlags(card)
      card.awaitingEdit = false
      const err = card.draftId && card.accountEmail
        ? await updateGmailDraft(userId, card.accountEmail, card.draftId, card.toEmail, card.subject, text)
        : null
      await saveApprovalCard(card)
      await saveSession(from, cur)
      if (err) return sendText(from, `⚠️ ${err}`)
      await deliverApprovalCard(card)
      return
    }
    // The Chief's own words (chief-commands.ts): a brief, a never-contact list, a goal, the jobs. Checked before a long
    // message is taken for a job description; anything else that starts the same way goes on as before.
    if (CHIEF_WORDS.test(text)) {
      const { chiefCommand } = await import("@/lib/chief-commands")
      const said = await chiefCommand({ from: digits(from), text, userId, account: ACCOUNT_ID.test(userId) })
      if (said !== null) return said ? sendText(from, said) : undefined
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
        remember(cur, email)
        await saveSession(from, cur)
        await pinProfile(from, email)
        // A resume sent while the email question was open is the file to tailor.
        // The library's older copy is not.
        if (cur.resumeBlocked && !cur.resumePath) return sendText(from, unreadableResumeReply(cur.resumeBlocked, true))
        if (freshUploadBlocksLibrary(cur.resumePath, cur.resumeAt)) {
          cur.jd = job.jd
          cur.jdId = job.jdId
          await saveSession(from, cur)
          return generate(from, cur, userId)
        }
        return fromLibrary(from, job, email, userId, !!session.pending.hint, session.pending.slots, session.pending.hint ? { hint: session.pending.hint } : undefined)
      }
      if (!replyTo) return sendText(from, askWhichEmail(session.pending.slots))
    }
    // A swipe-reply is a change request for the resume being replied to. Checked before
    // the JD path: a reply is never a new JD (new JDs are always pasted as their own message).
    if (replyTo) return refine(from, replyTo, text, userId, msgId)

    // Short message that's not a command — reply conversationally, not robotically.
    if (text.length < 60) {
      const lower = text.toLowerCase()
      // "use 2", "use jayeshwar44@gmail.com", "switch to 1": the email every next job starts from.
      if (/^(?:use|switch|profile|email)\b/.test(lower)) {
        const { slots } = await emailSlots(userId)
        const email = choiceIn(text.replace(/^(?:switch(?:\s+to)?|profile|email)\s+/i, ""), slots)
        if (email) {
          try {
            const cur = await loadSession(from)
            remember(cur, email)
            await saveSession(from, cur)
            await pinProfile(from, email).catch(() => {})
            return sendText(from, `Got it: every job now starts from your *${email}* resumes. Send a job description whenever you're ready.`)
          } catch {
            return sendText(from, "I could not save that email choice just now. Send *use 1* again in a minute. Nothing else was changed.")
          }
        }
      }
      // "Make another one", "use the SOC resume": the last job again, from the resume named (before the profile
      // switches below, which only match a city).
      const told = parseInstruction(text)
      if (told && !/houston|st\.?\s*louis|saint louis/.test(lower)) {
        if (session.last?.jd) return again(from, told, userId)
        return sendText(from, "Send me the job description first, then tell me which resume to start from, for example _use the Cybersecurity Analyst resume_.")
      }
      // "Why did you pick that resume?", "What resumes do I have?": answered from what was done.
      const asking = parseQuestion(text)
      if (asking === "why") return explainPick(from, userId, session)
      if (asking === "list") return listResumes(from, userId, session)
      // Natural profile switching: "use my Houston resume", "switch to st louis", etc.
      if (/houston/.test(lower) && /resume|profile|use|switch/.test(lower)) {
        const { slots } = await emailSlots(userId)
        const houston = slots.find(s => s.includes('eshwarjay05'))
        if (houston) {
          remember(session, houston)
          await saveSession(from, session)
          await pinProfile(from, houston)
          return sendText(from, "Got it — I'll use your Houston resume (eshwarjay05) from now on. Send a job description whenever you're ready.")
        }
      }
      if (/st\.?\s*louis|saint louis/.test(lower) && /resume|profile|use|switch/.test(lower)) {
        const { slots } = await emailSlots(userId)
        const stl = slots.find(s => s.includes('jayeshwar44'))
        if (stl) {
          remember(session, stl)
          await saveSession(from, session)
          await pinProfile(from, stl)
          return sendText(from, "Got it — I'll use your St. Louis resume (jayeshwar44) from now on. Send a job description whenever you're ready.")
        }
      }
      if (/thank|thanks/.test(lower)) {
        return sendText(from, "Anytime. Send the next job description when you're ready.")
      }
      // Anything else short: friendly nudge, not a character count.
      return sendText(from, "Send me a job description and I'll tailor your resume to it. Or type *help* to see what I can do.")
    }

    // A message of 60 characters or more was always a job post: "Make another one with selecting Cybersecurity Analyst
    // resume" is exactly 60, replaced the real post and was matched against the person's resumes (20 Oct 2026).
    const asked = parseInstruction(text)
    if (asked) {
      if (session.last?.jd) return again(from, asked, userId)
      return sendText(from, "Send me the job description first, then tell me which resume to start from, for example _use the Cybersecurity Analyst resume_.")
    }
    const asking = parseQuestion(text)
    if (asking === "why") return explainPick(from, userId, session)
    if (asking === "list") return listResumes(from, userId, session)
    // A post that ends with a line naming the resume ("use the SOC resume") is the post, and the name.
    const tail = splitTailInstruction(text)
    const post = tail.jd

    session = await loadSession(from)
    session.jd = post
    session.jdId = String(msg.id)
    delete session.pending
    await saveSession(from, session)
    // A pending upload older than WHATSAPP_UPLOAD_MAX_AGE (30 min) is dropped so the library chooses (30 Oct 2026).
    if (session.resumePath && uploadStale(session.resumeAt)) {
      console.info("[whatsapp] stale upload dropped", { ageMin: Math.round((Date.now() - (session.resumeAt || 0)) / 60000) })
      delete session.resumePath; delete session.resumeName; delete session.resumeAt; delete session.resumeFiled
      await saveSession(from, session)
    }
    if (session.resumeBlocked && !session.resumePath) {
      return sendText(from, unreadableResumeReply(session.resumeBlocked, true))
    }
    if (session.resumePath) return generate(from, session, userId)
    // A resume sent with the job description arrives as its own message a second or two later, and it wins: without
    // this short wait the run from Files claimed the job first and the resume was ignored without a word (found 19 Oct
    // 2026, his ask: "if the user had decided to send a resume ... just prepare the resume the usual way").
    await new Promise(r => setTimeout(r, PAIR_WAIT_MS))
    if ((await loadSession(from)).jdId !== String(msg.id)) return
    // Which email (profile) the job is for: a number under the job description; else the one this number used last,
    // when it still holds resumes; else the only one. Otherwise asked at once, and the answer is remembered. Every
    // start names the email and how to switch. Until 19 Oct 2026 someone who had never picked got the first email
    // silently (owner: "resume picking ... wasn't mapped correctly").
    const { slots, sure, failed } = await emailSlots(userId)
    if (failed) return sendText(from, "Got the job description, but I could not read your MarketFit Files just now. Send it again in a minute, or send your resume as a *.docx* file with it.")
    if (!live(slots).length) return sendText(from, "Got the job description. Your MarketFit Files hold no resume yet, so send your resume as a *.docx* file.")
    // A number under the job description is trusted only when the kept numbering was read: otherwise "2" might not be
    // the email the person learned as 2, so the bot asks.
    const said = sure ? readChoice(post, slots) : { email: "", rest: post }
    const cur = await loadSession(from)
    if (cur.jdId !== String(msg.id) || cur.resumePath) return   // a newer message or a resume took over meanwhile
    // A standing "use 1" lives in its own record. The job record is rewritten when a run
    // finishes, and that rewrite used to put the previous email back.
    const pin = await pinnedProfile(from, slots)
    const email = said.email || pin || remembered(cur, slots) || (live(slots).length === 1 ? live(slots)[0] : "")
    if (email) {
      delete cur.jd; delete cur.jdId
      remember(cur, email)
      await saveSession(from, cur)
      await pinProfile(from, email)
      return fromLibrary(from, { jd: said.email ? said.rest : post, jdId: String(msg.id) }, email, userId, !!tail.hint, slots, tail.hint ? { hint: tail.hint } : undefined)
    }
    cur.pending = { jd: post, jdId: String(msg.id), slots, at: Date.now(), ...(tail.hint ? { hint: tail.hint } : {}) }
    await saveSession(from, cur)
    return sendText(from, askWhichEmail(slots))
  }

  // ── Resume upload (Word, readable PDF, or a photo) ─────────────────────────
  // A new file replaces any older upload before tailoring. A photo or an unreadable
  // PDF does not fall through to the library's cached resume.
  const inbound = classifyInboundResume(msg as { type?: unknown; document?: { id?: string; filename?: string; mime_type?: string }; image?: { id?: string; mime_type?: string; caption?: string } })
  if (type === "document" && !inbound) {
    return sendText(from, "I can read a Word *.docx* or a text PDF. Please export and resend. I did not use an older resume.")
  }
  if (inbound) {
    let bytes: Buffer
    try { bytes = await downloadMedia(inbound.id, inbound.kind === "docx" ? undefined : 8 * 1024 * 1024) }
    catch (error) {
      const tooBig = /exceeds size limit/i.test(String(error))
      return sendText(from, tooBig
        ? "That file is too large. Send a Word .docx under 8 MB. I did not use an older resume."
        : "I couldn't download that file from WhatsApp. Please send it again. I did not use an older resume.")
    }
    session = await loadSession(from)
    delete session.resumePath
    delete session.resumeName
    delete session.resumeAt
    delete session.resumeFiled
    delete session.resumeBlocked
    const caption = inbound.kind === "image"
      ? String((msg.image as { caption?: string } | undefined)?.caption || "").trim()
      : ""
    if (caption.length >= 60 && !session.jd) {
      session.jd = caption
      session.jdId = String(msg.id || "")
      delete session.pending
    }
    if (inbound.kind === "docx") {
      const filename = inbound.name || "resume.docx"
      const safe = filename.replace(/[^A-Za-z0-9._\- ()]/g, "_").replace(/\.docx$/i, "") + ".docx"
      const dest = path.join(INBOX_DIR, digits(from), `${randomBytes(8).toString("hex")}-${safe}`)
      await writePath(dest, bytes)
      const filesDir = filesOf(userId)
      const kept = filesDir ? await saveUpload({ userDir: filesDir, bytes, filename: safe, kind: "docx" })
        .catch(e => { console.error("[whatsapp] resume not filed", String(e).slice(0, 200)); return null }) : null
      session.resumePath = dest
      if (kept) session.resumeFiled = kept.abs
      session.resumeName = safe.replace(/\.docx$/i, "")
      session.resumeAt = Date.now()
    } else if (inbound.kind === "pdf") {
      const text = await readablePdfText(bytes)
      const lines = pdfLines(text)
      if (lines.join(" ").length < 80) {
        session.resumeBlocked = "pdf"
        session.resumeAt = Date.now()
      } else {
        const dest = path.join(INBOX_DIR, digits(from), `${randomBytes(8).toString("hex")}-resume.docx`)
        await writePath(dest, await textToResumeDocx(lines))
        session.resumePath = dest
        session.resumeName = inbound.name.replace(/\.pdf$/i, "") || "resume"
        session.resumeAt = Date.now()
      }
    } else {
      session.resumeBlocked = "image"
      session.resumeAt = Date.now()
    }
    if (!session.jd && session.pending?.jd && session.resumePath) {
      session.jd = session.pending.jd
      session.jdId = session.pending.jdId
      delete session.pending
    }
    await saveSession(from, session)
    if (session.resumeBlocked && !session.resumePath) return sendText(from, unreadableResumeReply(session.resumeBlocked, !!session.jd))
    if (!session.jd) {
      await new Promise(r => setTimeout(r, PAIR_WAIT_MS))
      const now = await loadSession(from)
      if (now.jd || now.resumePath !== session.resumePath) return
      return sendText(from, `Saved *${now.resumeName || session.resumeName}*. Now paste the job description.`)
    }
    return generate(from, session, userId)
  }

  return sendText(from, HELP)
}

// ── Tailor + reply ────────────────────────────────────────────────────────────
// Where a run starts when it starts from the person's Files: their folder, the email, and what was picked.
type FromFiles = { userDir: string; email: string; said: string; depth: number; rel: string; abs: string; redo?: boolean }

async function generate(from: string, session: Session, userId: string, maxMs = TAILOR_BUDGET_MS, files?: FromFiles, quiet = false) {
  const startedAt = Date.now()
  if (!session.jd || !session.resumePath) return quiet ? undefined : sendText(from, HELP)
  console.info("[whatsapp] run source", { via: files ? "library" : "upload", name: session.resumeName ?? null, rel: files?.rel ?? null, ageMin: session.resumeAt ? Math.round((Date.now() - session.resumeAt) / 60000) : null })
  const job = createHash("sha256").update(`${from}:${session.jdId || session.jd}`).digest("hex")
  // Persist input before clearing the interactive session. Retries use the exact chosen original.
  const queued = await enqueueResumeRecovery({
    id: job, from, userId, jd: session.jd, jdId: session.jdId || "",
    resumePath: session.resumePath, resumeName: session.resumeName, resumeFiled: session.resumeFiled, files,
  })
  if (queued.status === "delivered" || queued.status === "sending" || queued.status === "uncertain") {
    if (quiet) return
    const handsetConfirmed = queued.status === "delivered" &&
      (queued.deliveryState === "delivered" || queued.deliveryState === "read")
    const said = handsetConfirmed
      ? "That resume was delivered. Reply to the file if you want a change."
      : queued.status === "delivered"
        ? "WhatsApp accepted the document, but handset delivery has not been confirmed. Your request is saved; I will not send a duplicate while its status is unknown."
        : queued.status === "uncertain"
          ? (queued.deliveryState === "accepted" || queued.deliveryState === "sent"
            ? "WhatsApp accepted the document, but handset delivery has not been confirmed. Your request is saved; I will not send a duplicate while its status is unknown."
            : "The document upload is unconfirmed. Your request is saved, and I will not risk sending a duplicate while delivery is unknown.")
          : "That resume is still being finished. Your request is saved for automatic recovery."
    return sendText(from, said)
  }
  const keys = await keysFor("resume-tailor", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(from) }))
  if (!hasAnyKey(keys)) {
    await deferResumeRecovery(job, "provider_unavailable")
    return quiet ? undefined : sendText(from, "Your resume request is saved. Tailoring is unavailable; MarketFit will retry automatically.")
  }
  // One claim per JD across workers.
  const claimKey = `whatsapp/jobs/${job}`
  const claimToken = randomBytes(6).toString("hex")
  if (!await blob.putIfAbsent(claimKey, JSON.stringify({ at: Date.now(), token: claimToken }))) {
    const held = JSON.parse((await blob.getText(claimKey).catch(() => null)) || "{}") as { at?: number }
    if (held.at && Date.now() - held.at < IN_FLIGHT_MS)
      return quiet ? undefined : sendText(from, "I am already making the resume for this job. It will arrive in this chat.")
    // A prior function was interrupted, or this is a legacy permanent claim. Replace it so a manual retry is never
    // ignored forever. The six-minute lease outlives the platform's five-minute function ceiling.
    await blob.put(claimKey, JSON.stringify({ at: Date.now(), token: claimToken }))
  }
  let finished = false
  let sending = false
  let told = false
  let failureCode = "quality_incomplete"
  // Fail-fast notice timer (Nov 4 baseline doctrine): declared here so the
  // outer finally can clear it; armed after the "Updating..." line below.
  let progressTimer: ReturnType<typeof setTimeout> | undefined
  // A quiet recovery still owes the chat one sentence the first time. Repeating it on every later retry is noise.
  const sayOutcome = async (text: string): Promise<string | undefined> => {
    if (quiet) {
      const current = await readResumeRecovery(job).catch(() => null)
      if (current?.toldUser) return undefined
      await patchResumeRecovery(job, { toldUser: true }).catch(() => {})
    }
    told = true
    return sendText(from, text).catch(() => undefined)
  }
  let failedCandidate: { token: string; coverage: number; supportedCoverage: number } | undefined
  // Assigned inside the run, after the job text is known. The outer catch can
  // still send the already-chosen resume if the run throws before a file goes out.
  let metaPromise: Promise<Meta> = Promise.resolve({ role: "", company: "", location: "" })
  const sendClosest = async (why: string): Promise<boolean> => {
    if (finished || sending) return false
    const resumePath = session.resumePath
    const jd = session.jd
    if (!resumePath || !jd) return false
    const source = await readPath(resumePath).catch(() => null)
    if (!source) return false
    let text = ""
    try { text = await extractText(source) } catch { text = "" }
    // Never substitute a resume from the other email. The path was chosen for this run.
    if (!chosenResumeMatchesProfile(text, files?.email)) return false
    const meta = await metaPromise
    const name = await outputNameFor(source)
    const caption = closestResumeCaption(name, chosenLabel(files, session.resumeName), why)
    await patchResumeRecovery(job, { status: "sending" })
    sending = true
    try {
      const sentId = await deliver(from, source, name, caption, { userId, jd, meta, changes: [], source: session.resumeName }, job)
      if (!sentId) throw new Error("WhatsApp document send returned no message id")
      const accepted = await markResumeDocumentAccepted(job, sentId)
      finished = true
      if (accepted && files) await markUsed(files.userDir, files.abs).catch(() => {})
      return true
    } catch (error) {
      const refused = /WA (?:upload|sendDoc) [45]\d\d:/.test(String(error))
      if (refused) {
        await patchResumeRecovery(job, { status: "pending" }).catch(() => {})
        sending = false
        failureCode = "whatsapp_http_rejected"
      } else failureCode = "delivery_unconfirmed"
      return false
    }
  }
  try {
  // Consume this pair now. Completion must not erase a newer request arriving meanwhile: the session is read again and
  // only what belongs to this job is cleared (a job from Files spends seconds picking before this; found in review).
  const cur = await loadSession(from)
  if (cur.jdId === session.jdId) { delete cur.jd; delete cur.jdId }
  if (cur.resumePath === session.resumePath) { delete cur.resumePath; delete cur.resumeName; delete cur.resumeAt }
  if (cur.pending?.jdId === session.jdId) delete cur.pending
  cur.seen = [...new Set([...(cur.seen || []), ...(session.seen || [])])].slice(-40)
  if (files && !quiet) cur.last = { jd: session.jd, email: files.email, at: Date.now(), used: files.rel }
  await saveSession(from, cur)

  if (!quiet) await sendText(from, files
    ? `Updating ${files.said}. You will get a Word file either way: the updated resume if the rewrite finishes, or this same resume if it does not.`
    : `Updating ${session.resumeName ? `*${session.resumeName}*` : "your resume"}. You will get a Word file either way: the updated resume if the rewrite finishes, or this same resume if it does not.`)

  // Fail-fast notice (Nov 4 baseline doctrine): a run used to burn the whole
  // 240s budget in silence and then fail. At 60s, if the run is still going,
  // the chat hears one honest progress line — still running, no outcome
  // claimed. Quiet recovery runs stay silent (they owe one sentence only
  // when they finish). The outer finally clears the timer on every path,
  // so a finished run never gets a stale progress note. No unref: the
  // function stays alive under after() up to maxDuration.
  if (!quiet) {
    progressTimer = setTimeout(() => {
      sendText(from, "Still working on your resume — the rewrite has been running for a minute and is still going. You will get a Word file here: the updated resume if the rewrite finishes, or the resume already chosen for this job if it does not.").catch(() => {})
    }, 60_000)
  }

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  metaPromise = extractJdMeta({ keys, jd: session.jd }).catch(() => ({ role: "", company: "", location: "" }))

  const tailorWithin = (opts: Parameters<typeof runTailor>[0]) => {
    const limit = Math.max(1000, Math.min(opts.maxMs || maxMs, maxMs))
    // The plan is two pre-edit passes, the constructed JD, the in-place rewrite, and one extra
    // pass when coverage is not above 95. On a full WhatsApp budget, export can finish a few
    // seconds after the model deadline, and that file is the one to send. A hung call, or a
    // budget too short to hold that export, rejects at the deadline so the chat is told the
    // rewrite ran out of time instead of sitting on "still waiting".
    const work = runTailor({ ...opts, maxMs: limit })
    const graceMs = limit >= 20_000 ? 8000 : 0
    return new Promise<TailorResult>((resolve, reject) => {
      let settled = false
      const finish = (fn: () => void) => {
        if (settled) return
        settled = true
        fn()
      }
      const timer = setTimeout(() => {
        const grace = setTimeout(() => finish(() => reject(new Error("Tailoring timed out"))), graceMs)
        work.then(
          value => { clearTimeout(grace); finish(() => resolve(value)) },
          error => { clearTimeout(grace); finish(() => reject(error)) },
        )
      }, limit)
      work.then(
        value => { clearTimeout(timer); finish(() => resolve(value)) },
        error => { clearTimeout(timer); finish(() => reject(error)) },
      )
    })
  }
  let result: TailorResult
  try {
    result = await tailorWithin({
      jd: session.jd,
      keys,
      userResumeDir: files ? files.userDir : path.join(INBOX_DIR, digits(from)),
      givenPath: session.resumePath,
      mode: "full",
      // The constructed-JD plan runs inside this one call, including the extra pass. Leave a short
      // window so the Word file can still be checked and sent. Do not cut the call so short that
      // the extra pass is dropped and the original library file goes out instead.
      maxMs: Math.max(45_000, maxMs - 25_000),
      // "redo" asks for a fresh rewrite, not the one kept for the same inputs.
      ...(files?.redo ? { noCache: true } : {}),
      // Summary is rewritten in full mode so the tailored file keeps a complete, grounded profile.
      sections: { summary: true, skills: true, experience: true },
    })
  } catch (e) {
    // A timeout and a provider failure are different errors with different
    // fixes, so they are told apart here and recorded apart (failureCode is
    // persisted as the recovery record's errorCode). The already-chosen resume
    // still goes out. Nothing here changes the retry routing when that send fails.
    const timedOut = /timed out/i.test(String(e))
    failureCode = timedOut ? "timeout" : "provider_error"
    console.error("[whatsapp] tailor failed", String(e).slice(0, 300))
    const why = timedOut ? "The rewrite ran out of time just now." : "The rewrite stopped before it finished."
    if (await sendClosest(why)) return
    await sayOutcome(timedOut
      ? "The rewrite ran out of time just now. Your resume and this job are saved, and MarketFit will try again."
      : "I could not tailor your resume just now. Your resume and this job are saved, and MarketFit will try again.")
    return;
  }

  // Nothing came back different. Do not present the original as a tailored resume.
  // Send that already-chosen file and say the rewrite produced no changes.
  if (result.unchanged) {
    console.error("[whatsapp] tailor changed nothing", (result.notes || []).find(n => n.startsWith("Tailored with")) || "")
    failureCode = "unchanged"
    if (await sendClosest("The rewrite produced no changes, so this is the resume already chosen for this job, unchanged.")) return
    await sayOutcome("The rewrite produced no changes. Your request is saved and will be retried automatically.")
    return;
  }

  // A cached, incomplete result must never permanently block the same JD.
  // Give the engine one fresh full rewrite while there is enough request budget.
  // A usable file under 95% is still sent, with the shortfall named, so it gets
  // one fresh rewrite first and the usable pass with the higher coverage is the one sent.
  const belowTarget = (r: TailorResult) => Number.isFinite(r.coverage) && r.coverage! < 95
  const sendable = (r: TailorResult) => whatsappRewriteUsable(r)
  const firstRejected = !sendable(result) || belowTarget(result)
  if (firstRejected && maxMs >= 120_000) {
    const elapsed = Date.now() - startedAt
    const remaining = maxMs - elapsed - 15_000
    if (remaining >= 35_000) {
      try {
        const fresh = await tailorWithin({
          jd: session.jd, keys,
          userResumeDir: files ? files.userDir : path.join(INBOX_DIR, digits(from)),
          givenPath: session.resumePath,
          mode: "full", noCache: true, maxMs: remaining,
          sections: { summary: true, skills: true, experience: true },
        })
        if (sendable(fresh) && (!sendable(result) || (fresh.coverage ?? 0) > (result.coverage ?? 0))) result = fresh
        else if (!sendable(result)) {
          const priorBlockers = whatsappResumeRejectionReasons(result).length
          const freshBlockers = whatsappResumeRejectionReasons(fresh).length
          // At equal supported coverage, retain the pass with fewer genuine
          // completion blockers. The previous comparison discarded an improved
          // role rewrite whenever both drafts already scored 100% supported.
          if ((freshBlockers < priorBlockers &&
               (fresh.supported_coverage ?? 0) >= (result.supported_coverage ?? 0) - 1) ||
              (freshBlockers === priorBlockers &&
               (fresh.supported_coverage ?? 0) > (result.supported_coverage ?? 0)))
            result = fresh
        }
      } catch (error) {
        console.error("[whatsapp] automatic quality retry failed", String(error).slice(0, 300))
      }
    }
  }

  // A usable rewrite goes out even under 95% coverage, with the gaps named in the caption.
  // An incomplete, failed, or identity-unsafe rewrite does not. The already-chosen
  // resume for this profile goes out instead. It is not saved as a new tailored file.
  const coverage = result.coverage ?? result.score
  if (!whatsappRewriteUsable(result)) {
    failureCode = "quality_rejected"
    failedCandidate = { token: result.token, coverage, supportedCoverage: result.supported_coverage ?? 0 }
    console.error("[whatsapp] tailoring quality gate rejected draft", {
      coverage, supportedCoverage: result.supported_coverage,
      partial: !!result.partial, skillsOnly: !!result.skills_only,
      status: result.quality?.status, incomplete: !!result.quality?.incomplete,
      blockers: whatsappResumeRejectionReasons(result),
      roleCount: result.role_alignment?.length ?? 0,
      unverifiedCount: result.unverified_added_keywords?.length ?? 0,
      // Why the floor placed nothing, decided in one look next time. Counts and codes only, no resume text.
      placedFromJd: result.placed_from_jd?.length ?? 0,
      unplacedReason: result.jd_terms_unplaced_reason ?? null,
      bulletsReverted: result.bullets_reverted_for_jd_terms ?? 0,
      cached: !!result.cached,
    })
    if (await sendClosest(unfinishedRewriteWhy(result))) return
    // No chosen file could be sent (missing, or it belongs to another profile).
    await sayOutcome(qualityStop(result))
    return;
  }
  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) {
    failureCode = "file_missing"
    if (await sendClosest("The updated Word file could not be opened.")) return
    await sayOutcome("I did not send a file. The draft was made but the Word file could not be opened, and the resume already chosen for this job could not be opened either. Your resume and this job are saved for another try.")
    return;
  }

  const source = await readPath(session.resumePath)
  if (!source || !(await sameResumeFacts(source, file))) {
    failureCode = "identity_mismatch"
    // The rewritten bytes changed name, contact details, or dates. Do not send them.
    // The already-chosen resume is unchanged and is the file that goes out.
    if (await sendClosest("The update failed identity/contact/date verification, so I sent your original resume instead.")) return
    await sayOutcome("The update failed identity/contact/date verification, so the rewritten file was not sent. Your original resume and job description are saved for automatic recovery.")
    return;
  }
  const meta = await metaPromise
  const name = await outputNameFor(file)
  // Made from Files: filed back there, in the folder for its kind of job, one job one file (saveTailored).
  const more: string[] = []
  let filed: Awaited<ReturnType<typeof saveTailored>> | null = null
  // Every resume made goes to Files: from Files, back beside where it started; from a resume sent here, beside that
  // resume's filed copy. One job, one file (saveTailored).
  const filesDir = files ? files.userDir : filesOf(userId)
  // A resume the floor wrote job-post terms onto is filed as a copy (depth 2): never the start of another job, where those
  // terms would count as the person's own record (26 Oct 2026 review). One made with no AI writer answering (skills
  // only) is not filed at all, so the next time the job is sent it is written in full.
  // A below-floor or added-term file is sent, but it is not filed as a new base resume.
  const floorMade = !!(result.placed_from_jd?.length || result.placed_in_summary?.length)
  const cleanPass = acceptableWhatsAppResume(result)
  if (result.skills_only) more.push("Not saved in Files: send *redo* once the writers are back for the full rewrite.")
  if (cleanPass && !files && filesDir && !result.skills_only) {
    const fromRel = session.resumeFiled ? relOf(filesDir, session.resumeFiled) : undefined
    filed = await saveTailored({ qualityPolicy: result.quality_policy, userDir: filesDir, bytes: file, jd: session.jd, role: meta.role, company: meta.company, depth: floorMade ? 2 : 1,
      ...(fromRel && !fromRel.startsWith("..") ? { from: fromRel } : {}),
      asked: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || []), ...(result.keyword_analysis?.missing || [])],
      covers: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || [])] })
      .catch(e => { console.error("[whatsapp] not filed", String(e).slice(0, 200)); return null })
    if (filed) more.push(`Saved in your Files: ${filed.email} / ${filed.category}`)
  }
  if (files) {
    filed = result.skills_only || !cleanPass ? null : await saveTailored({ qualityPolicy: result.quality_policy, userDir: files.userDir, bytes: file, jd: session.jd, role: meta.role, company: meta.company,
      depth: files.depth === 0 && !floorMade ? 1 : 2, from: files.rel, asked: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || []), ...(result.keyword_analysis?.missing || [])], covers: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || [])] })
      .catch(e => { console.error("[whatsapp] not filed", String(e).slice(0, 200)); return null })
    more.push(`Started from ${files.said}.`)
    if (filed) more.push(`Saved in your Files: ${filed.email} / ${filed.category}`)
    more.push(DIFFERENT_RESUME)
  }
  // Meta can accept an upload before the function sees its response. Never retry an
  // ambiguous send automatically: that could deliver duplicates.
  await patchResumeRecovery(job, { status: "sending" })
  sending = true
  let sentId = ""
  try {
    sentId = await deliver(from, file, name, captionFor(name, meta, result, undefined, more), { userId, jd: session.jd, meta, changes: [], source: session.resumeName,
      ...(filed ? { saved: filed.abs, depth: !floorMade && (!files || files.depth === 0) ? 1 : 2 } : {}) }, job)
  } catch (error) {
    // An explicit Meta HTTP rejection proves no document was accepted; retry it.
    // A timeout or unknown response is ambiguous and must not be sent twice.
    const refused = /WA (?:upload|sendDoc) [45]\d\d:/.test(String(error))
    if (refused) {
      await patchResumeRecovery(job, { status: "pending" })
      sending = false
      failureCode = "whatsapp_http_rejected"
      // Meta rejected this upload, so nothing was accepted. The already-chosen resume can still go out.
      if (await sendClosest("WhatsApp refused the updated file.")) return
    } else failureCode = "delivery_unconfirmed"
    await sayOutcome(refused
      ? "I did not send a file. WhatsApp refused it. Your resume and this job are saved for another try."
      : "WhatsApp did not confirm the file. Your request is saved. I will not send a duplicate while the first delivery is unconfirmed.")
    return
  }
  if (!sentId) throw new Error("WhatsApp document send returned no message id")
  const accepted = await markResumeDocumentAccepted(job, sentId)
  if (!accepted) { finished = true; return } // Signed failed-delivery callback already scheduled a retry.
  console.info("[whatsapp] tailored document accepted by Meta", { job: job.slice(0, 12), message: sentId.slice(0, 16), overallCoverage: result.coverage, supportedCoverage: result.supported_coverage })
  finished = true
  await recordWhatsAppUsage(userId, "resume_tailor", result)
  await sendText(from, resumeGapReport(result)).catch(error => console.error("[whatsapp] gap report send failed", String(error).slice(0, 160)))
  // Counted once the resume it started is delivered, so a failed run never makes a resume look more used.
  if (files) await markUsed(files.userDir, files.abs).catch(() => {})

  // Keep the original source recoverable after Meta API acceptance: a later
  // signed failure callback may require regeneration without user resubmission.
  // When the same original was already filed in Files, switch the queue to
  // that durable copy before removing the temporary inbox copy.
  if (session.resumePath?.startsWith(path.join(INBOX_DIR, digits(from)) + path.sep) &&
      session.resumeFiled && await existsPath(session.resumeFiled)) {
    await patchResumeRecovery(job, { resumePath: session.resumeFiled })
    const durable = await readResumeRecovery(job)
    if (durable?.resumePath === session.resumeFiled)
      await deletePath(session.resumePath).catch(() => {})
  }
  } catch (error) {
    console.error("[whatsapp] resume run stopped", String(error).slice(0, 200))
    if (!finished && !sending) {
      const sent = await sendClosest("The rewrite did not finish cleanly.").catch(() => false)
      if (!sent && !told) await sayOutcome("The run stopped before a file or a reason went out. Your resume and this job are saved, and MarketFit will try again.")
    } else if (!told) await sayOutcome("The run stopped before a file or a reason went out. Your resume and this job are saved, and MarketFit will try again.")
  } finally {
    // The progress timer must never outlive the run: a finished run gets no
    // stale "still working" note, and a failed run's outcome message stands alone.
    clearTimeout(progressTimer)
    if (!finished && !told) {
      await sayOutcome("The run stopped before a file or a reason went out. Your resume and this job are saved, and MarketFit will try again.")
    }
    if (!finished) {
      if (sending) {
        const latest = await readResumeRecovery(job).catch(() => null)
        if (latest?.status === "sending") await patchResumeRecovery(job, { status: "uncertain", errorCode: "delivery_unconfirmed" }).catch(() => {})
      }
      else await deferResumeRecovery(job, failureCode, failedCandidate).catch(e => console.error("[whatsapp] recovery persistence failed", String(e).slice(0, 100)))
    }
    const held = JSON.parse((await blob.getText(claimKey).catch(() => null)) || "{}") as { token?: string }
    if (held.token === claimToken) await blob.delete(claimKey).catch(() => {})
  }
}

// ── From the person's Files ─────────────────────────────────────────────────────
/** The email this number used last, while it still holds resumes. */
function remembered(session: Session, slots: string[]): string {
  const was = String(session.preferredEmail || session.last?.email || "").toLowerCase()
  return was && live(slots).includes(was) ? was : ""
}

/** Every next job starts from this email until the person says otherwise. A job made before stays redo-able. */
function remember(session: Session, email: string) {
  // Changing accounts must not re-date the previous JD or relabel its source resume.
  // The standing selection is also persisted by pinProfile(), separately.
  session.preferredEmail = email.toLowerCase()
}

// Standing profile. A finished run rewrites session.last with the email THAT run used.
// "use 1" is stored apart from that record, so a run that started earlier cannot put the other email back.
const profileKey = (from: string) => `whatsapp/profile-${digits(from)}.json`

async function pinProfile(from: string, email: string): Promise<void> {
  await blob.put(profileKey(from), JSON.stringify({ email: email.toLowerCase(), at: Date.now() }))
}

async function pinnedProfile(from: string, slots: string[]): Promise<string> {
  try {
    const raw = await blob.getText(profileKey(from))
    const email = String(raw ? (JSON.parse(raw) as { email?: string }).email || "" : "").toLowerCase()
    return live(slots).find(slot => slot.toLowerCase() === email) || ""
  } catch { return "" }
}

/** Said the moment a job is taken: which email it starts from, and how to switch when there is more than one. */
function startLine(email: string, slots: string[]): string {
  const others = slots.map((e, i) => ({ e, n: i + 1 })).filter(o => o.e && o.e !== email)
  return [`On it: starting from your *${email}* resumes.`,
    ...(others.length ? [`_Wrong email? Reply ${others.slice(0, 3).map(o => `*use ${o.n}* for ${o.e}`).join(", ")}._`] : [])].join("\n")
}

// The emails a person's resumes carry, numbered for good (library-pick-store.ts).
// Rebuild the last pre-queue failure for each sender without replaying a sent document.
async function bootstrapLegacyResumeFailures(): Promise<number> {
  const keys = (await blob.list("whatsapp")).filter(k => /^whatsapp\/session-\d+\.json$/.test(k))
  let queued = 0
  const cutoff = Date.parse("2026-10-29T17:45:00Z")
  const cursorKey = "whatsapp/recovery-bootstrap-cursor.txt"
  const offset = Math.max(0, Number((await blob.getText(cursorKey)) || 0) || 0)
  const batch = keys.slice(offset, offset + 200)
  await blob.put(cursorKey, String(offset + batch.length >= keys.length ? 0 : offset + batch.length))
  for (const key of batch) {
    const from = key.match(/session-(\d+)\.json$/)?.[1] || ""
    if (!from) continue
    // Read the persisted record directly: interactive sessions expire after 24h,
    // but a failed job must remain recoverable after a deployment delay.
    let session: Session
    try { session = JSON.parse((await blob.getText(key)) || "{}") as Session } catch { continue }
    const last = session.last
    if (!last?.jd || !last.used || !last.email || !last.at || last.at < cutoff) continue
    const sender = await resolveWhatsAppUser(from)
    if (!sender.who) continue
    const userId = sender.who.userId
    const userDir = filesOf(userId)
    if (!userDir) continue
    const abs = path.resolve(userDir, last.used)
    if (!abs.startsWith(path.resolve(userDir) + path.sep) || !(await existsPath(abs))) continue
    const marker = "whatsapp/legacy-resume-recovery/" + from + "-" + jobKeyOf(last.jd)
    if (await blob.exists(marker)) continue
    // The original webhook may already have enqueued this JD under its Meta message ID.
    // Never create a second recovery job even when that one is awaiting a callback.
    if (await hasResumeRecoveryForJD(from, userId, last.jd)) continue
    let genIndex: { key: string }[] = []
    try { genIndex = JSON.parse((await blob.getText(genDir(from) + "/_index.json")) || "[]") as { key: string }[] } catch { continue }
    const sent = await Promise.all(genIndex.slice(-30).map(async g => {
      try { const raw = await blob.getText(g.key); return raw ? JSON.parse(raw) as Gen : null } catch { return null }
    }))
    if (sent.some(g => g && g.jd === last.jd && g.createdAt >= last.at - 60_000)) continue
    // A profile switch must not change the identity of this legacy job.
    const jdId = "legacy-" + jobKeyOf(last.jd)
    const id = createHash("sha256").update(from + ":" + jdId).digest("hex")
    if (await blob.exists("whatsapp/resume-recovery/" + id + ".json")) continue
    await enqueueResumeRecovery({ id, from, userId, jd: last.jd, jdId, resumePath: abs,
      resumeName: path.basename(abs, ".docx"), files: { userDir, email: last.email, said: path.basename(abs),
      depth: 1, rel: last.used, abs, redo: true } })
    await blob.putIfAbsent(marker, String(last.at))
    queued++
  }
  return queued
}

// One small marker so a cron run can be checked later even though Vercel keeps logs for ~30 minutes.
// Only route, time, outcome and counts: no phone number, candidate, JD or resume content. Best effort: never breaks the cron.
async function recoverResumeJobs(request: NextRequest) {
  const startedAt = Date.now()
  const mark = async (outcome: string, counts: unknown) => {
    try {
      await blob.put("whatsapp/recovery-last-run.json", JSON.stringify({
        route: "/api/whatsapp/recover", at: new Date(startedAt).toISOString(), ms: Date.now() - startedAt, outcome, counts }))
    } catch { /* marker only */ }
  }
  try {
    const res = await recoverResumeJobsInner(request, startedAt, mark)
    if (res.status !== 401) await mark(res.ok ? "ok" : "http_" + res.status, await res.clone().json().catch(() => ({})))
    return res
  } catch (error) {
    await mark("error:" + ((error as Error)?.name || "error"), {})
    throw error
  }
}
async function recoverResumeJobsInner(request: NextRequest, startedAt: number, progress: (outcome: string, counts: unknown) => Promise<void>) {
  const secret = process.env.CRON_SECRET || ""
  if (secret.length < 16 || request.headers.get("authorization") !== "Bearer " + secret)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  // Checkpoint before legacy storage scans: a platform timeout must not look like a cron that never ran.
  console.info("[whatsapp] resume recovery cron started")
  await progress("running", { stage: "authenticated" })
  const bootstrapped = await bootstrapLegacyResumeFailures()
  await progress("running", { stage: "bootstrapped", bootstrapped })
  const jobs = await dueResumeRecoveries(1)
  await progress("running", { stage: "queue_selected", bootstrapped, due: jobs.length })
  let attempted = 0
  let accepted = 0
  let handsetConfirmed = 0
  let stillPending = 0
  for (const job of jobs) {
    const sender = await resolveWhatsAppUser(job.from)
    if (!sender.who || sender.who.userId !== job.userId) {
      await patchResumeRecovery(job.id, { status: "uncertain", errorCode: "account_changed" })
      continue
    }
    let resumePath = job.resumePath
    if (!(await existsPath(resumePath))) {
      // Earlier builds deleted uploaded inbox originals immediately after an
      // API-accepted send. Recover only from that user's previously filed
      // ORIGINAL source; never substitute a tailored output or another account.
      const root = filesOf(job.userId)
      const fallback = job.resumeFiled || ""
      if (root && fallback && path.resolve(fallback).startsWith(path.resolve(root) + path.sep) &&
          await existsPath(fallback)) {
        resumePath = fallback
        await patchResumeRecovery(job.id, { resumePath })
      } else {
        await deferResumeRecovery(job.id, "source_missing")
        continue
      }
    }
    // Bootstrap and queue enumeration consume the SAME 300-second function budget.
    // Leave time for quality checks, Meta upload, state writes and a final count log.
    const budget = recoveryTailorBudget(startedAt)
    if (budget < RECOVERY_MIN_TAILOR_MS) {
      console.warn("[whatsapp] resume recovery deferred for route time budget", { budgetMs: budget, attempted })
      await progress("running", { stage: "insufficient_budget", bootstrapped, due: jobs.length, attempted })
      break // Still pending; no send occurred and the next authenticated run may retry.
    }
    attempted++
    await progress("running", { stage: "attempt_started", bootstrapped, due: jobs.length, attempted })
    try {
      await generate(job.from, { jd: job.jd, jdId: job.jdId, resumePath,
        resumeName: job.resumeName, resumeFiled: job.resumeFiled }, job.userId, budget, job.files, true)
      const state = await readResumeRecovery(job.id)
      if (state?.deliveryState === "accepted" || state?.deliveryState === "sent" ||
          state?.deliveryState === "delivered" || state?.deliveryState === "read") accepted++
      else stillPending++
      if (state?.deliveryState === "delivered" || state?.deliveryState === "read") handsetConfirmed++
      await progress("running", { stage: "attempt_finished", bootstrapped, due: jobs.length, attempted, accepted, handsetConfirmed, stillPending })
    } catch (error) {
      console.error("[whatsapp] recovery run failed", (error as Error)?.name || "error")
      await deferResumeRecovery(job.id, "recovery_exception")
    }
  }
  const refinementJobs = await dueResumeRefinements(1)
  let refinementAttempted = 0
  if (refinementJobs.length) {
    const budget = recoveryTailorBudget(startedAt)
    if (budget >= RECOVERY_MIN_TAILOR_MS) {
      refinementAttempted++
      await progress("running", { stage: "refinement_attempt_started", bootstrapped, due: jobs.length, refinementDue: refinementJobs.length, attempted, refinementAttempted })
      try {
        await processResumeRefinement(refinementJobs[0].id, { maxMs: budget })
      } catch (error) {
        console.error("[whatsapp] refinement recovery failed", (error as Error)?.name || "error")
        await deferResumeRefinement(refinementJobs[0].id, "recovery_exception")
      }
      await progress("running", { stage: "refinement_attempt_finished", bootstrapped, due: jobs.length, refinementDue: refinementJobs.length, attempted, refinementAttempted })
    } else {
      await progress("running", { stage: "refinement_deferred_for_budget", bootstrapped, due: jobs.length, refinementDue: refinementJobs.length, attempted })
    }
  }
  // Counts only: no candidate identity, JD or resume content in logs.
  console.info("[whatsapp] resume recovery cron", { bootstrapped, due: jobs.length, attempted, accepted, handsetConfirmed, stillPending, refinementDue: refinementJobs.length, refinementAttempted })
  return NextResponse.json({ bootstrapped, attempted, accepted, handsetConfirmed, stillPending, due: jobs.length, refinementDue: refinementJobs.length, refinementAttempted })
}
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

/**
 * A job made from the closest resume of one email in the person's Files. Made before for this job: sent again as it is
 * (no AI, nothing new saved), unless `redo`. Otherwise the AI agent and the code each pick, the agent's pick is used
 * when it names a real resume, the file is opened and its email read once more before it is used, and the pick is
 * logged and counted.
 */
async function fromLibrary(from: string, job: { jd: string; jdId: string }, email: string, userId: string, redo = false, slots?: string[], prefer?: Prefer) {
  const began = Date.now()
  const userDir = path.join(USER_RESUMES_DIR, userId)
  // A named resume, or another go, is a new file. The one already made for this job
  // is not sent back in its place (29 Oct: "make another one with the Cybersecurity Analyst resume"
  // was answered with the 19 Oct file, then a different folder).
  if (!redo && !prefer?.hint) {
    // Sent again as it is only while it meets the 90% floor; one made below it (22-26 Oct 2026) is made again, and
    // not from itself: like a redo, the new run starts from what the person wrote (26 Oct 2026 review).
    const have = await existingForJob(userDir, email, job.jd).catch(() => null)
    if (have && await madeMeetsFloor(have.abs, job.jd, have.file.at, have.file.qualityReceipt)) return sendSaved(from, have, job.jd, email, userId)
    if (have) redo = true
  }
  // One run of a job at a time for a number: a job description pasted again, or a second "redo", while it is being made
  // would pay for the pick and the rewrite twice. The claim outlives the longest run (the function's 300 s).
  const flightKey = `whatsapp/making/${digits(from)}-${jobKeyOf(job.jd)}-${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 16)}`
  const token = randomBytes(6).toString("hex")
  if (!(await blob.putIfAbsent(flightKey, JSON.stringify({ at: Date.now(), token })))) {
    const held = JSON.parse((await blob.getText(flightKey).catch(() => null)) || "{}") as { at?: number }
    if (held.at && Date.now() - held.at < IN_FLIGHT_MS) return sendText(from, "I am already making the resume for this job. It will arrive in this chat.")
    await blob.put(flightKey, JSON.stringify({ at: Date.now(), token }))
  }
  // Said the moment the job is taken, before the pick and the rewrite: which email, and how to switch.
  if (slots) await sendText(from, startLine(email, slots))
  try {
    return await pickAndMake(from, job, email, userId, userDir, redo, began, prefer)
  } finally {
    const now = JSON.parse((await blob.getText(flightKey).catch(() => null)) || "{}") as { token?: string }
    if (now.token === token) await blob.delete(flightKey).catch(() => {})
  }
}

/** "Why did you pick that resume?": the last pick, and the reason, from the pick log (not from a model). */
async function explainPick(from: string, userId: string, session: Session) {
  const [last] = await readPicks(userId, 1)
  if (!last) return sendText(from, "I have not started a resume for you yet. Send a job description and I will say which resume I start from, and why.")
  const rel = String(last.used || session.last?.used || "")
  const name = rel.split("/").pop()?.replace(/__[a-f0-9]{16}(?=\.docx$)/i, "").replace(/\.docx$/i, "").replace(/\s*\(tailored\)$/i, "") || "your resume"
  const folder = rel.split("/").length >= 3 ? rel.split("/")[1] : ""
  const reason = last.hint ? "You asked for it by name."
    : last.titled && last.titled > 1 ? `Its title matches the job's role${last.role ? ` (${last.role})` : ""}. ${last.titled} of your resumes do, so I chose between them by the skills the job asks for.`
    : last.titled === 1 ? `It is the one resume whose title matches the job's role${last.role ? ` (${last.role})` : ""}.`
    : `None of your resumes carries the job's title${last.role ? ` (${last.role})` : ""}, so I chose by the skills the job asks for.`
  return sendText(from, [
    `For your last job I started from your *${name}* resume${folder ? ` (in ${folder})` : ""}.`,
    reason,
    ...(last.why ? [`The AI agent's note: ${last.why}`] : []),
    "To start from another, say _make another one with the Cybersecurity Analyst resume_ (or whichever you want).",
  ].join("\n"))
}

/** "What resumes do I have?": the titles of the resumes of the email in use. */
async function listResumes(from: string, userId: string, session: Session) {
  const { slots, failed } = await emailSlots(userId)
  if (failed) return sendText(from, "I could not read your MarketFit Files just now. Ask again in a minute.")
  const email = remembered(session, slots) || (live(slots).length === 1 ? live(slots)[0] : "")
  if (!email) return sendText(from, live(slots).length ? askWhichEmail(slots) : "Your MarketFit Files hold no resume yet, so send your resume as a *.docx* file.")
  const userDir = path.join(USER_RESUMES_DIR, userId)
  const { index } = await libraryOf(userDir)
  const { ranked } = rankFor(await candidatesFor(userDir, email, index), email, [])
  if (!ranked.length) return sendText(from, `Your Files hold no resume of *${email}* to start from.`)
  const titles = titlesOf(ranked, 12)
  return sendText(from, [`Your *${email}* resumes (${ranked.length}): ${titles.map(t => `*${t}*`).join(", ")}.`, "Say _make another one with the SOC resume_ (or any title) to start a job from one of them."].join("\n"))
}

/** "Make another one with the Cybersecurity Analyst resume": the last job again, from the resume named, or from another. */
async function again(from: string, said: Instruction, userId: string) {
  const last = (await loadSession(from)).last
  if (!last?.jd?.trim() || !last.email) return sendText(from, "Send me the job description first, then tell me which resume to start from, for example _use the Cybersecurity Analyst resume_.")
  const { slots } = await emailSlots(userId)
  return fromLibrary(from, { jd: last.jd, jdId: `again-${Date.now()}` }, last.email, userId, true, slots, said.hint ? { hint: said.hint } : { avoid: last.used || "" })
}

async function pickAndMake(from: string, job: { jd: string; jdId: string }, email: string, userId: string, userDir: string, redo: boolean, began: number, prefer: Prefer = {}) {
  // Which resume: the same choice Apply makes on the website (src/lib/library-choose.ts).
  const choice = await chooseResume({ userDir, userId, email, jd: job.jd, redo, prefer })
  if (choice.kind === "none") return sendText(from, `Your Files hold no resume of *${email}* to start from. Send that resume as a *.docx* file with the job description.`)
  if (choice.kind === "unnamed") return sendText(from, `I could not find a resume called *${choice.hint}* under ${email}. Your resumes there: ${choice.have.map(t => `*${t}*`).join(", ")}. Say _use the ${choice.have[0]} resume_ and I will start from it.`)
  if (choice.kind === "unreadable") return sendText(from, `I could not open a resume in your Files that carries *${email}*. Send that resume as a *.docx* file with the job description.`)
  const { picked, rel, why } = choice
  // The pick happens inside the same 300 s function as the rewrite. Starting a rewrite
  // after that time is already gone is what left the chat on "I'll send a file" with nothing after it.
  const budget = TAILOR_BUDGET_MS - PAIR_WAIT_MS - (Date.now() - began)
  if (budget < 20_000) return sendText(from, "I did not send a file. Choosing the resume used the time I have. Send the job once more and I will start again.")
  return generate(from, { jd: job.jd, jdId: job.jdId, resumePath: picked.candidate.path, resumeName: picked.candidate.name }, userId, budget,
    { userDir, email, said: saidOf(picked, why), depth: picked.candidate.depth, rel, abs: picked.candidate.path, ...(redo ? { redo } : {}) })
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
async function tellRefinementOnce(jobId: string, from: string, message: string) {
  const job = await readResumeRecovery(jobId)
  if (!job || job.toldUser) return
  try {
    await sendText(from, message)
    await patchResumeRecovery(jobId, { toldUser: true })
  } catch { /* the durable job remains available for the next recovery run */ }
}

async function refine(from: string, replyTo: string, request: string, userId: string, msgId: string) {
  const gen = await loadGen(from, replyTo)
  if (!gen) {
    return sendText(from, "I could not recover the exact resume version you replied to. No document was sent and your previous resume remains unchanged. I cannot safely apply this edit without that saved version.")
  }
  if (gen.userId !== userId) return sendText(from, "That resume version belongs to a different MarketFit identity.")
  if (request.length < 3) {
    return sendText(from, "Tell me what to change, e.g. _add more Terraform and AWS_ or _make the bullets shorter_.")
  }
  if (!msgId) return sendText(from, "I could not save this edit safely, so no document was sent. The original resume is unchanged.")

  const senderRoot = path.join(VERSIONS_DIR, digits(from))
  const originalPath = path.resolve(gen.file)
  if (!originalPath.startsWith(path.resolve(senderRoot) + path.sep)) {
    return sendText(from, "I could not verify the saved resume version for this edit. No document was sent.")
  }
  const source = await readPath(gen.file).catch(() => null)
  if (!source) return sendText(from, "I could not open the exact resume version you replied to. No document was sent.")

  const jobId = createHash("sha256").update(from + ":" + msgId).digest("hex")
  const sourceHash = createHash("sha256").update(source).digest("hex")
  const snapshotPath = path.join(senderRoot, ".refine-recovery-" + jobId + ".docx")
  const snapshotKey = keyOf(snapshotPath)
  try {
    const created = await blob.putIfAbsent(snapshotKey, source)
    if (!created) {
      const existing = await readPath(snapshotPath)
      if (!existing || createHash("sha256").update(existing).digest("hex") !== sourceHash) {
        return sendText(from, "I could not verify the saved source copy for this edit. No document was sent.")
      }
    }
    await enqueueResumeRefinement({
      id: jobId,
      from,
      userId,
      jd: gen.jd,
      jdId: createHash("sha256").update(gen.jd).digest("hex"),
      resumePath: snapshotPath,
      resumeName: path.basename(gen.file),
      resumeFiled: gen.saved,
      refinement: {
        replyTo,
        request,
        sourcePath: gen.file,
        sourceHash,
        sourceSnapshotPath: snapshotPath,
        idempotencyKey: jobId,
        genSnapshot: {
          meta: gen.meta,
          changes: gen.changes || [],
          source: gen.source,
          saved: gen.saved,
          depth: gen.depth,
          held: gen.held,
          createdAt: gen.createdAt,
        },
      },
    })
  } catch {
    return sendText(from, "I could not save this edit for safe recovery, so no document was sent. The original resume is unchanged.")
  }

  await sendText(from, "Updating your resume: \"" + clip(request, 200) + "\"…")
  try {
    await processResumeRefinement(jobId)
  } catch {
    await deferResumeRefinement(jobId, "refinement_worker_error")
    await tellRefinementOnce(jobId, from, "Your edit is saved. I could not finish it just now, so no original or partial document was sent. I will retry from the saved version.")
  }
}

async function processResumeRefinement(jobId: string, options: { maxMs?: number } = {}) {
  const initial = await readResumeRecovery(jobId)
  if (!initial || initial.kind !== "refine" || initial.status !== "pending" || !initial.refinement) return
  const maxMs = Math.min(TAILOR_BUDGET_MS, Number.isFinite(options.maxMs) ? Number(options.maxMs) : TAILOR_BUDGET_MS)
  if (maxMs < RECOVERY_MIN_TAILOR_MS) {
    await deferResumeRefinement(jobId, "insufficient_runtime_budget")
    return
  }
  const job = await claimResumeRefinement(jobId)
  if (!job || !job.refinement) return
  const refinement = job.refinement

  const sender = await resolveWhatsAppUser(job.from)
  if (!sender.who) {
    await deferResumeRefinement(jobId, "account_not_verified")
    await tellRefinementOnce(jobId, job.from, "Your edit is saved, but I cannot verify the linked MarketFit account right now. No document was sent. I will retry when the account can be verified.")
    return
  }
  if (sender.who.userId !== job.userId) {
    await patchResumeRecovery(jobId, { status: "blocked", errorCode: "account_changed", processingAt: 0, processingToken: "" })
    await tellRefinementOnce(jobId, job.from, "The linked MarketFit identity changed, so I stopped this edit. No document was sent.")
    return
  }

  const senderRoot = path.join(VERSIONS_DIR, digits(job.from))
  const snapshotPath = path.resolve(refinement.sourceSnapshotPath)
  if (!snapshotPath.startsWith(path.resolve(senderRoot) + path.sep)) {
    await patchResumeRecovery(jobId, { status: "blocked", errorCode: "source_path_invalid", processingAt: 0, processingToken: "" })
    await tellRefinementOnce(jobId, job.from, "I could not verify the saved source version for this edit. No document was sent.")
    return
  }
  const source = await readPath(refinement.sourceSnapshotPath).catch(() => null)
  const sourceHash = source ? createHash("sha256").update(source).digest("hex") : ""
  if (!source || sourceHash !== refinement.sourceHash) {
    await patchResumeRecovery(jobId, { status: "blocked", errorCode: "source_hash_mismatch", processingAt: 0, processingToken: "" })
    await tellRefinementOnce(jobId, job.from, "I could not verify the exact saved resume version for this edit. No document was sent.")
    return
  }

  const savedGen = refinement.genSnapshot || {}
  const gen: Gen = {
    userId: job.userId,
    jd: job.jd,
    file: refinement.sourceSnapshotPath,
    meta: (savedGen.meta || {}) as Meta,
    changes: Array.isArray(savedGen.changes) ? savedGen.changes.map(String) : [],
    source: typeof savedGen.source === "string" ? savedGen.source : undefined,
    createdAt: Number(savedGen.createdAt) || job.createdAt,
    saved: typeof savedGen.saved === "string" ? savedGen.saved : undefined,
    depth: typeof savedGen.depth === "number" ? savedGen.depth : undefined,
    held: !!savedGen.held,
  }

  let result: TailorResult | null = null
  let file: Buffer | null = null
  if (refinement.generatedPath && refinement.generatedSha256) {
    const saved = await blob.get(refinement.generatedPath)
    if (saved) {
      const actualHash = createHash("sha256").update(saved).digest("hex")
      if (actualHash !== refinement.generatedSha256) {
        await patchResumeRecovery(jobId, { status: "blocked", errorCode: "generated_hash_mismatch", processingAt: 0, processingToken: "" })
        await tellRefinementOnce(jobId, job.from, "I could not verify the saved updated document, so no file was sent.")
        return
      }
      file = saved
      if (refinement.resultSnapshot && typeof refinement.resultSnapshot === "object")
        result = refinement.resultSnapshot as TailorResult
    }
  }

  if (!result || !file) {
    const keys = await keysFor("resume-change", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(job.from) }))
    if (!hasAnyKey(keys)) {
      await deferResumeRefinement(jobId, "provider_unavailable")
      await tellRefinementOnce(jobId, job.from, "Your edit is saved. Tailoring is temporarily unavailable, so no original or partial file was sent. I will retry from the saved version.")
      return
    }
    const asksHeadline = /\b(title|headline|header|tagline|designation)\b/i.test(refinement.request)
    const asksSummary = /\b(summary|profile|objective|about me|intro|introduction)\b/i.test(refinement.request)
    try {
      result = await runTailor({
        jd: job.jd,
        keys,
        userResumeDir: senderRoot,
        givenPath: refinement.sourceSnapshotPath,
        refine: refinement.request,
        immediatePrefs: confirmedCandidateStatements([refinement.request]),
        noCache: true,
        mode: "full",
        maxMs,
        sections: { headline: asksHeadline, summary: asksSummary, skills: true, experience: true },
      })
    } catch (error) {
      const timedOut = /timed out/i.test(String(error))
      await deferResumeRefinement(jobId, timedOut ? "tailor_timeout" : "tailor_error")
      await tellRefinementOnce(jobId, job.from, "Your edit is saved. I could not finish it just now, so no original or partial document was sent. I will retry from the saved version.")
      return
    }
    const lines = (result.diff || []).length + (result.edits?.extras || []).filter(e => (e.text || "").trim()).length
    if (!lines) {
      await patchResumeRefinement(jobId, { generationState: "rejected", rejectionCode: "no_changes" }, {
        status: "blocked", errorCode: "no_changes", processingAt: 0, processingToken: "",
      })
      await tellRefinementOnce(jobId, job.from, "Nothing needed changing for that request. No new document was sent.")
      return
    }
    const generatedPath = "tailored/" + result.token + ".docx"
    file = await blob.get(generatedPath)
    if (!file) {
      await deferResumeRefinement(jobId, "generated_document_missing")
      await tellRefinementOnce(jobId, job.from, "Your edit is saved. The updated Word file is not available yet, so no document was sent. I will retry from the saved version.")
      return
    }
    const generatedSha256 = createHash("sha256").update(file).digest("hex")
    await patchResumeRefinement(jobId, {
      generatedPath,
      generatedSha256,
      resultSnapshot: JSON.parse(JSON.stringify(result)),
      generationState: "generated",
      rejectionCode: undefined,
    })
  }

  if (!result || !file) {
    await deferResumeRefinement(jobId, "generated_state_missing")
    await tellRefinementOnce(jobId, job.from, "Your edit is saved, but I could not verify a complete updated document. No original or partial file was sent. I will retry from the saved version.")
    return
  }
  const lines = (result.diff || []).length + (result.edits?.extras || []).filter(e => (e.text || "").trim()).length
  if (!whatsappRewriteUsable(result)) {
    const reasons = whatsappResumeRejectionReasons(result)
    const rejectionCode = reasons.includes("unverified_jd_terms") ? "unsupported_claims_rejected"
      : reasons.includes("draft_parts_missing") ? "incomplete_document_rejected"
      : reasons.includes("ats_check_failed") ? "document_unreadable"
      : "quality_rejected"
    await patchResumeRefinement(jobId, { generationState: "rejected", rejectionCode })
    await deferResumeRefinement(jobId, rejectionCode)
    await tellRefinementOnce(jobId, job.from, "The updated document did not pass the existing completeness and supported-experience checks. Your edit is saved for retry. No original or partial document was sent.")
    return
  }
  if (!(await sameResumeFacts(source, file))) {
    await patchResumeRefinement(jobId, { generationState: "rejected", rejectionCode: "identity_guard_rejected" })
    await deferResumeRefinement(jobId, "identity_guard_rejected")
    await tellRefinementOnce(jobId, job.from, "The updated document did not pass the existing identity, contact and date checks. Your edit is saved for retry. No document was sent.")
    return
  }

  let meta = gen.meta
  if (!meta?.role && !meta?.company && !meta?.location) {
    try {
      const metaKeys = await keysFor("resume-change", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(job.from) }))
      if (hasAnyKey(metaKeys)) meta = await extractJdMeta({ keys: metaKeys, jd: job.jd })
    } catch { /* retain the saved metadata */ }
  }
  const changes = [...gen.changes, refinement.request]
  const name = await outputNameFor(file)
  const caption = captionFor(name, meta, result, { request: refinement.request, number: changes.length, lines })
  await patchResumeRefinement(jobId, { generationState: "ready", rejectionCode: undefined }, {
    status: "sending", errorCode: "", processingAt: 0, processingToken: "",
  })

  let wamid = ""
  try {
    wamid = await deliver(job.from, file, name, caption, {
      userId: job.userId, jd: job.jd, meta, changes, source: gen.source, saved: gen.saved, depth: gen.depth,
    }, jobId, true)
  } catch (error) {
    if ((error as Error)?.message === "version_store_failed") {
      await patchResumeRecovery(jobId, { status: "pending", processingAt: 0, processingToken: "" })
      await deferResumeRefinement(jobId, "version_store_failed")
      await tellRefinementOnce(jobId, job.from, "I could not safely save the updated file, so no document was sent. Your edit is saved and I will retry.")
    } else {
      await patchResumeRecovery(jobId, { status: "uncertain", errorCode: "delivery_ambiguous", processingAt: 0, processingToken: "" })
      await tellRefinementOnce(jobId, job.from, "WhatsApp's delivery status is unknown. I will not send a duplicate until a signed delivery update confirms what happened.")
    }
    return
  }
  if (!wamid) {
    await patchResumeRecovery(jobId, { status: "uncertain", errorCode: "delivery_ambiguous", processingAt: 0, processingToken: "" })
    await tellRefinementOnce(jobId, job.from, "WhatsApp's delivery status is unknown. I will not send a duplicate until a signed delivery update confirms what happened.")
    return
  }
  await markResumeDocumentAccepted(jobId, wamid)
  await recordWhatsAppUsage(job.userId, "resume_refine", result)
  const delivered = await readResumeRecovery(jobId)
  if (delivered?.deliveryState === "accepted") {
    await tellRefinementOnce(jobId, job.from, "WhatsApp accepted the updated file, but signed handset delivery is not confirmed yet. I will not send a duplicate while the status is unknown.")
  }
}

// Send the document and keep a copy of this exact version, recorded under the sent
// message's id, so a later swipe-reply to it can be traced back and edited.
async function deliver(from: string, file: Buffer, name: string, caption: string, gen: Omit<Gen, "file" | "createdAt">, opaqueJobId?: string, requireStored = false): Promise<string> {
  const vfile = path.join(VERSIONS_DIR, digits(from), \`mwaab1xw-\${randomBytes(4).toString("hex")}.docx\`)
  // Store the copy while the upload runs, so it costs no extra wall time.
  const stored = writePath(vfile, file).then(() => true, () => false)
  if (requireStored && !(await stored)) {
    await deletePath(vfile).catch(() => {})
    throw new Error("version_store_failed")
  }
  let wamid = ""
  try {
    wamid = await sendDocument(from, file, \`\${name}.docx\`, caption, opaqueJobId)
  } catch (e) {
    if (await stored) await deletePath(vfile)
    throw e
  }
  if (!(await stored)) return wamid
  if (wamid) await saveGen(from, wamid, { ...gen, file: vfile, createdAt: Date.now() })
  else await deletePath(vfile)
  return wamid
}

// What the reply says about the keywords, plainly. Every job-post keyword goes in (19 Oct 2026; certifications never) and
// the tailor's floor writes what the rewrite left out onto the skills section (26 Oct 2026, "the baseline is serve at
// least 90% match"), so those terms are named: they came from the job post, not from the resume, and the person checks
// them. Missing terms do not establish a timeout (PR #79, 26 Oct): what is still not covered is named as a gap.
function notAdded(result: TailorResult): string[] {
  const out: string[] = []
  if (result.skills_only) out.push("The AI writers did not answer in time, so this file only adds the job post's keywords; your experience is as you wrote it. Send *redo* for the full rewrite.")
  // The floor's terms and the ones the AI writer itself put on the skills line (blueprint 2026-10-30, item 5).
  const placed = [...new Set([...(result.placed_from_jd || []), ...(result.skills_from_jd_writer || [])])]
  if (placed.length) out.push(`Added to your skills from the job post: ${placed.slice(0, 8).join(", ")}${placed.length > 8 ? ` and ${placed.length - 8} more` : ""}. Check you can speak to each.`)
  if (result.placed_in_summary?.length) out.push(`Added to your summary as strengths: ${result.placed_in_summary.join(", ")}.`)
  const unplaced = unplacedTermsLine(result.jd_terms_unplaced, result.jd_terms_unplaced_reason)
  if (unplaced) out.push(unplaced)
  const listed = new Set((result.jd_terms_unplaced || []).map(t => t.toLowerCase()))
  const missing = [...new Set([...(result.keyword_analysis?.missing || []), ...(result.quality?.missing || [])].map(m => String(m || "").trim()).filter(m => m && !isCertification(m) && !listed.has(m.toLowerCase())))]
  // Below the 95% target the file is sent with the full shortfall named (blueprint 2026-10-30), not refused.
  const short = Number.isFinite(result.coverage) && result.coverage! < 95
  if (missing.length && short) out.push(`Below the 95% target (${result.coverage}% of the job post). Still missing: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ` and ${missing.length - 12} more` : ""}. Add any you can speak to.`)
  else if (missing.length) out.push(`Not covered in this file: ${missing.slice(0, 6).join(", ")}. These gaps need review against your actual experience.`)
  // Some parts of the rewrite never came back: said whatever else the file shows.
  if ((result.partial && !result.skills_only) || (!out.length && result.quality?.status === "needs_review")) out.push("This result is incomplete and needs review. Reply to this file to request changes.")
  return out
}

// Every successful WhatsApp tailoring run gets an explicit, evidence-aware JD gap report.
// Keyword presence is not proof of hands-on experience, and the percentage is not an employer ATS score.
function resumeGapReport(result: TailorResult): string {
  const analysis = result.keyword_analysis
  const unique = (terms: string[] = []) => {
    const seen = new Set<string>()
    return terms.map(t => String(t).replace(/\s+/g, " ").trim()).filter(t => {
      const key = t.toLowerCase()
      if (!t || seen.has(key)) return false
      seen.add(key)
      return true
    })
  }
  const matched = unique(analysis?.matched || [])
  const added = unique(analysis?.added || [])
  const missing = unique([...(analysis?.missing || []), ...(result.jd_terms_unplaced || []), ...(result.quality?.missing || [])])
  const unverified = unique(result.unverified_added_keywords || [])
  const measured = (value: number | undefined): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100
  const covered = measured(result.coverage) ? `${result.coverage}%` : "Not measured"
  const supported = measured(result.supported_coverage) ? `${result.supported_coverage}%` : "Not measured"
  // sendText truncates at 4000 UTF-16 units. Bound each list independently so
  // no keyword list can erase the risk or evidence warning. Counts retain omissions.
  const list = (terms: string[]) => {
    if (!terms.length) return "None identified"
    const shown: string[] = []
    for (const term of terms.slice(0, 20)) {
      const points = Array.from(term)
      const short = points.slice(0, 120).join("") + (points.length > 120 ? "…" : "")
      if ([...shown, short].join(", ").length > 600) break
      shown.push(short)
    }
    return shown.join(", ") + (terms.length > shown.length ? ` (+${terms.length - shown.length} more)` : "")
  }
  const needsReview = result.skills_only || result.partial || result.unchanged || missing.length || unverified.length ||
    result.quality_blockers?.length || result.quality?.incomplete || result.quality?.status !== "coverage_met" ||
    !measured(result.coverage) || result.coverage < 95 || !measured(result.supported_coverage) || result.supported_coverage < 95
  return [
    "*MFit Resume Gap & Risk Report*",
    `Estimated JD keyword coverage: ${covered} (not an employer ATS score)`,
    `Resume-supported coverage: ${supported}`,
    `Risk: ${needsReview ? "Needs review" : "Keyword review passed; experience evidence still requires verification"}`,
    "Mandatory hands-on requirements must be supported by specific experience bullets, not just keywords. Verify each added claim before applying.",
    `Already matched: ${list(matched)}`,
    `Newly placed: ${list(added)}`,
    `Missing / unresolved JD terms: ${list(missing)}`,
    `Added claims needing verification: ${list(unverified)}`,
    // Enrichment visibility (Nov 4): the two Gemini passes run before
    // editing, but their output used to be invisible — the reported
    // coverage counts original JD terms only. Show suggested vs placed
    // vs gate-blocked so a "no keywords added" report can be checked.
    ...(result.enrichment_suggested?.length ? [`Gemini enrichment (two passes before editing): suggested ${result.enrichment_suggested.length} — placed in the file: ${list(result.enrichment_placed || [])} — not placed because your resume does not evidence them: ${list(result.enrichment_blocked || [])}`] : []),
  ].join("\n")
}

// The send check. sameResumeIdentity compares every email and, with the job-post terms gate on, runs the round-trip guard:
// the name, every email, phone, link and date of the source must be in the exported file unchanged, and none added.
async function sameResumeFacts(source: Buffer, file: Buffer): Promise<boolean> {
  const [a, b] = await Promise.all([docxIdentityText(source), docxIdentityText(file)])
  return sameResumeIdentity(a, b)
}

// Same switch as src/lib/jd-terms-gate.ts, kept local so the route's test harnesses need no new module mocks.
function jdTermsGateOn(): boolean {
  const v = String(process.env.JD_TERMS_ALWAYS_ON_SKILLS ?? "").trim().toLowerCase()
  return !(v === "0" || v === "false" || v === "off" || v === "no")
}

function unplacedTermsLine(terms: string[] | undefined, reason: string | undefined): string {
  const list = (terms || []).filter(Boolean)
  if (!list.length || !reason) return ""
  const why = reason === "skills_locked" ? "you asked me not to edit your skills" : "your resume has no skills section"
  const shown = list.slice(0, 10).join(", ") + (list.length > 10 ? ` and ${list.length - 10} more` : "")
  return `Not added to the file because ${why}: ${shown}. Add any you can speak to.`
}

function chosenLabel(files: FromFiles | undefined, resumeName?: string): string {
  if (files?.said) return files.said.split(". I chose")[0]
  if (resumeName) return `*${resumeName}*`
  return "the resume already chosen for this job"
}

function unfinishedRewriteWhy(result: TailorResult): string {
  if (result.partial || result.quality?.incomplete || result.skills_only) return "The rewrite was marked incomplete."
  if (result.quality_blockers?.includes("roles_unrewritten")) return "Some experience sections were not rewritten."
  return "The rewrite did not finish cleanly."
}

function closestResumeCaption(name: string, label: string, why: string): string {
  return [
    `*${name}*`,
    `This is your closest matching resume (${label}) because the rewrite did not finish cleanly. ${why} This file was not rewritten.`,
    "Reply to this file to request changes.",
  ].join("\n")
}

function qualityStop(result: TailorResult): string {
  const reasons = whatsappResumeRejectionReasons(result)
  const invented = (result.unverified_added_keywords || []).filter(Boolean).slice(0, 6)
  // Gate on, this refusal is gone: a job-post term in a bullet is sent back and moved to the skills line in runTailor.
  // Gate off (JD_TERMS_ALWAYS_ON_SKILLS=0) restores it.
  if (invented.length && !jdTermsGateOn()) {
    return `I did not send a file. The draft added ${invented.join(", ")} from the job post, and those are not in your resume, so I will not present them as your experience. Your resume and this job are saved for another try. No incomplete file was delivered.`
  }
  if (reasons.includes("jd_coverage_below_floor")) {
    const pct = Number.isFinite(result.coverage) ? `${result.coverage}%` : "under 95%"
    const gaps = [...(result.keyword_analysis?.missing || []), ...(result.quality?.missing || [])].filter(m => m && !isCertification(m))
    const all = [...new Set(gaps)]
    const named = all.slice(0, 8)
    // Nov 4 SailPoint hold: the pick line counts only the headline requirements
    // used to choose the resume, while this floor counts every extracted term —
    // say so, or "2 of 2" followed by "40%" reads as a contradiction. Also show
    // the hidden total whenever the named list is sliced.
    const more = all.length > named.length ? ` and ${all.length - named.length} more` : ""
    return `I did not send a file. The rewrite reached ${pct} of the job post, below the 95% floor.${named.length ? ` Still missing: ${named.join(", ")}${more}.` : ""} The earlier pick line counted only the headline requirements used to choose this resume; this floor counts every extracted term. Your resume and this job are saved for another try. No incomplete file was delivered. Reply to this message with the experience you actually have — for example, "I have experience with Splunk and AWS" — and I will redo it with those as evidence.`
  }
  if (reasons.includes("supported_coverage_below_floor")) {
    const supported = Number.isFinite(result.supported_coverage) ? `${Math.round(result.supported_coverage!)}%` : "too little"
    return `I did not send a file. Of the skills your resume already supports, this draft covered ${supported}. A file goes out only at 95% or more of those skills. Your resume and this job are saved for another try. No incomplete file was delivered.`
  }
  if (reasons.includes("skills_only")) {
    return "I did not send a file. The writers did not finish a full resume, so nothing incomplete went out. Your resume and this job are saved, and MarketFit will try again."
  }
  if (reasons.includes("ats_check_failed")) {
    const issues = (result.ats?.issues || []).slice(0, 4).join("; ")
    return `I did not send a file. The draft failed the ATS parse check${issues ? `: ${issues}` : ""}. Your resume and this job are saved for another try. No incomplete file was delivered.`
  }
  // Nov 5, 06:08 hold: a draft can cover the JD and pass ATS yet still be
  // partial — some sections never came back from the writers — and the generic
  // fallthrough below named only "the quality report is incomplete", with no
  // hint which sections are unfinished or what to do next. Name them (the run
  // knows: result.partial carries pendingRoles/pendingProfile) and invite the
  // reply-redo: the hold anchors the baseline, so a reply re-runs it.
  if (result.partial) {
    const bits: string[] = []
    if (result.partial.pendingProfile) bits.push("the profile section")
    const pendingRoles = result.partial.pendingRoles?.length || 0
    if (pendingRoles === 1) bits.push("1 experience section")
    else if (pendingRoles > 1) bits.push(`${pendingRoles} experience sections`)
    const where = bits.length ? ` The unfinished ${bits.length > 1 ? "parts are" : "part is"} ${bits.join(" and ")}.` : ""
    return `I did not send a file. The rewrite did not finish.${where} Your resume and this job are saved for another try. No incomplete file was delivered. Reply to this message and I will run it again — the unfinished sections get a fresh attempt.`
  }
  const named = describeRejectionReasons(reasons)
  if (named.length) {
    return `I did not send a file. The draft was held: ${named.join("; ")}. Your resume and this job are saved for another try. No incomplete file was delivered.`
  }
  return "I did not send a file. The draft did not pass the checks for a finished resume that stays within your real experience. Your resume and this job are saved for another try. No incomplete file was delivered."
}

function captionFor(name: string, meta: Meta, result: TailorResult, update?: { request: string; number: number; lines: number }, more: string[] = []): string {
  // Never present an unchanged resume as tailored — say so plainly.
  if (result.unchanged) {
    return [
      `*${name}*${update ? ` (update ${update.number})` : ""}`,
      ...(meta.role ? [`${meta.role}${meta.company ? ` · ${meta.company}` : ""}`] : []),
      "No changes were made — the tailor couldn't improve on your resume for this JD, so this file is identical to your original.",
      "Reply to this file to request changes.",
    ].join("\n")
  }
  const supported = Number.isFinite(result.supported_coverage) ? `Skills your resume already supports: ${result.supported_coverage}%` : ""
  const overall = Number.isFinite(result.coverage) ? `JD keyword coverage ${result.coverage}%` : ""
  const atsLine = result.ats?.passed ? `ATS parse check: ${result.ats.score}%` : ""
  // Nov 4: every delivered file reports ATS plus the risk factor score, side by
  // side, both measured on the run's own record — never a model verdict. The
  // risk rides the ATS line itself (never a line of its own), so the caption
  // keeps its short shape: a separate risk line broke the five-line caption
  // contract in whatsapp-single-request, and a result with no passing ATS
  // check is a held run, not a delivery, so it carries no delivery caption.
  const risk = atsLine ? riskScore({
    coverage: result.coverage,
    atsIssues: result.ats?.issues,
    atsPassed: result.ats?.passed,
    unverifiedAdded: result.unverified_added_keywords,
    missing: [...(result.keyword_analysis?.missing || []), ...(result.quality?.missing || [])],
    qualityBlockers: result.quality_blockers,
  }) : null
  return [
    `*${name}*${update ? ` (update ${update.number})` : ""}`,
    ...(meta.role ? [`${meta.role}${meta.company ? ` · ${meta.company}` : ""}`] : []),
    ...more,
    ...(supported ? [supported] : []),
    ...(overall ? [overall] : []),
    ...(atsLine && risk ? [`${atsLine} · Risk factor: ${risk.score}/100 (${risk.level})`] : []),
    ...notAdded(result),
    "Reply to this file to request changes.",
  ].join("\n")
}
