/**
 * WhatsApp transport for the same account-owned Kompas engine as the desktop API.
 * Never calls Meta directly: webhook authentication, deduplication and sending stay in the caller.
 */
import { createHash } from "node:crypto"
import { blob } from "@/lib/storage"
import { extractText } from "@/lib/docx"
import { pdfText } from "@/lib/pdf-text"
import { downloadMedia } from "@/lib/whatsapp"
import { sharedKompasStore } from "@/lib/kompas-session-store"
import { sharedKompasTurn } from "@/lib/kompas-shared-turn"
import { splitDistinctAsks } from "@/lib/kompasAnswer"
import { classifyKompasPastedSource, kompasTransition, type KompasInput } from "@/lib/whatsapp-kompas"

type Message = Record<string, unknown>
type Channel = { revision: number; sessionId?: string }
type Arguments = {
  from: string
  owner: string
  verified: boolean
  requestId: string
  msg: Message
  send: (text: string) => Promise<void>
}
const hash = (value: string) => createHash("sha256").update(value).digest("hex")
const ids = (from: string) => from.replace(/\D/g, "")
const sharedLink = (id: string) => {
  let origin = "https://job-dashboard-fawn.vercel.app"
  try {
    const configured = new URL(process.env.NEXT_PUBLIC_APP_URL || origin)
    if (configured.protocol === "https:" && !configured.username && !configured.password) origin = configured.origin
  } catch { /* use the canonical deployment */ }
  return `\nOpen this conversation on the web (sign in to the same account): ${origin}/dashboard/kompas/shared/${encodeURIComponent(id)}`
}
const pathFor = (owner: string, from: string) => {
  if (!owner || ids(from).length < 8) throw new Error("Verified sender required")
  return `kompas/channels/${hash(owner)}/${hash(ids(from))}/`
}
const keyFor = (prefix: string, revision: number) =>
  prefix + String(revision).padStart(10, "0") + ".json"

/** The latest immutable channel revision. A tombstone (no sessionId) means revert.
 * IMPORTANT: Do NOT list R2 objects on the path of ordinary WhatsApp tailoring.
 * That additional ListObjects permission/round trip made the optional Kompas
 * adapter a single point of failure for every incoming job description.
 * Revisions are contiguous; exponentially probe exact objects and binary-search
 * the first missing revision using the same GetObject permission as resume reads.
 */
async function readChannel(owner: string, from: string): Promise<Channel> {
  const prefix = pathFor(owner, from)
  const get = (revision: number) => blob.getText(keyFor(prefix, revision))
  const first = await get(0)
  if (!first) return { revision: -1 }
  const MAX = 9999999998
  let low = 0, high = 1
  while (high <= MAX && await get(high) !== null) {
    low = high
    if (high >= Math.floor(MAX / 2)) { high = MAX + 1; break }
    high *= 2
  }
  if (high > MAX) high = MAX + 1
  while (high - low > 1) {
    const mid = low + Math.floor((high - low) / 2)
    if (await get(mid) !== null) low = mid
    else high = mid
  }
  const raw = low === 0 ? first : await get(low)
  if (!raw) throw new Error("WhatsApp session state unavailable")
  const data = JSON.parse(raw) as Channel
  if (!Number.isSafeInteger(data.revision) || data.revision !== low ||
      (data.sessionId !== undefined && !/^[a-f\d-]{36}$/.test(data.sessionId)))
    throw new Error("WhatsApp session state invalid")
  return data
}

/** Compare-and-create prevents a slow message from replacing a newer command. */
async function changeChannel(owner: string, from: string, expected: Channel, sessionId?: string): Promise<boolean> {
  const latest = await readChannel(owner, from)
  if (latest.revision !== expected.revision) return false
  const next = expected.revision + 1
  if (!Number.isSafeInteger(next) || next >= 9999999999) throw new Error("Session history exhausted")
  return blob.putIfAbsent(keyFor(pathFor(owner, from), next), JSON.stringify({ revision: next, sessionId }))
}

async function readDocument(msg: Message, role: "resume" | "jd" | "support"): Promise<KompasInput | null> {
  const doc = msg.document as { id?: string; filename?: string; mime_type?: string; caption?: string } | undefined
  if (!doc?.id) return null
  const name = (doc.filename || "attachment").replace(/[\\/]/g, "_").slice(0, 100)
  const lower = name.toLowerCase()
  if (!/\.(?:docx|pdf|txt)$/.test(lower)) return null
  const bytes = await downloadMedia(doc.id, 5 * 1024 * 1024)
  let text: string
  if (lower.endsWith(".docx")) text = await extractText(bytes).catch(() => "")
  else if (lower.endsWith(".pdf")) text = await pdfText(bytes, { requireComplete: true })
  else text = bytes.includes(0) ? "" : bytes.toString("utf8")
  text = text.replace(/\u0000/g, "").trim()
  if (!text) return null
  return { kind: "document", role, name, text }
}

/** Returns false only for normal resume-tailoring traffic. */
export async function handleWhatsAppKompas({ from, owner, verified, requestId, msg, send }: Arguments): Promise<boolean> {
  const type = String(msg.type || "")
  if (type !== "text" && type !== "document") return false
  const text = type === "text" ? String((msg.text as { body?: string } | undefined)?.body || "").trim() : ""
  const command = text.toLowerCase()
  // Incomplete/unverified identities may keep ordinary tailoring, but never enter shared Kompas.
  if (!verified) {
    if (command === "kompas") {
      await send("Link and verify this WhatsApp number with your MarketFit account before starting Kompas.")
      return true
    }
    if (command === "revert") {
      await send("Back to normal MFit resume tailoring.")
      return true
    }
    return false
  }
  const sessions = sharedKompasStore()
  const remember = async (id: string) => {
    try { await sessions.remember(owner, id) } catch { /* Discovery can retry on the next kompas command; chat remains usable. */ }
  }
  let channel: Channel
  try {
    channel = await readChannel(owner, from)
  } catch (error) {
    // This is session storage, not an AI-provider configuration failure.
    // Never route a potentially active Kompas question to the resume tailor
    // when the mode cannot be verified; that could mix the two workflows.
    console.error("[whatsapp-kompas] session state read failed", String(error).slice(0, 160))
    await send("I couldn't check your Kompas WhatsApp session right now. Nothing was changed. Please resend your message.")
    return true
  }
  if (command === "revert") {
    for (let i = 0; i < 4; i++) {
      if (await changeChannel(owner, from, channel)) {
        // Bump the shared revision to cancel a generation. Leave desktop history intact.
        if (channel.sessionId) {
          for (let attempt = 0; attempt < 4; attempt++) {
            const previous = await sessions.read(owner, channel.sessionId)
            if (!previous || !previous.pending) break
            if (await sessions.commit(owner, previous.revision, {
              ...previous, revision: previous.revision + 1, pending: undefined,
            })) break
          }
        }
        await send("Kompas closed for WhatsApp. Back to MFit resume tailoring. Your desktop history is kept.")
        return true
      }
      channel = await readChannel(owner, from)
    }
    await send("The session changed while reverting. Please send revert again.")
    return true
  }
  if (command === "kompas") {
    if (channel.sessionId) {
      await remember(channel.sessionId)
      await send("Kompas is already active. Send your resume and job description, then your questions. Send revert to return to tailoring." + sharedLink(channel.sessionId))
      return true
    }
    for (let i = 0; i < 4; i++) {
      const created = await sessions.create(owner)
      if (await changeChannel(owner, from, channel, created.id)) {
        await remember(created.id)
        await send("Kompas started. Send your resume and job description in either order. You may paste the JD and attach Resume.docx or other supporting PDF, DOCX or TXT files. Send start when ready." + sharedLink(created.id))
        return true
      }
      channel = await readChannel(owner, from)
      if (channel.sessionId) {
        await remember(channel.sessionId)
        await send("Kompas is already active. Send your resume, job description or a question." + sharedLink(channel.sessionId))
        return true
      }
    }
    await send("Could not start a session just now. Please send kompas again.")
    return true
  }
  if (!channel.sessionId) return false

  for (let tries = 0; tries < 4; tries++) {
    let original: Awaited<ReturnType<typeof sessions.read>>
    try {
      original = await sessions.read(owner, channel.sessionId)
    } catch (error) {
      // Session-storage failures must never look like a missing AI provider,
      // and must not silently fall through to normal resume tailoring.
      const code = (error as { name?: string })?.name || "Error"
      console.error("[whatsapp-kompas] session-read", code)
      await send("I couldn't read your Kompas session. Your resume and job description were not changed. Please resend the last message.")
      return true
    }
    if (!original) {
      await send("This Kompas session is unavailable. Send revert, then kompas, to restart.")
      return true
    }
    // Recovery for sessions written by the old resume-first reducer: a pasted
    // structured JD must not permanently occupy the resume slot.
    const prior = original.sources
    const legacy = !prior.jd && prior.resume &&
      classifyKompasPastedSource({ ...prior, resume: undefined }, prior.resume) === "jd"
    const sources = legacy
      ? { ...prior, resume: undefined, jd: prior.resume }
      : prior

    let input: KompasInput
    if (type === "text") {
      const role = classifyKompasPastedSource(sources, text)
      // A user can send a casual voice question or product feedback before
      // submitting their interview sources. Never silently store that audio
      // transcript as a "resume" or "JD" merely because it arrived first.
      if (msg.mfitVoiceNote === true && !role && (!sources.resume || !sources.jd) && command !== "start") {
        await send("Voice note understood, but Kompas still needs your resume and job description before answering interview questions. Send them as files or text; you can dictate a JD starting with 'Job description:'.")
        return true
      }
      input = role ? { kind: "document", role, name: role === "jd" ? "Pasted job description" : "Pasted resume", text }
        : { kind: "text", text }
    } else {
      const doc = msg.document as { caption?: string; filename?: string } | undefined
      const caption = String(doc?.caption || "").trim().toLowerCase()
      const filename = String(doc?.filename || "").toLowerCase()
      const explicit = /^(?:resume|cv)\s*[:\-]/.test(caption) ? "resume" :
        /^(?:jd|job description)\s*[:\-]/.test(caption) ? "jd" :
        /^(?:support|notes|attachment)\s*[:\-]/.test(caption) ? "support" : null
      const named = /(?:^|[._\s-])(?:resume|curriculum|cv)(?:[._\s-]|$)/i.test(filename) ? "resume" :
        /(?:^|[._\s-])(?:jd|job[_ -]?description|job[_ -]?posting)(?:[._\s-]|$)/i.test(filename) ? "jd" : null
      const role = explicit || named || (!sources.resume ? "resume" : !sources.jd ? "jd" : "support")
      let attachment: KompasInput | null
      try {
        attachment = await readDocument(msg, role)
      } catch (error) {
        console.error("[whatsapp-kompas] attachment retrieval failed", (error as Error)?.name || "error")
        await send("I couldn't download that document from WhatsApp. Please resend the DOCX, PDF or TXT attachment.")
        return true
      }
      if (!attachment) {
        await send("Please send a readable DOCX, PDF or TXT document smaller than 5 MB. PDFs must have at most 12 pages; split longer documents into smaller files.")
        return true
      }
      input = attachment
    }

    const transitioned = kompasTransition(sources, input)
    if (transitioned.action === "reject") {
      await send(transitioned.prompt || "That input cannot be used in this session.")
      return true
    }
    if (transitioned.action === "setup") {
      // Pure start/status instructions do not change source revisions or the answer history.
      if (transitioned.state && JSON.stringify(transitioned.state) !== JSON.stringify(original.sources)) {
        const next = { ...original, revision: original.revision + 1,
          sources: transitioned.state, history: [], ledger: undefined, pending: undefined }
        if (!await sessions.commit(owner, original.revision, next)) continue
      }
      const latest = await readChannel(owner, from)
      if (latest.sessionId !== channel.sessionId) return true
      await send(transitioned.prompt || "Sources received. Send your question.")
      return true
    }
    if (transitioned.action === "answer" && transitioned.question) {
      // The microphone already answers each question in one breath. A WhatsApp
      // message used to send both to one turn, so the second ask was lost.
      const asks = splitDistinctAsks(transitioned.question)
      const questions = asks.length ? asks : [transitioned.question]
      let revision = original.revision
      for (let i = 0; i < questions.length; i++) {
        const turnId = i === 0 ? requestId : `${requestId}:${i}`.slice(0, 256)
        const result = await sharedKompasTurn(owner, original.id, revision, turnId, questions[i])
        if (result.status === "answered" && result.text && result.session) {
          const [now, stored] = await Promise.all([
            readChannel(owner, from), sessions.read(owner, original.id),
          ])
          // Revert, relink, updated sources, duplicate claims or later responses must never leak stale text.
          if (now.sessionId !== channel.sessionId || stored?.revision !== result.session.revision) return true
          await send(result.text)
          revision = result.session.revision
          continue
        }
        if (result.status === "skipped" && result.session) { await send("Personal logistics, not answered."); revision = result.session.revision; continue }
        if (result.status === "unavailable") {
          await send("Kompas could not answer right now. Your question was not added to the conversation. Please retry.")
          return true
        }
        if (result.status === "repeated") {
          await send("This question is different from the last one, and the answer came back the same. I did not send that copy. Please send the question once more.")
          const stored = await sessions.read(owner, original.id)
          if (stored && stored.revision !== revision) revision = stored.revision
          continue
        }
        const now = await readChannel(owner, from)
        if (now.sessionId === channel.sessionId) await send("This session changed or has an answer in progress. Please resend the question.")
        return true
      }
      return true
    }
    await send("Send your resume, job description or a question.")
    return true
  }
  await send("The session changed while reading your documents. Please resend the last message.")
  return true
}
