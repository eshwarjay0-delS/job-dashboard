/**
 * Gmail REST helpers for the auto-reply loop.
 *
 * Mirrors the dependency-free pattern already proven in
 * src/app/api/gmail-sync/route.ts (raw fetch against the v1 REST API, token
 * refreshed via oauth2.googleapis.com) rather than pulling in `googleapis`.
 *
 * Everything in this file is READ-ONLY and works on the `gmail.readonly` scope
 * the app already requests (src/lib/google-auth.ts:42). Nothing here writes to
 * or sends from Gmail.
 */

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me"

export class GmailAuthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
    this.name = "GmailAuthError"
  }
}

export class GmailApiError extends Error {
  status: number
  reason: string
  constructor(status: number, reason: string, message: string) {
    super(message)
    this.status = status
    this.reason = reason
    this.name = "GmailApiError"
  }
}

/**
 * Exchange a stored refresh token for an access token.
 *
 * gmail-sync's copy swallows the error body and returns null, which makes
 * `invalid_grant` (the user revoked access — permanent, needs re-consent)
 * indistinguishable from a transient 5xx. An unattended loop must tell those
 * apart: one should halt and raise a banner, the other should just retry.
 */
export async function refreshAccessToken(refreshToken: string): Promise<string> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new GmailAuthError("no_oauth_client", "GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set on this deployment.")
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  })

  const data = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string }

  if (!res.ok || !data.access_token) {
    const err = data.error || `http_${res.status}`
    if (err === "invalid_grant") {
      throw new GmailAuthError("invalid_grant", "Gmail access was revoked or the refresh token expired — reconnect Gmail. (Unverified OAuth apps in 'Testing' expire refresh tokens after ~7 days; publishing the consent screen fixes that.)")
    }
    if (err === "invalid_client") {
      throw new GmailAuthError("invalid_client", "GOOGLE_CLIENT_ID/SECRET do not match the OAuth client that minted this refresh token. Check they are the same client configured in Supabase Auth → Providers → Google.")
    }
    throw new GmailAuthError(err, data.error_description || `Token refresh failed (${err}).`)
  }
  return data.access_token
}

async function gmailGet<T = unknown>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as {
      error?: { message?: string; errors?: Array<{ reason?: string }>; status?: string }
    }
    const reason = body.error?.errors?.[0]?.reason || body.error?.status || `http_${res.status}`
    throw new GmailApiError(res.status, reason, body.error?.message || `Gmail ${res.status} on ${path}`)
  }
  return res.json() as Promise<T>
}

// ── Types (only the fields we actually read) ────────────────────────────────
export interface GmailHeader { name: string; value: string }
export interface GmailPart {
  mimeType?: string
  filename?: string
  headers?: GmailHeader[]
  body?: { size?: number; data?: string; attachmentId?: string }
  parts?: GmailPart[]
}
export interface GmailMessage {
  id: string
  threadId: string
  labelIds?: string[]
  internalDate?: string
  snippet?: string
  payload?: GmailPart
}
export interface GmailDraft { id: string; message: GmailMessage }

export function headerValue(msg: GmailMessage | undefined, name: string): string {
  const hs = msg?.payload?.headers || []
  const h = hs.find((x) => x.name.toLowerCase() === name.toLowerCase())
  return h?.value || ""
}

/** Pull every bare address out of an RFC 5322 header value. */
export function parseAddresses(headerVal: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const re = /[\w.!#$%&'*+/=?^`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+/g
  let m: RegExpExecArray | null
  while ((m = re.exec(headerVal || "")) !== null) {
    const a = m[0].toLowerCase()
    if (!seen.has(a)) { seen.add(a); out.push(a) }
  }
  return out
}

function b64urlDecode(data: string): string {
  const b64 = data.replace(/-/g, "+").replace(/_/g, "/")
  try {
    return Buffer.from(b64, "base64").toString("utf8")
  } catch {
    return ""
  }
}

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
}

/** Best-effort plain text of a message: prefers text/plain, falls back to HTML. */
export function messageText(msg: GmailMessage): string {
  const plains: string[] = []
  const htmls: string[] = []
  const walk = (p?: GmailPart) => {
    if (!p) return
    // Skip real attachments — a .docx body is not message text.
    if (p.filename && p.filename.length) return
    if (p.body?.data) {
      if (p.mimeType === "text/plain") plains.push(b64urlDecode(p.body.data))
      else if (p.mimeType === "text/html") htmls.push(b64urlDecode(p.body.data))
    }
    ;(p.parts || []).forEach(walk)
  }
  walk(msg.payload)
  const raw = plains.length ? plains.join("\n") : stripHtml(htmls.join("\n"))
  return raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
}

/**
 * Drop the quoted trailer so a reply doesn't drag the whole history along.
 * Conservative: only cuts at unambiguous quote markers.
 */
export function stripQuoted(text: string): string {
  const markers = [
    /\n\s*On .{5,120}\s+wrote:\s*\n/,
    /\n-{2,}\s*Forwarded message\s*-{2,}/i,
    /\n_{10,}\n/,
    /\n\s*From:\s.+\n\s*Sent:\s/i,
  ]
  let cut = text.length
  for (const m of markers) {
    const hit = text.match(m)
    if (hit && hit.index !== undefined && hit.index < cut) cut = hit.index
  }
  return text.slice(0, cut).trim()
}

// ── API calls ───────────────────────────────────────────────────────────────

/**
 * List drafts, narrowed server-side by a Gmail search query.
 *
 * NOTE on the query: `to:tekblu` matching x@tekblu.us relies on Gmail's address
 * tokenisation, which Google does not document. The query is therefore only an
 * OPTIMISATION to keep the result set small — every returned draft is still
 * re-checked client-side against the allowlist with proper domain-label
 * matching. A too-narrow query costs completeness, never correctness.
 */
export async function listDraftsForAllowlist(
  accessToken: string,
  allowlist: string[],
  lookbackDays: number,
  minAgeDays = 0,
  max = 60,
): Promise<GmailDraft[]> {
  const terms = allowlist.map((t) => `to:${t}`).join(" OR ")
  // An age BAND: newer_than is the far edge, older_than the near edge. A draft
  // written in the last `minAgeDays` is left alone because the recruiter may
  // still be mid-conversation on it.
  const q = [
    terms ? `(${terms})` : "",
    `newer_than:${Math.max(1, lookbackDays)}d`,
    minAgeDays > 0 ? `older_than:${minAgeDays}d` : "",
  ]
    .filter(Boolean)
    .join(" ")
  const res = await gmailGet<{ drafts?: Array<{ id: string; message?: { id: string; threadId: string } }> }>(
    `/drafts?maxResults=${max}&q=${encodeURIComponent(q)}`,
    accessToken,
  )
  const stubs = res.drafts || []
  const out: GmailDraft[] = []
  for (const s of stubs) {
    // Metadata only — enough for the To/Cc/Subject check, far cheaper than full.
    const d = await gmailGet<GmailDraft>(
      `/drafts/${encodeURIComponent(s.id)}?format=metadata`,
      accessToken,
    ).catch(() => null)
    if (d) out.push(d)
  }
  return out
}

export async function getThreadFull(accessToken: string, threadId: string): Promise<{ messages: GmailMessage[] }> {
  return gmailGet<{ messages: GmailMessage[] }>(`/threads/${encodeURIComponent(threadId)}?format=full`, accessToken)
}

export async function getProfileEmail(accessToken: string): Promise<string> {
  const p = await gmailGet<{ emailAddress?: string }>("/profile", accessToken)
  return (p.emailAddress || "").toLowerCase()
}
