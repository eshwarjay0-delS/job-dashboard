import { NextRequest, NextResponse } from "next/server"
import { createClientFromRequest } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  createOrResumeMobileSession,
  updateMobileSessionState,
  type MobilePlatform,
  type MobileSessionStatus,
} from "@/lib/realtime/mobileServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const PLATFORMS = new Set<MobilePlatform>(["android", "ios", "web"])
const STATUSES = new Set<MobileSessionStatus>(["active", "background", "offline", "ended"])

function sanitizeClientInstanceId(value: unknown) {
  const id = String(value || "").trim()
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(id)) {
    throw new Error("clientInstanceId is invalid.")
  }
  return id
}

export async function POST(req: NextRequest) {
  const supabase = await createClientFromRequest(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit("mobile-session:" + user.id, { max: 30, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Too many realtime session requests." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const body = await req.json().catch(() => ({}))

  try {
    const clientInstanceId = sanitizeClientInstanceId(body.clientInstanceId)
    const platform = String(body.platform || "") as MobilePlatform
    if (!PLATFORMS.has(platform)) {
      return NextResponse.json({ error: "Unsupported mobile platform." }, { status: 400 })
    }

    const appVersion = body.appVersion ? String(body.appVersion).slice(0, 64) : null
    const metadata =
      body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
        ? body.metadata as Record<string, unknown>
        : {}

    const session = await createOrResumeMobileSession({
      userId: user.id,
      clientInstanceId,
      platform,
      appVersion,
      // Device-slot attachment is intentionally server-controlled. A native client
      // cannot assert its own subscription/device slot.
      deviceSlotId: null,
      metadata,
    })

    return NextResponse.json({ ok: true, session })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 400 },
    )
  }
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClientFromRequest(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const sessionId = String(body.sessionId || "").trim()
  const status = String(body.status || "") as MobileSessionStatus

  if (!sessionId || !STATUSES.has(status)) {
    return NextResponse.json({ error: "sessionId and a valid status are required." }, { status: 400 })
  }

  try {
    const session = await updateMobileSessionState({
      userId: user.id,
      sessionId,
      status,
    })
    return NextResponse.json({ ok: true, session })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    )
  }
}