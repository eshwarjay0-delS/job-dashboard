import { createHash } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/service"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
const NO_STORE = { "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" }

// One-use capability. No browser session is required on first desktop install;
// ONLY the authenticated website can mint a high-entropy ticket. Expired,
// replayed or guessed tickets reveal nothing and never transfer credentials.
export async function POST(request: NextRequest) {
  if (Number(request.headers.get("content-length")) > 500) return NextResponse.json({ ok: false }, { status: 413, headers: NO_STORE })
  const remote = request.headers.get("x-real-ip") || "unknown"
  const limit = checkRateLimit("kompas-desktop-redeem:" + remote, { max: 120, windowMs: 60_000 })
  if (!limit.ok) return NextResponse.json({ ok: false }, { status: 429, headers: NO_STORE })
  const body = await request.json().catch(() => null)
  const ticket = body && typeof body === "object" ? (body as Record<string, unknown>).ticket : null
  if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(ticket)) {
    return NextResponse.json({ ok: false, error: "Invalid connection ticket." }, { status: 400, headers: NO_STORE })
  }
  try {
    const db = createServiceClient()
    const hash = createHash("sha256").update(ticket).digest("hex")
    const { data, error } = await db.rpc("claim_kompas_desktop_handoff", { p_ticket_hash: hash })
    if (error) throw error
    if (!data || typeof data !== "object" || data.site !== "marketfit" || typeof data.id !== "string") {
      return NextResponse.json({ ok: false, error: "Connection expired or already used. Press Connect & start again." }, { status: 410, headers: NO_STORE })
    }
    return NextResponse.json({ ok: true, session: data }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ ok: false, error: "Could not retrieve your interview. Try again." }, { status: 503, headers: NO_STORE })
  }
}
