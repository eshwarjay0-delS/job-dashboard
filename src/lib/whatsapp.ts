/**
 * WhatsApp Cloud API (Meta) client.
 *
 * Env:
 *   WHATSAPP_TOKEN            - access token (temp 24h one from the dashboard, or a
 *                               permanent System User token)
 *   WHATSAPP_PHONE_NUMBER_ID  - the sender's phone-number id (NOT the phone number)
 *   WHATSAPP_VERIFY_TOKEN     - any string; must match what you type into Meta's webhook UI
 *   WHATSAPP_APP_SECRET       - optional but recommended: verifies X-Hub-Signature-256
 *   WHATSAPP_ALLOWED_FROM     - optional comma-separated allowlist of sender numbers
 *
 * NOTE on Meta's free TEST number: it can only message recipients you've added as
 * verified numbers in the dashboard (up to 5). That's fine for personal use.
 */
import { createHmac, timingSafeEqual } from "crypto"

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || "v21.0"}`

export function waConfigured(): boolean {
  return !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

function auth(): Record<string, string> {
  return { Authorization: `Bearer ${(process.env.WHATSAPP_TOKEN || "").trim()}` }
}
function phoneId(): string {
  return (process.env.WHATSAPP_PHONE_NUMBER_ID || "").trim()
}

/** Only these numbers may drive the bot (defence against a leaked webhook URL). */
export function senderAllowed(from: string): boolean {
  const raw = (process.env.WHATSAPP_ALLOWED_FROM || "").trim()
  if (!raw) return true                       // no allowlist configured → allow
  const digits = (s: string) => s.replace(/\D/g, "")
  return raw.split(",").map(s => digits(s)).filter(Boolean).includes(digits(from))
}

/**
 * Verify Meta's X-Hub-Signature-256 over the RAW body. Returns true when no app
 * secret is configured (so the bot still works before you set it), but you should
 * set WHATSAPP_APP_SECRET — the webhook URL is public.
 */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = (process.env.WHATSAPP_APP_SECRET || "").trim()
  if (!secret) return true
  if (!header?.startsWith("sha256=")) return false
  const expected = createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")
  const got = header.slice(7)
  if (got.length !== expected.length) return false
  try { return timingSafeEqual(Buffer.from(got, "hex"), Buffer.from(expected, "hex")) } catch { return false }
}

export async function sendText(to: string, body: string): Promise<void> {
  // WhatsApp hard-caps a text body at 4096 chars.
  const text = body.length > 4000 ? body.slice(0, 3990) + "…" : body
  const res = await fetch(`${GRAPH}/${phoneId()}/messages`, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", to, type: "text", text: { body: text, preview_url: false } }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`WA sendText ${res.status}: ${(await res.text()).slice(0, 200)}`)
}

/** Upload bytes to Meta, then send them as a document message. */
/** Returns the sent message's id (wamid), so a later swipe-reply can be traced to THIS document. */
export async function sendDocument(to: string, data: Buffer, filename: string, caption?: string): Promise<string> {
  const form = new FormData()
  form.append("messaging_product", "whatsapp")
  form.append("type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  form.append("file", new Blob([new Uint8Array(data)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }), filename)

  const up = await fetch(`${GRAPH}/${phoneId()}/media`, {
    method: "POST", headers: auth(), body: form, signal: AbortSignal.timeout(30000),
  })
  if (!up.ok) throw new Error(`WA upload ${up.status}: ${(await up.text()).slice(0, 200)}`)
  const { id } = await up.json() as { id: string }

  const res = await fetch(`${GRAPH}/${phoneId()}/messages`, {
    method: "POST",
    headers: { ...auth(), "content-type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp", to, type: "document",
      document: { id, filename, ...(caption ? { caption: caption.slice(0, 1000) } : {}) },
    }),
    signal: AbortSignal.timeout(20000),
  })
  if (!res.ok) throw new Error(`WA sendDoc ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const sent = await res.json().catch(() => ({})) as { messages?: { id?: string }[] }
  return sent.messages?.[0]?.id || ""
}

/** Download an inbound attachment: media id → signed URL → bytes. */
export async function downloadMedia(mediaId: string): Promise<Buffer> {
  const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth(), signal: AbortSignal.timeout(20000) })
  if (!meta.ok) throw new Error(`WA media meta ${meta.status}`)
  const { url } = await meta.json() as { url: string }
  // The CDN URL still requires the bearer token.
  const bin = await fetch(url, { headers: auth(), signal: AbortSignal.timeout(30000) })
  if (!bin.ok) throw new Error(`WA media fetch ${bin.status}`)
  return Buffer.from(await bin.arrayBuffer())
}
