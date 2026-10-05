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

/**
 * The number people message, as digits with the country code ("15552017131").
 *
 * WHATSAPP_DISPLAY_NUMBER wins when it is set. Otherwise the number is read from Meta for the configured sender and kept for an
 * hour. Before 2026-10-05 the page showed a number only when that one setting existed; it had never been set, so every person who
 * finished setup was told "WhatsApp is not switched on yet" while the bot was in fact wired. A sender that is wired always has a
 * number, so it is looked up rather than asked for twice.
 */
type SenderInfo = { digits: string; mode: string; reached: boolean; status: number }
// A good answer is kept for an hour; a refusal or a silence for one minute, so a repaired token shows up quickly.
let numberCache: (SenderInfo & { at: number }) | null = null
async function senderInfo(): Promise<SenderInfo> {
  if (numberCache && Date.now() - numberCache.at < (numberCache.reached ? 3600_000 : 60_000)) return numberCache
  const keep = (info: SenderInfo) => { numberCache = { ...info, at: Date.now() }; return info }
  try {
    const res = await fetch(`${GRAPH}/${phoneId()}?fields=display_phone_number,account_mode`, { headers: auth(), signal: AbortSignal.timeout(8000) })
    if (!res.ok) return keep({ digits: "", mode: "", reached: false, status: res.status })
    const body = await res.json().catch(() => ({})) as { display_phone_number?: string; account_mode?: string }
    const digits = String(body.display_phone_number || "").replace(/\D/g, "")
    return keep({ digits: digits.length >= 8 ? digits : "", mode: String(body.account_mode || ""), reached: true, status: 200 })
  } catch { return keep({ digits: "", mode: "", reached: false, status: 0 }) }
}

export async function waDisplayNumber(): Promise<string> {
  const fromEnv = (process.env.WHATSAPP_DISPLAY_NUMBER || "").replace(/\D/g, "")
  if (fromEnv.length >= 8) return fromEnv
  if (!waConfigured()) return ""
  return (await senderInfo()).digits
}

export type WhatsAppStatus = {
  state: "ok" | "not_configured" | "token_rejected" | "test_number" | "unreachable"
  /** What to do about it, for whoever runs the deployment. No value of any setting is included. */
  fix: string
  hasNumber: boolean
}

/** Is the bot's sender usable by people who are not on Meta's test list? One read-only request, kept for an hour. */
export async function waStatus(): Promise<WhatsAppStatus> {
  if (!waConfigured()) return { state: "not_configured", hasNumber: false, fix: "Set WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID on the deployment, then redeploy." }
  const info = await senderInfo()
  const fromEnv = (process.env.WHATSAPP_DISPLAY_NUMBER || "").replace(/\D/g, "").length >= 8
  if (!info.reached) {
    return info.status === 401 || info.status === 403 || info.status === 400
      ? { state: "token_rejected", hasNumber: fromEnv, fix: "Meta refused WHATSAPP_TOKEN for this sender. The token has expired or lost access to the phone number: create a new permanent System User token in Meta Business settings, save it on the deployment, then redeploy." }
      : { state: "unreachable", hasNumber: fromEnv, fix: "Meta did not answer. Try again in a minute." }
  }
  if (/sandbox/i.test(info.mode)) {
    return { state: "test_number", hasNumber: !!info.digits || fromEnv, fix: "The bot is on Meta's test number. It can only reply to the (at most five) numbers added as recipients in the Meta developer console. For everyone else to get replies, add a real phone number to the WhatsApp Business account and put its phone number id in WHATSAPP_PHONE_NUMBER_ID." }
  }
  return { state: "ok", hasNumber: !!info.digits || fromEnv, fix: "" }
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
