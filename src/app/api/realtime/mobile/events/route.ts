import { NextRequest, NextResponse } from "next/server"
import { createClientFromRequest } from "@/lib/supabase/server"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  ingestClientMobileEvent,
  listMobileEvents,
} from "@/lib/realtime/mobileServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(req: NextRequest) {
  const supabase = await createClientFromRequest(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const sessionId = String(req.nextUrl.searchParams.get("sessionId") || "").trim()
  const after = Math.max(0, Number(req.nextUrl.searchParams.get("after") || 0) || 0)
  const limit = Math.max(1, Math.min(Number(req.nextUrl.searchParams.get("limit") || 100) || 100, 200))

  if (!sessionId) {
    return NextResponse.json({ error: "sessionId is required." }, { status: 400 })
  }

  try {
    const events = await listMobileEvents({
      userId: user.id,
      sessionId,
      afterId: after,
      limit,
    })
    return NextResponse.json({ ok: true, events })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    )
  }
}

export async function POST(req: NextRequest) {
  const supabase = await createClientFromRequest(req)
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit("mobile-event:" + user.id, { max: 240, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Realtime event limit reached. Slow down and retry." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } },
    )
  }

  const body = await req.json().catch(() => ({}))
  const sessionId = String(body.sessionId || "").trim()
  const clientEventId = String(body.clientEventId || "").trim()
  const eventType = String(body.eventType || "").trim()
  const payload =
    body.payload && typeof body.payload === "object" && !Array.isArray(body.payload)
      ? body.payload as Record<string, unknown>
      : {}

  if (!sessionId || !clientEventId || !eventType) {
    return NextResponse.json(
      { error: "sessionId, clientEventId, and eventType are required." },
      { status: 400 },
    )
  }
  if (clientEventId.length > 180) {
    return NextResponse.json({ error: "clientEventId is too long." }, { status: 400 })
  }

  try {
    const event = await ingestClientMobileEvent({
      userId: user.id,
      sessionId,
      clientEventId,
      eventType,
      payload,
    })
    return NextResponse.json({ ok: true, event })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 409 },
    )
  }
}
