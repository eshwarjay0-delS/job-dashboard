import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { hashUserId } from "@/lib/sttLedger"
import { checkRateLimit } from "@/lib/rateLimit"
import { appendDossierSession } from "@/lib/dossier"
import { saveSessionMiniDossier } from "@/lib/kompas-master-bible"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60
const HEADERS = { "Cache-Control": "no-store" }
const MAX = 500_000

/** Browser and desktop session close. Q&A is saved as historical context,
 * NOT as independent evidence of candidate employment or achievements.
 * Never send a password, key, raw audio or a privileged storage path.
 */
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in to sync your session." }, { status: 401, headers: HEADERS })
  if (Number(request.headers.get("content-length")) > MAX)
    return NextResponse.json({ error: "Mini dossier too large." }, { status: 413, headers: HEADERS })
  let raw: string
  try { raw = await request.text() } catch { return NextResponse.json({ error: "Unreadable session." }, { status: 400, headers: HEADERS }) }
  if (raw.length > MAX) return NextResponse.json({ error: "Mini dossier too large." }, { status: 413, headers: HEADERS })
  let body: { sessionId?: unknown; field?: unknown; qa?: unknown }
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400, headers: HEADERS }) }
  const id = String(body.sessionId || "")
  const field = String(body.field || "general").slice(0, 80)
  if (!/^[A-Za-z0-9_.:-]{1,80}$/.test(id) || !Array.isArray(body.qa) ||
    !body.qa.length || body.qa.length > 200 || body.qa.some(x => !x || typeof x !== "object" ||
      typeof x.q !== "string" || typeof x.a !== "string" || !x.q.trim() || !x.a.trim() ||
      x.q.length > 8000 || x.a.length > 16000)) {
    return NextResponse.json({ error: "Invalid session Q&A." }, { status: 400, headers: HEADERS })
  }
  const limited = checkRateLimit("kompas:mini:" + user.id, { max: 30, windowMs: 60 * 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Session sync rate limited." }, { status: 429, headers: HEADERS })
  const owner = hashUserId(user.id)
  const qa = body.qa as { q: string; a: string }[]
  try {
    const master = await saveSessionMiniDossier(owner, id, field, qa)
    const recorded = await appendDossierSession(owner, { id, field, qa: qa.slice(0, 40) })
    return NextResponse.json({
      ok: true, miniDossier: "saved", masterBible: "updated",
      revision: master.revision, newSession: master.added, legacyRecorded: recorded,
    }, { headers: HEADERS })
  } catch {
    return NextResponse.json({
      error: "Mini dossier or master update could not be confirmed. Retry safely with the same session ID.",
    }, { status: 503, headers: HEADERS })
  }
}
