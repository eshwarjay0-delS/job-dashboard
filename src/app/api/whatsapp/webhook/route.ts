/**
 * WhatsApp chatbot webhook.
 *
 * Conversation: send a JD and a .docx resume in EITHER order. As soon as the bot has
 * both, it tailors and sends the result back as "Eshwar Resume.docx", captioned with
 * the Role / Location / Company it was built for. The session then clears, so every
 * generation starts fresh with a new JD + resume.
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
import { blob, writePath, existsPath, deletePath } from "@/lib/storage"
import { DATA_DIR, USER_RESUMES_DIR } from "@/lib/paths"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { runTailor, type TailorResult } from "@/lib/tailor"
import { extractJdMeta } from "@/lib/claude"
import { sendText, sendDocument, downloadMedia, verifySignature, senderAllowed, waConfigured } from "@/lib/whatsapp"
import { createServiceClient, serviceClientAvailable } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

const FALLBACK_USER_ID = process.env.WHATSAPP_USER_ID || "demo"
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
type Session = { jd?: string; resumePath?: string; resumeName?: string; seen?: string[]; updatedAt?: number }
const sessionKey = (from: string) => `whatsapp/session-${digits(from)}.json`

async function loadSession(from: string): Promise<Session> {
  try {
    const raw = await blob.getText(sessionKey(from))
    if (!raw) return {}
    const s = JSON.parse(raw) as Session
    // Forget a stale half-finished conversation rather than pairing a new JD with a
    // resume that was sent days ago.
    const ttl = Number(process.env.WHATSAPP_SESSION_TTL_MS) || 24 * 60 * 60 * 1000
    if (s.updatedAt && Date.now() - s.updatedAt > ttl) return { seen: s.seen?.slice(-40) }
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
}
const genDir = (from: string) => `whatsapp/gens/${digits(from)}`

async function resolveWhatsAppUserId(from: string): Promise<string | null> {
  if (process.env.WHATSAPP_IDENTITY_BINDING_REQUIRED !== "1") return FALLBACK_USER_ID
  if (!serviceClientAvailable()) return null
  const phone = `+${digits(from)}`
  const service = createServiceClient()
  const { data, error } = await service.rpc("identity_resolve_whatsapp_user", { p_phone_e164: phone })
  if (error || !data) return null
  return String(data)
}

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
  `As soon as I have both, I'll tailor it and send back *${OUTPUT_NAME}.docx*.`,
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

  const userId = await resolveWhatsAppUserId(from)
  if (!userId) {
    try { await sendText(from, "This WhatsApp number is not linked to a MarketFit account. Sign in with Google and verify this same mobile number in MarketFit first.") } catch {}
    return ok()
  }

  const session = await loadSession(from)
  // De-dupe: Meta re-delivers a webhook it thinks failed, and a duplicate here would
  // mean a second (slow) generation and a second document sent.
  if (msgId && session.seen?.includes(msgId)) return ok()
  session.seen = [...(session.seen || []), msgId].slice(-40)
  await saveSession(from, session)

  try {
    await handle(from, msg, session, userId)
  } catch (e) {
    try { await sendText(from, `Something went wrong: ${String(e).slice(0, 300)}`) } catch { /* ignore */ }
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

    session.jd = text
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
    // Keep bot uploads in their own folder so they don't clutter the web library, and
    // reuse the same filename so re-sending simply replaces the previous copy.
    const safe = filename.replace(/[^A-Za-z0-9._\- ()]/g, "_").replace(/\.docx$/i, "") + ".docx"
    const dest = path.join(USER_RESUMES_DIR, userId, "WhatsApp", safe)
    await writePath(dest, bytes)

    session.resumePath = dest
    session.resumeName = safe.replace(/\.docx$/i, "")
    await saveSession(from, session)
    if (!session.jd) return sendText(from, `Saved *${session.resumeName}*. Now paste the job description.`)
    return generate(from, session, userId)
  }

  return sendText(from, HELP)
}

// ── Tailor + reply ────────────────────────────────────────────────────────────
async function generate(from: string, session: Session, userId: string) {
  const keys = resolveKeys({})
  if (!hasAnyKey(keys)) return sendText(from, "No AI provider key is configured on the server.")
  if (!session.jd || !session.resumePath) return sendText(from, HELP)

  await sendText(from, "Tailoring your resume… every client role gets its own pass, so this takes up to a minute.")

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  const metaPromise = extractJdMeta({ keys, jd: session.jd })

  const result = await runTailor({
    jd: session.jd,
    keys,
    userResumeDir: path.join(USER_RESUMES_DIR, userId),
    givenPath: session.resumePath,
    mode: "full",
    // Match the dashboard defaults: summary left as written, skills + experience retargeted.
    sections: { summary: false, skills: true, experience: true },
  })

  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) return sendText(from, "The resume generated but the file could not be read back. Please try again.")

  const meta = await metaPromise
  await deliver(from, file, captionFor(meta, result), { userId, jd: session.jd, meta, changes: [], source: session.resumeName })
  await recordWhatsAppUsage(userId, "resume_tailor", result)

  // Every generation starts fresh: keep only the de-dupe list.
  await saveSession(from, { seen: session.seen })
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
  const keys = resolveKeys({})
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
  const changes = [...(gen.changes || []), request]
  await deliver(from, file, captionFor(meta, result, { request, number: changes.length, lines }), {
    userId, jd: gen.jd, meta, changes, source: gen.source,
  })
  await recordWhatsAppUsage(userId, "resume_refine", result)
}

// Send the document and keep a copy of this exact version, recorded under the sent
// message's id, so a later swipe-reply to it can be traced back and edited.
async function deliver(from: string, file: Buffer, caption: string, gen: Omit<Gen, "file" | "createdAt">) {
  const vfile = path.join(VERSIONS_DIR, digits(from), `${Date.now().toString(36)}-${randomBytes(4).toString("hex")}.docx`)
  // Store the copy while the upload runs, so it costs no extra wall time.
  const stored = writePath(vfile, file).then(() => true, () => false)
  let wamid = ""
  try {
    wamid = await sendDocument(from, file, `${OUTPUT_NAME}.docx`, caption)
  } catch (e) {
    if (await stored) await deletePath(vfile)
    throw e
  }
  if (!(await stored)) return
  if (wamid) await saveGen(from, wamid, { ...gen, file: vfile, createdAt: Date.now() })
  else await deletePath(vfile)
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

function captionFor(meta: Meta, result: TailorResult, update?: { request: string; number: number; lines: number }): string {
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
    update ? `*${OUTPUT_NAME}* (update ${update.number})` : `*${OUTPUT_NAME}*`,
    ...(meta.role ? [`Role: ${meta.role}`] : []),
    ...(meta.company ? [`Company: ${meta.company}`] : []),
    ...(meta.location ? [`Location: ${meta.location}`] : []),
    "",
    ...stats,
    "",
    "_Swipe-reply to this file with any changes and I'll update it._",
  ].join("\n")
}
