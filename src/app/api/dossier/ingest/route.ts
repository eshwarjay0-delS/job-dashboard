import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { appendDossierSession } from "@/lib/dossier"
import { saveSessionMiniDossier } from "@/lib/kompas-master-bible"
import { hashUserId } from "@/lib/sttLedger"
import { createServiceClient } from "@/lib/supabase/service"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store" }
const BUCKET = "kompas-sessions"

// POST /api/dossier/ingest { sessionId, field? } — read the session's manifest
// from Supabase Storage, pair interviewer questions (system audio) with the
// user's answers (mic audio), and append the Q&A to the dossier.
// Called when a session ends; safe to retry (idempotent per session id).
export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again." }, { status: 401, headers: NO_STORE })
  let body: { sessionId?: unknown; field?: unknown }
  try { body = await request.json() } catch { body = {} }
  const sessionId = String(body.sessionId || "").trim()
  if (!sessionId || sessionId.length > 80) {
    return NextResponse.json({ error: "sessionId required." }, { status: 400, headers: NO_STORE })
  }
  const field = String(body.field || "general").slice(0, 40)

  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: "Storage unavailable." }, { status: 503, headers: NO_STORE })

  // Find the manifest: kompas-sessions/{userId}/{sessionId}/manifest.jsonl
  const manifestPath = `kompas-sessions/${user.id}/${sessionId}/manifest.jsonl`
  let text = ""
  try {
    const { data, error } = await sb.storage.from(BUCKET).download(manifestPath)
    if (error || !data) return NextResponse.json({ ok: false, reason: "no manifest yet" }, { headers: NO_STORE })
    text = await data.text()
  } catch {
    return NextResponse.json({ ok: false, reason: "manifest unreadable" }, { headers: NO_STORE })
  }

  // Pair Q&A: system-audio chunks are the interviewer, mic chunks are the user.
  // A question runs until the user starts answering; an answer runs until the
  // next question. Short fragments (<12 chars) are noise — dropped.
  const qa: { q: string; a: string }[] = []
  let curQ = "", curA = ""
  const flush = () => {
    if (curQ.trim().length >= 12 && curA.trim().length >= 12) {
      qa.push({ q: curQ.trim().slice(0, 800), a: curA.trim().slice(0, 1500) })
    }
    curQ = ""; curA = ""
  }
  for (const line of text.split("\n")) {
    if (!line.trim()) continue
    let m: { source?: string; transcript?: string }
    try { m = JSON.parse(line) } catch { continue }
    const t = String(m.transcript || "").trim()
    if (t.length < 12) continue
    if (m.source === "system") {
      if (curA) flush() // user was answering; new question starts a pair
      curQ += (curQ ? " " : "") + t
    } else {
      curA += (curA ? " " : "") + t
    }
  }
  flush()

  if (!qa.length) return NextResponse.json({ ok: false, reason: "no Q&A pairs found" }, { headers: NO_STORE })

  const owner = hashUserId(user.id)
  try {
    // Immutable mini + revisioned master first; a failure is not quietly
    // disguised as a successful Bible update. A retry is idempotent.
    const master = await saveSessionMiniDossier(owner, sessionId, field, qa)
    const recorded = await appendDossierSession(owner, { id: sessionId, field, qa: qa.slice(0, 40) })
    return NextResponse.json({
      ok: true, recorded, pairs: qa.length,
      miniDossier: "stored", masterBible: "updated",
      masterRevision: master.revision, newSession: master.added,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({
      ok: false, error: "Session Bible update could not be confirmed. Retry the same session ID safely.",
    }, { status: 503, headers: NO_STORE })
  }
}
