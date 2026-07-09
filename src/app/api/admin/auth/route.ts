import { NextRequest, NextResponse } from "next/server"
import { makeAdminToken } from "@/lib/adminConfig"

// Admin credentials MUST be set via env vars — see .env.local for local dev values.
// Never hardcode credentials in source. Fail closed (empty string → always rejects)
// if env vars are missing rather than silently using a known default.
const ADMIN_USER = process.env.ADMIN_USERNAME || ""
const ADMIN_PASS = process.env.ADMIN_PASSWORD || ""

// ── Brute-force protection ───────────────────────────────────────────────────
// No auth provider here (this is a single shared admin login, not per-user), so
// a lightweight in-memory IP-based lockout + fixed delay is the right amount of
// protection for now. Resets on server restart — acceptable for a first pass;
// swap for a durable store (Redis/Upstash) before a real multi-instance deploy.
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; firstAt: number }>()
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

function clientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0].trim()
    || request.headers.get("x-real-ip")
    || "unknown"
}

export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  const now = Date.now()
  const rec = attempts.get(ip)

  if (rec && now - rec.firstAt < LOCKOUT_MS && rec.count >= MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((LOCKOUT_MS - (now - rec.firstAt)) / 1000)
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Try again later." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
    )
  }

  // Fixed delay on every attempt (success or failure) — makes rapid automated
  // guessing impractically slow without affecting a real human logging in once.
  await sleep(400)

  // Fail closed — if env vars not set, admin login is disabled entirely
  if (!ADMIN_USER || !ADMIN_PASS) {
    return NextResponse.json({ ok: false, error: "Admin not configured (set ADMIN_USERNAME + ADMIN_PASSWORD env vars)" }, { status: 503 })
  }

  let body: { user?: string; pass?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 })
  }
  const ok = !!(body.user && body.pass && body.user === ADMIN_USER && body.pass === ADMIN_PASS)

  if (ok) {
    attempts.delete(ip)
  } else {
    if (!rec || now - rec.firstAt >= LOCKOUT_MS) {
      attempts.set(ip, { count: 1, firstAt: now })
    } else {
      rec.count++
    }
  }

  const res = NextResponse.json({ ok }, { status: ok ? 200 : 401 })
  if (ok) {
    // Real server-side session — an httpOnly, signed cookie the admin config API
    // checks (upgrades the old bypassable sessionStorage-only gate).
    res.cookies.set("mf_admin", makeAdminToken(), {
      httpOnly: true, sameSite: "strict", path: "/", maxAge: 60 * 60 * 8,
    })
  }
  return res
}
