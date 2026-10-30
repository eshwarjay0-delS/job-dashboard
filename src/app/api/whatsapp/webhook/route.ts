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
import { sendText as sendTextRaw, sendDocument as sendDocumentRaw, downloadMedia, verifySignature, senderAllowed, waConfigured, waSignatureConfigured } from "@/lib/whatsapp"
import { recordUpdateProviderStatus } from "@/lib/mail-update-store"
import { trace } from "@/lib/whatsapp-trace"
import { isOwnerWhatsApp } from "@/lib/owner"
import { resolveWhatsAppUser, claimNotice, textCodesWork } from "@/lib/whatsapp-who"
import { claimLinkCode } from "@/lib/whatsapp-link"
import { notRegisteredMessage, NOT_CHECKED_MESSAGE, siteOf } from "@/lib/whatsapp-who-core"
import { sameResumeIdentity } from "@/lib/resume-identity"
import { extractText } from "@/lib/docx"
import { handleWhatsAppKompas } from "@/lib/whatsapp-kompas-channel"
import { speechToWhatsAppText } from "@/lib/whatsapp-voice"
import { extractProfile } from "@/lib/profile"
import { plainFailure } from "@/lib/plain-failure"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"
import { isCertification } from "@/lib/keyword-targets"
import { libraryOf, numberedEmails, candidatesFor } from "@/lib/library-pick-store"
import { askWhichEmail, choiceIn, readChoice, live, rankFor, saidOf, DIFFERENT_RESUME } from "@/lib/library-pick"
import { existingForJob, saveTailored, saveUpload, markUsed, relOf } from "@/lib/resume-library-store"
import { madeMeetsFloor } from "@/lib/made-floor"
import { acceptableWhatsAppResume, whatsappResumeRejectionReasons } from "@/lib/whatsapp-resume-acceptance"
import { enqueueResumeRecovery, patchResumeRecovery, deferResumeRecovery, dueResumeRecoveries, hasResumeRecoveryForJD, markResumeDocumentAccepted, recordResumeDeliveryStatus, readResumeRecovery } from "@/lib/whatsapp-resume-recovery"
import { recoveryTailorBudget, RECOVERY_MIN_TAILOR_MS } from "@/lib/whatsapp-recovery-budget"
import { jobKeyOf, type SavedFile } from "@/lib/resume-library"
import { readPicks } from "@/lib/library-agent"
import { chooseResume, type Prefer } from "@/lib/library-choose"
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
  pending?: { jd: string; jdId: string; slots: string[]; at: number; hint?: string }
  /** The last job made from Files, for "redo" and "make another one with the X resume". `used`: the resume it started from. */
  last?: { jd: string; email: string; at: number; used?: string }
  /** Current profile selection; never rewrites the immutable last JD/source for recovery. */
  preferredEmail?: string
  /** Approval card awaiting the owner's edited draft text (Phase 4, chief-approvals). */
  awaitingEditCardId?: string
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
      await handle(from, input, session, userId, verifiedKompasAccount)
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

async function handle(from: string, msg: Record<string, unknown>, session: Session, userId: string, verified: boolean) {
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
    /^(?:use|switch(?:\s+to)?|profile|email)\s+[1-9]\d{0,2}$|^(?:help|hi|hello|menu|start)$/i.test(
      String((msg.text as { body?: string } | undefined)?.body || "").trim(),
    )

  // Kompas has an explicit opt-in command and an independent, account-owned session.
  // All other WhatsApp traffic continues through the original MFit resume workflow.
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
      console.error("[whatsapp] kompas handoff failed", String(error).slice(0, 160))
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
        return fromLibrary(from, job, email, userId, !!session.pending.hint, session.pending.slots, session.pending.hint ? { hint: session.pending.hint } : undefined)
      }
      if (!replyTo) return sendText(from, askWhichEmail(session.pending.slots))
    }
    // A swipe-reply is a change request for the resume being replied to. Checked before
    // the JD path: a reply is never a new JD (new JDs are always pasted as their own message).
    if (replyTo) return refine(from, replyTo, text, userId)

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

async function generate(from: string, session: Session, userId: string, maxMs = TAILOR_BUDGET_MS, files?: FromFiles, quiet = false) {
  const startedAt = Date.now()
  if (!session.jd || !session.resumePath) return quiet ? undefined : sendText(from, HELP)
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
  // A quiet recovery still owes the chat one sentence the first time. Repeating it on every later retry is noise.
  const sayOutcome = async (text: string) => {
    if (quiet) {
      const current = await readResumeRecovery(job).catch(() => null)
      if (current?.toldUser) return
      await patchResumeRecovery(job, { toldUser: true }).catch(() => {})
    }
    told = true
    await sendText(from, text).catch(() => {})
  }
  let failedCandidate: { token: string; coverage: number; supportedCoverage: number } | undefined
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
    ? `Updating ${files.said}. A Word file is sent only if this run finishes cleanly.`
    : "Updating your resume. A Word file is sent only if this run finishes cleanly.")

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  const metaPromise = extractJdMeta({ keys, jd: session.jd }).catch(() => ({ role: "", company: "", location: "" }))

  const tailorWithin = (opts: Parameters<typeof runTailor>[0]) => {
    const limit = Math.max(1000, Math.min(opts.maxMs || maxMs, maxMs))
    let timer: ReturnType<typeof setTimeout> | undefined
    return new Promise<TailorResult>((resolve, reject) => {
      timer = setTimeout(() => reject(new Error("Tailoring timed out")), limit)
      const stop = () => { try { clearTimeout(timer) } catch { /* the timer already fired */ } }
      runTailor(opts).then(value => { stop(); resolve(value) }, error => { stop(); reject(error) })
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
      // Reserve a second full attempt instead of consuming the entire webhook window.
      maxMs: maxMs >= 120_000 ? Math.min(150_000, Math.floor(maxMs * 0.65)) : maxMs,
      // "redo" asks for a fresh rewrite, not the one kept for the same inputs.
      ...(files?.redo ? { noCache: true } : {}),
      // Match the dashboard defaults: summary left as written, skills + experience retargeted.
      sections: { summary: false, skills: true, experience: true },
    })
  } catch (e) {
    failureCode = "provider_error"
    console.error("[whatsapp] tailor failed", String(e).slice(0, 300))
    await sayOutcome("I could not tailor your resume just now. Your resume and this job are saved, and MarketFit will try again.")
    return;
  }

  // Nothing came back different: the same file with "Match 28% -> 28%" on it is not a tailored resume, so it is not sent as one.
  // A retry supplies a fresh JD and resume pair.
  if (result.unchanged) {
    console.error("[whatsapp] tailor changed nothing", (result.notes || []).find(n => n.startsWith("Tailored with")) || "")
    failureCode = "unchanged"
    await sayOutcome("The rewrite produced no changes, so I did not send a file. Your request is saved and will be retried automatically.")
    return;
  }

  // A cached, incomplete result must never permanently block the same JD.
  // Give the engine one fresh full rewrite while there is enough request budget.
  // Under 95% of the job post a complete file is delivered with the shortfall listed (TAILOR_DELIVER_WITH_SHORTFALL), so
  // it still gets the one fresh rewrite first, and the acceptable pass with the higher coverage is the one sent.
  const belowTarget = (r: TailorResult) => Number.isFinite(r.coverage) && r.coverage! < 95
  const firstRejected = !acceptableWhatsAppResume(result) || belowTarget(result)
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
          sections: { summary: false, skills: true, experience: true },
        })
        if (acceptableWhatsAppResume(fresh) && (!acceptableWhatsAppResume(result) || (fresh.coverage ?? 0) > (result.coverage ?? 0))) result = fresh
        else if (!acceptableWhatsAppResume(result)) {
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

  // A low-quality or partial draft is never a completed tailored resume.
  // Do not save it, send it as final, or silently claim a match that is not supported.
  const coverage = result.coverage ?? result.score
  if (!acceptableWhatsAppResume(result)) {
    failureCode = "quality_rejected"
    failedCandidate = { token: result.token, coverage, supportedCoverage: result.supported_coverage ?? 0 }
    console.error("[whatsapp] tailoring quality gate rejected draft", {
      coverage, supportedCoverage: result.supported_coverage,
      partial: !!result.partial, skillsOnly: !!result.skills_only,
      status: result.quality?.status, incomplete: !!result.quality?.incomplete,
      blockers: whatsappResumeRejectionReasons(result),
      roleCount: result.role_alignment?.length ?? 0,
      unverifiedCount: result.unverified_added_keywords?.length ?? 0,
    })
    await sayOutcome(qualityStop(result))
    return;
  }
  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) {
    failureCode = "file_missing"
    await sayOutcome("I did not send a file. The draft was made but the Word file could not be opened. Your resume and this job are saved for another try.")
    return;
  }

  const source = await readPath(session.resumePath)
  if (!source || !(await sameResumeFacts(source, file))) {
    failureCode = "identity_mismatch"
    await sayOutcome("I did not send a file. The draft changed the name or email on the resume, so I stopped. Your original resume and this job are saved for another try.")
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
  const floorMade = !!(result.placed_from_jd?.length || result.placed_in_summary?.length)
  if (result.skills_only) more.push("Not saved in Files: send *redo* once the writers are back for the full rewrite.")
  if (!files && filesDir && !result.skills_only) {
    const fromRel = session.resumeFiled ? relOf(filesDir, session.resumeFiled) : undefined
    filed = await saveTailored({ userDir: filesDir, bytes: file, jd: session.jd, role: meta.role, company: meta.company, depth: floorMade ? 2 : 1,
      ...(fromRel && !fromRel.startsWith("..") ? { from: fromRel } : {}),
      asked: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || []), ...(result.keyword_analysis?.missing || [])],
      covers: [...(result.keyword_analysis?.matched || []), ...(result.keyword_analysis?.added || [])] })
      .catch(e => { console.error("[whatsapp] not filed", String(e).slice(0, 200)); return null })
    if (filed) more.push(`Saved in your Files: ${filed.email} / ${filed.category}`)
  }
  if (files) {
    filed = result.skills_only ? null : await saveTailored({ userDir: files.userDir, bytes: file, jd: session.jd, role: meta.role, company: meta.company,
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
    if (!told) await sayOutcome("The run stopped before a file or a reason went out. Your resume and this job are saved, and MarketFit will try again.")
  } finally {
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
  // Counts only: no candidate identity, JD or resume content in logs.
  console.info("[whatsapp] resume recovery cron", { bootstrapped, due: jobs.length, attempted, accepted, handsetConfirmed, stillPending })
  return NextResponse.json({ bootstrapped, attempted, accepted, handsetConfirmed, stillPending, due: jobs.length })
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
    if (have && await madeMeetsFloor(have.abs, job.jd, have.file.at)) return sendSaved(from, have, job.jd, email, userId)
    if (have) redo = true
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
  if (!source || !(await sameResumeFacts(source, file))) {
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
async function deliver(from: string, file: Buffer, name: string, caption: string, gen: Omit<Gen, "file" | "createdAt">, opaqueJobId?: string): Promise<string> {
  const vfile = path.join(VERSIONS_DIR, digits(from), `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.docx`)
  // Store the copy while the upload runs, so it costs no extra wall time.
  const stored = writePath(vfile, file).then(() => true, () => false)
  let wamid = ""
  try {
    wamid = await sendDocument(from, file, `${name}.docx`, caption, opaqueJobId)
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
  const missing = (result.quality?.missing || []).filter(m => !isCertification(m) && !listed.has(m.toLowerCase()))
  // Below the 95% target the file is sent with the full shortfall named (blueprint 2026-10-30), not refused.
  const short = Number.isFinite(result.coverage) && result.coverage! < 95
  if (missing.length && short) out.push(`Below the 95% target (${result.coverage}% of the job post). Still missing: ${missing.slice(0, 12).join(", ")}${missing.length > 12 ? ` and ${missing.length - 12} more` : ""}. Add any you can speak to.`)
  else if (missing.length) out.push(`Not covered in this file: ${missing.slice(0, 6).join(", ")}. These gaps need review against your actual experience.`)
  // Some parts of the rewrite never came back: said whatever else the file shows.
  if ((result.partial && !result.skills_only) || (!out.length && result.quality?.status === "needs_review")) out.push("This result is incomplete and needs review. Reply to this file to request changes.")
  return out
}

// The send check. sameResumeIdentity compares every email and, with the job-post terms gate on, runs the round-trip guard:
// the name, every email, phone, link and date of the source must be in the exported file unchanged, and none added.
async function sameResumeFacts(source: Buffer, file: Buffer): Promise<boolean> {
  const [a, b] = await Promise.all([extractText(source), extractText(file)])
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
    const named = [...new Set(gaps)].slice(0, 8)
    return `I did not send a file. The rewrite reached ${pct} of the job post, below the 95% floor.${named.length ? ` Still missing: ${named.join(", ")}.` : ""} Your resume and this job are saved for another try. No incomplete file was delivered.`
  }
  if (reasons.includes("supported_coverage_below_floor")) {
    const supported = Number.isFinite(result.supported_coverage) ? `${Math.round(result.supported_coverage!)}%` : "too little"
    return `I did not send a file. Of the skills your resume already supports, this draft covered ${supported}. A file goes out only at 95% or more of those skills. Your resume and this job are saved for another try. No incomplete file was delivered.`
  }
  if (reasons.includes("skills_only")) {
    return "I did not send a file. The writers did not finish a full resume, so nothing incomplete went out. Your resume and this job are saved, and MarketFit will try again."
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
  return [
    `*${name}*${update ? ` (update ${update.number})` : ""}`,
    ...(meta.role ? [`${meta.role}${meta.company ? ` · ${meta.company}` : ""}`] : []),
    ...more,
    ...(supported ? [supported] : []),
    ...(overall ? [overall] : []),
    ...notAdded(result),
    "Reply to this file to request changes.",
  ].join("\n")
}
