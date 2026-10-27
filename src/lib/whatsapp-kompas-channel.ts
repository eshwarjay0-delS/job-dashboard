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
import { kompasTransition, type KompasInput } from "@/lib/whatsapp-kompas"

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
const pathFor = (owner: string, from: string) => {
  if (!owner || ids(from).length < 8) throw new Error("Verified sender required")
  return `kompas/channels/${hash(owner)}/${hash(ids(from))}/`
}
const keyFor = (prefix: string, revision: number) =>
  prefix + String(revision).padStart(10, "0") + ".json"

/** The latest immutable channel revision. A tombstone (no sessionId) means revert. */
async function readChannel(owner: string, from: string): Promise<Channel> {
  const prefix = pathFor(owner, from)
  const revisions = (await blob.list(prefix))
    .filter(key => /^\d{10}\.json$/.test(key.slice(prefix.length))).sort()
  if (!revisions.length) return { revision: -1 }
  const raw = await blob.getText(revisions[revisions.length - 1])
  if (!raw) throw new Error("WhatsApp session state unavailable")
  const data = JSON.parse(raw) as Channel
  const latest = Number(revisions[revisions.length - 1].slice(prefix.length, -5))
  if (!Number.isSafeInteger(latest) || data.revision !== latest ||
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
  else if (lower.endsWith(".pdf")) text = await pdfText(bytes)
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
  let channel = await readChannel(owner, from)
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
      await send("Kompas is already active. Send your resume and job description, then your questions. Send revert to return to tailoring.")
      return true
    }
    for (let i = 0; i < 4; i++) {
      const created = await sessions.create(owner)
      if (await changeChannel(owner, from, channel, created.id)) {
        await send("Kompas started. Send your resume, then the job description. You may attach supporting PDF, DOCX or TXT files. Send start when ready.")
        return true
      }
      channel = await readChannel(owner, from)
      if (channel.sessionId) {
        await send("Kompas is already active. Send your resume, job description or a question.")
        return true
      }
    }
    await send("Could not start a session just now. Please send kompas again.")
    return true
  }
  if (!channel.sessionId) return false

  for (let tries = 0; tries < 4; tries++) {
    const original = await sessions.read(owner, channel.sessionId)
    if (!original) {
      await send("This Kompas session is unavailable. Send revert, then kompas, to restart.")
      return true
    }
    let input: KompasInput
    if (type === "text") input = { kind: "text", text }
    else {
      const caption = String((msg.document as { caption?: string } | undefined)?.caption || "").trim().toLowerCase()
      const explicit = /^(?:resume|cv)\s*[:\-]/.test(caption) ? "resume" :
        /^(?:jd|job description)\s*[:\-]/.test(caption) ? "jd" :
        /^(?:support|notes|attachment)\s*[:\-]/.test(caption) ? "support" : null
      const role = explicit || (!original.sources.resume ? "resume" : !original.sources.jd ? "jd" : "support")
      const attachment = await readDocument(msg, role)
      if (!attachment) {
        await send("Please send a readable DOCX, PDF or TXT document smaller than 5 MB.")
        return true
      }
      input = attachment
    }

    const transitioned = kompasTransition(original.sources, input)
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
      const result = await sharedKompasTurn(owner, original.id, original.revision, requestId, transitioned.question)
      if (result.status === "answered" && result.text && result.session) {
        const [now, stored] = await Promise.all([
          readChannel(owner, from), sessions.read(owner, original.id),
        ])
        // Revert, relink, updated sources, duplicate claims or later responses must never leak stale text.
        if (now.sessionId === channel.sessionId && stored?.revision === result.session.revision)
          await send(result.text)
      } else if (result.status === "unavailable") {
        await send("Kompas could not answer right now. Your question was not added to the conversation. Please retry.")
      } else {
        const now = await readChannel(owner, from)
        if (now.sessionId === channel.sessionId) await send("This session changed or has an answer in progress. Please resend the question.")
      }
      return true
    }
    await send("Send your resume, job description or a question.")
    return true
  }
  await send("The session changed while reading your documents. Please resend the last message.")
  return true
}
