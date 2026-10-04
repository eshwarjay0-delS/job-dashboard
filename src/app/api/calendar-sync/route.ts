import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getGoogleWorkspaceAccessToken } from "@/lib/googleWorkspace"
import { checkRateLimit } from "@/lib/rateLimit"

export const runtime = "nodejs"

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 })

  const rl = checkRateLimit(`calendar-sync:${user.id}`, { max: 20, windowMs: 60 * 60 * 1000 })
  if (!rl.ok) return NextResponse.json({ error: "Calendar sync limit reached. Try again later." }, { status: 429 })

  const token = await getGoogleWorkspaceAccessToken(user.id)
  if (!token) return NextResponse.json({ connected: false, events: [] }, { status: 403 })

  const start = new Date()
  const end = new Date(start.getTime() + 90 * 24 * 60 * 60 * 1000)
  const params = new URLSearchParams({
    timeMin: start.toISOString(),
    timeMax: end.toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "100",
  })
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20000),
  })
  const body = await res.json().catch(() => ({}))
  if (!res.ok) return NextResponse.json({ error: body?.error?.message || "Calendar sync failed." }, { status: 502 })

  const events = (body.items || []).map((e: any) => ({
    id: e.id,
    title: e.summary || "Untitled event",
    start: e.start?.dateTime || e.start?.date || null,
    end: e.end?.dateTime || e.end?.date || null,
    location: e.location || "",
    meetingUrl: e.hangoutLink || e.conferenceData?.entryPoints?.find((x: any) => x.entryPointType === "video")?.uri || "",
  }))

  return NextResponse.json({ connected: true, events })
}
