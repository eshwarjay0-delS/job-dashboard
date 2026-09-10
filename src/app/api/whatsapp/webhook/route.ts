/**
 * WhatsApp chatbot webhook.
 *
 * Conversation: send a JD and a .docx resume in EITHER order. As soon as the bot has
 * both, it tailors and sends the result back as "Eshwar Resume.docx", captioned with
 * the Role / Location / Company it was built for. The session then clears, so every
 * generation starts fresh with a new JD + resume.
 *
 * Serverless note: Vercel freezes a function once it responds, so the work CANNOT be
 * deferred — it runs inline and we answer 200 at the end. Meta retries a webhook it
 * considers failed, so every message id is de-duplicated before doing any work.
 */
import { NextRequest, NextResponse } from "next/server"
import path from "path"
import { blob, writePath } from "@/lib/storage"
import { USER_RESUMES_DIR } from "@/lib/paths"
import { resolveKeys, hasAnyKey } from "@/lib/llm"
import { runTailor } from "@/lib/tailor"
import { extractJdMeta } from "@/lib/claude"
import { sendText, sendDocument, downloadMedia, verifySignature, senderAllowed, waConfigured } from "@/lib/whatsapp"

export const runtime = "nodejs"
export const maxDuration = 60
export const dynamic = "force-dynamic"

const USER_ID = process.env.WHATSAPP_USER_ID || "demo"
const OUTPUT_NAME = process.env.WHATSAPP_OUTPUT_NAME || "Eshwar Resume"
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

type Session = { jd?: string; resumePath?: string; resumeName?: string; seen?: string[]; updatedAt?: number }
const sessionKey = (from: string) => `whatsapp/session-${from.replace(/\D/g, "")}.json`

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

const HELP = [
  "*Resume Tailor Bot*",
  "",
  "Send me two things, in any order:",
  "1. The *job description* (paste it as a message)",
  "2. Your *resume* as a .docx file",
  "",
  `As soon as I have both, I'll tailor it and send back *${OUTPUT_NAME}.docx*.`,
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

  const session = await loadSession(from)
  // De-dupe: Meta re-delivers a webhook it thinks failed, and a duplicate here would
  // mean a second (slow) generation and a second document sent.
  if (msgId && session.seen?.includes(msgId)) return ok()
  session.seen = [...(session.seen || []), msgId].slice(-40)
  await saveSession(from, session)

  try {
    await handle(from, msg, session)
  } catch (e) {
    try { await sendText(from, `Something went wrong: ${String(e).slice(0, 300)}`) } catch { /* ignore */ }
  }
  return ok()
}

async function handle(from: string, msg: Record<string, unknown>, session: Session) {
  const type = String(msg.type || "")

  // ── Commands / JD text ──────────────────────────────────────────────────────
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
    // Too short to be a JD — most likely a stray message, so guide instead of guessing.
    if (text.length < 60) {
      return sendText(from, `That looks too short to be a job description (${text.length} characters).\n\n${HELP}`)
    }

    session.jd = text
    await saveSession(from, session)
    if (!session.resumePath) return sendText(from, "Got the job description. Now send your resume as a *.docx* file.")
    return generate(from, session)
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
    const dest = path.join(USER_RESUMES_DIR, USER_ID, "WhatsApp", safe)
    await writePath(dest, bytes)

    session.resumePath = dest
    session.resumeName = safe.replace(/\.docx$/i, "")
    await saveSession(from, session)
    if (!session.jd) return sendText(from, `Saved *${session.resumeName}*. Now paste the job description.`)
    return generate(from, session)
  }

  return sendText(from, HELP)
}

// ── Tailor + reply ────────────────────────────────────────────────────────────
async function generate(from: string, session: Session) {
  const keys = resolveKeys({})
  if (!hasAnyKey(keys)) return sendText(from, "No AI provider key is configured on the server.")
  if (!session.jd || !session.resumePath) return sendText(from, HELP)

  await sendText(from, "Tailoring your resume… (about 10 seconds)")

  // Role/company/location runs alongside the tailor, so it costs no extra wall time.
  const metaPromise = extractJdMeta({ keys, jd: session.jd })

  const result = await runTailor({
    jd: session.jd,
    keys,
    userResumeDir: path.join(USER_RESUMES_DIR, USER_ID),
    givenPath: session.resumePath,
    mode: "full",
    // Match the dashboard defaults: summary left as written, skills + experience retargeted.
    sections: { summary: false, skills: true, experience: true },
  })

  const file = await blob.get(`tailored/${result.token}.docx`)
  if (!file) return sendText(from, "The resume generated but the file could not be read back. Please try again.")

  const meta = await metaPromise
  const ka = result.keyword_analysis
  const caption = [
    `*${OUTPUT_NAME}*`,
    meta.role ? `Role: ${meta.role}` : null,
    meta.company ? `Company: ${meta.company}` : null,
    meta.location ? `Location: ${meta.location}` : null,
    "",
    `Match: ${result.score_before}% -> *${result.score}%*`,
    `Keywords: ${ka.coverage_after}% covered${ka.added.length ? ` (+${ka.added.length} added)` : ""}`,
    `${result.diff.length} lines rewritten`,
  ].filter(Boolean).join("\n")

  await sendDocument(from, file, `${OUTPUT_NAME}.docx`, caption)

  // Every generation starts fresh: keep only the de-dupe list.
  await saveSession(from, { seen: session.seen })
}
