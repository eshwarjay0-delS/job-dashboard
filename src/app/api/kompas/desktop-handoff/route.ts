import { createHash, randomBytes } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }
const MAX_BYTES = 60_000
const FIELD_LIMITS: Record<string, number> = {
  id: 128, type: 32, role: 512, company: 512, jd: 6000, resume: 8000,
  documents: 2000, instructions: 4000, language: 24, interviewer: 64,
  difficulty: 64, tone: 64, mode: 64, length: 64,
  token: 16384, refreshToken: 16384,
}
const BOOL_FIELDS = ["autoAnswer", "autoMode", "saveTranscript"] as const
const NUM_FIELDS = ["createdAt", "tokenExp"] as const

// Browser-local session details are transferred over HTTPS, NOT embedded in
// Chromium's Windows external-protocol link (which fails above ~2 KB).
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ ok: false, error: "Sign in to MarketFit first." }, { status: 401, headers: NO_STORE })
  const limit = checkRateLimit("kompas-desktop-issue:" + user.id, { max: 15, windowMs: 60_000 })
  if (!limit.ok) return NextResponse.json({ ok: false, error: "Too many connection attempts." }, { status: 429, headers: NO_STORE })

  if (Number(request.headers.get("content-length")) > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Interview session exceeds the transfer limit." }, { status: 413, headers: NO_STORE })
  }
  const raw = await request.text().catch(() => "")
  if (Buffer.byteLength(raw, "utf8") > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: "Interview session exceeds the transfer limit." }, { status: 413, headers: NO_STORE })
  }
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch {
    return NextResponse.json({ ok: false, error: "Invalid interview details." }, { status: 400, headers: NO_STORE })
  }
  const input = parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>).session : null
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return NextResponse.json({ ok: false, error: "Missing interview session." }, { status: 400, headers: NO_STORE })
  }
  const session = input as Record<string, unknown>
  if (session.site !== "marketfit" || typeof session.id !== "string" || !session.id.trim() || session.id.length > FIELD_LIMITS.id) {
    return NextResponse.json({ ok: false, error: "Invalid MarketFit interview." }, { status: 400, headers: NO_STORE })
  }
  const allowed = new Set([...Object.keys(FIELD_LIMITS), ...BOOL_FIELDS, ...NUM_FIELDS, "site"])
  if (Object.keys(session).some(k => !allowed.has(k))) {
    return NextResponse.json({ ok: false, error: "Unrecognized interview fields." }, { status: 400, headers: NO_STORE })
  }
  const safe: Record<string, unknown> = { site: "marketfit" }
  for (const [field, max] of Object.entries(FIELD_LIMITS)) {
    if (session[field] === undefined) continue
    if (typeof session[field] !== "string" || (session[field] as string).length > max) {
      return NextResponse.json({ ok: false, error: "Invalid interview field: " + field }, { status: 400, headers: NO_STORE })
    }
    safe[field] = session[field]
  }
  for (const field of BOOL_FIELDS) {
    if (session[field] !== undefined && typeof session[field] !== "boolean") {
      return NextResponse.json({ ok: false, error: "Invalid interview setting." }, { status: 400, headers: NO_STORE })
    }
    if (session[field] !== undefined) safe[field] = session[field]
  }
  for (const field of NUM_FIELDS) {
    if (session[field] !== undefined && (typeof session[field] !== "number" || !Number.isFinite(session[field]))) {
      return NextResponse.json({ ok: false, error: "Invalid interview timestamp." }, { status: 400, headers: NO_STORE })
    }
    if (session[field] !== undefined) safe[field] = session[field]
  }
  // Capability link: 256 random bits, SHA-256 digest at rest, two-minute TTL.
  // Supabase table is server-only under RLS; no browser/anon read permission.
  const ticket = randomBytes(32).toString("base64url")
  const ticketHash = createHash("sha256").update(ticket).digest("hex")
  try {
    const db = createServiceClient()
    const { error } = await db.from("kompas_desktop_handoffs").insert({
      ticket_hash: ticketHash, user_id: user.id, payload: safe,
      expires_at: new Date(Date.now() + 120_000).toISOString(),
    })
    if (error) throw error
    // Opportunistic expiry cleanup. Redemption atomically deletes valid rows.
    await db.from("kompas_desktop_handoffs").delete().lt("expires_at", new Date().toISOString())
    return NextResponse.json({ ok: true, ticket, expiresInSeconds: 120 }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ ok: false, error: "Desktop connection is unavailable. Your saved session is unchanged." }, { status: 503, headers: NO_STORE })
  }
}
