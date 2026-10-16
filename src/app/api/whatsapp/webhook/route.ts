/**
 * WhatsApp chatbot webhook.
 *
 * Conversation: send a JD and a .docx resume in EITHER order. As soon as the bot has
 * both, it tailors and sends the result back as "Eshwar Resume.docx", captioned with
 * the Role / Location / Company it was built for. The session then clears, so every
 * generation starts fresh with a new JD + resume. This is the Oct 5 stable tailor flow,
 * intentionally without filing originals or generated resumes in MarketFit Files.
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
import { blob, readPath, writePath, existsPath, deletePath } from "@/lib/storage"
import { DATA_DIR } from "@/lib/paths"
import { resolveKeys, hasAnyKey, keysFor, tailorKeys } from "@/lib/llm"
import { runTailor, type TailorResult } from "@/lib/tailor"
import { extractJdMeta } from "@/lib/claude"
import { sendText, sendDocument, downloadMedia, verifySignature, senderAllowed, waConfigured } from "@/lib/whatsapp"
import { isOwnerWhatsApp } from "@/lib/owner"
import { resolveWhatsAppUser, claimNotice, textCodesWork } from "@/lib/whatsapp-who"
import { claimLinkCode } from "@/lib/whatsapp-link"
import { notRegisteredMessage, NOT_CHECKED_MESSAGE, siteOf } from "@/lib/whatsapp-who-core"
import { sameResumeIdentity } from "@/lib/resume-identity"
import { extractText } from "@/lib/docx"
import { extractProfile } from "@/lib/profile"
import { plainFailure } from "@/lib/plain-failure"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const maxDuration = 180
export const dynamic = "force-dynamic"

const INBOX_DIR = path.join(DATA_DIR, "whatsapp", "inbox")
const TAILOR_BUDGET_MS = 165_000

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
type Session = { version?: 3; jd?: string; jdId?: string; resumePath?: string; resumeName?: string; resumeAt?: number; seen?: string[]; updatedAt?: number }
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
  "*Resume Tailor Bot*",
  "",
  "Send me two things, in any order:",
  "1. The *job description* (paste it as a message)",
  "2. Your *resume* as a .docx file",
  "",
  "As soon as I have both, I'll tailor it and send it back as a Word file named after you.",
  "",
  "*Want changes?* Swipe right on a resume I sent (or long-press → Reply) and type what to change, e.g. _add more Terraform_ or _make the bullets shorter_. Each update builds on the version you replied to, so you can keep refining.",
  "",
  "Commands: *reset* · *status* · *help*",
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
      if (claim.ok) await sendText(from, "Linked to MarketFit. Send a job description and a Word (.docx) resume to tailor it. Each request starts fresh, and documents are not added to your Files.")
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

  try {
    await handle(from, msg, session, userId)
  } catch (e) {
    try { await sendText(from, plainFailure(e, "do that", true)) } catch { /* ignore */ }
  }
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
    if (cmd === "status") {
      return sendText(from, [
        `JD: ${session.jd ? "received" : "waiting"}`,
        `Resume: ${session.resumeName ? session.resumeName : "waiting"}`,
      ].join("\n"))
    }
    // A swipe-reply is a change request for the resume being replied to. Checked before
    // the JD path: a reply is never a new JD (new JDs are always pasted as their own message).
    const replyTo = (msg.context as { id?: string } | undefined)?.id
    if (replyTo) return refine(from, replyTo, text, userId)

    // Too short to be a JD — most likely a stray message, so guide instead of guessing.
    if (text.length < 60) {
      return sendText(from, `That looks too short to be a job description (${text.length} characters).\n\n${HELP}`)
    }

    session = await loadSession(from)
    session.jd = text
    session.jdId = String(msg.id)
    await saveSession(from, session)
    if (!session.resumePath) return sendText(from, "Got the job description. Now send your resume as a *.docx* file.")
    return generate(from, session, userId)
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

    session = await loadSession(from)
    session.resumePath = dest
    session.resumeName = safe.replace(/\.docx$/i, "")
    session.resumeAt = Date.now()
    await saveSession(from, session)
    if (!session.jd) return sendText(from, `Saved *${session.resumeName}*. Now paste the job description.`)
    return generate(from, session, userId)
  }

  return sendText(from, HELP)
}

// ── Tailor + reply ────────────────────────────────────────────────────────────
async function generate(from: string, session: Session, userId: string, maxMs = TAILOR_BUDGET_MS) {
  const keys = await keysFor("resume-tailor", () => tailorKeys(resolveKeys({}), { owner: isOwnerWhatsApp(from) }))
  if (!hasAnyKey(keys)) return sendText(from, "No AI provider key is configured on the server.")
  if (!session.jd || !session.resumePath) return sendText(from, HELP)

  // One claim per JD, across all workers and either input order. Claim before any AI call.
  const job = createHash("sha256").update(`${from}:${session.jdId || session.jd}`).digest("hex")
  if (!await blob.putIfAbsent(`whatsapp/jobs/${job}`, "1")) return
  // Consume this pair now. Completion must not erase a newer request arriving meanwhile.
  await saveSession(from, { seen: session.seen })

  await sendText(from, "Updating your resume. I’ll send one Word file when this run finishes.")

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  const metaPromise = extractJdMeta({ keys, jd: session.jd })

  let result: TailorResult
  try {
    result = await runTailor({
      jd: session.jd,
      keys,
      userResumeDir: path.join(INBOX_DIR, digits(from)),
      givenPath: session.resumePath,
      mode: "full",
      maxMs,
      // Match the dashboard defaults: summary left as written, skills + experience retargeted.
      sections: { summary: false, skills: true, experience: true },
    })
  } catch (e) {
    // The pair was consumed before generation; a retry supplies a new pair.
    console.error("[whatsapp] tailor failed", String(e).slice(0, 300))
    return sendText(from, "I could not tailor your resume just now: the AI services that write it are busy or out of their allowance. Please resend the job description and resume to retry.")
  }

  // Nothing came back different: the same file with "Match 28% -> 28%" on it is not a tailored resume, so it is not sent as one.
  // A retry supplies a fresh JD and resume pair.
  if (result.unchanged) {
    console.error("[whatsapp] tailor changed nothing", (result.notes || []).find(n => n.startsWith("Tailored with")) || "")
    return sendText(from, "I read the job description against your resume and no line came back changed, so I am not sending you the same file. This usually means the AI services were short of capacity. Please resend the job description and resume to retry.")
  }

  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) return sendText(from, "The resume generated but the file could not be read back. Please try again.")

  const source = await readPath(session.resumePath)
  if (!source || !sameResumeIdentity(await extractText(source), await extractText(file))) {
    return sendText(from, "The generated file changed the resume’s contact email, so I stopped delivery. Please resend your JD and resume to retry.")
  }
  const meta = await metaPromise
  const name = await outputNameFor(file)
  await deliver(from, file, name, captionFor(name, meta, result), { userId, jd: session.jd, meta, changes: [], source: session.resumeName })
  await recordWhatsAppUsage(userId, "resume_tailor", result)

  if (session.resumePath?.startsWith(path.join(INBOX_DIR, digits(from)) + path.sep))
    await deletePath(session.resumePath).catch(() => {})
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

function captionFor(name: string, meta: Meta, result: TailorResult, update?: { request: string; number: number; lines: number }): string {
  const coverage = result.coverage ?? result.score
  return [
    `*${name}*${update ? ` (update ${update.number})` : ""}`,
    ...(meta.role ? [`${meta.role}${meta.company ? ` · ${meta.company}` : ""}`] : []),
    `JD keyword coverage: ${coverage}%.`,
    ...(result.quality?.status === "needs_review" ? ["Below your 95% target; this result is incomplete."] : []),
    "Reply to this file to request changes.",
  ].join("\n")
}
