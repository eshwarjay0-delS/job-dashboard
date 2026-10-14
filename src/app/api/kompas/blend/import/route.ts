import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { hashUserId } from "@/lib/sttLedger"
import {
  getDossierProfile, saveDossierProfile, appendDossierSession,
  type DossierSession, type DossierProfile,
} from "@/lib/dossier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// POST /api/kompas/blend/import — feed a blend file back into the dossier.
//
// Merge-only, never replace: sessions are appended idempotently (by id),
// profile skills/projects/keywords are unioned. A blend file from either app
// (or a hand-built one) lands here and makes the next session smarter.

const NO_STORE = { "Cache-Control": "no-store" }
const MAX_QA = 2000

type BlendFile = {
  kind?: string
  profile?: Partial<DossierProfile> | null
  sessions?: Array<Partial<DossierSession> & { qa?: Array<{ q?: string; a?: string }> }>
}

const s = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : ""

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const uHash = hashUserId(user.id)

  let body: BlendFile
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "That file isn't a blend export." }, { status: 400, headers: NO_STORE })
  }
  if (!body || typeof body !== "object" || (body.kind && body.kind !== "kompas-blend"))
    return NextResponse.json({ error: "That file isn't a blend export." }, { status: 400, headers: NO_STORE })

  let sessionsAdded = 0, qaAdded = 0

  // Sessions: pros only, idempotent per id.
  const sessions = Array.isArray(body.sessions) ? body.sessions.slice(0, 200) : []
  for (const sIn of sessions) {
    const qa = (Array.isArray(sIn.qa) ? sIn.qa : [])
      .map((t) => ({ q: s(t?.q, 500), a: s(t?.a, 4000) }))
      .filter((t) => t.q && t.a.length > 20)
      .slice(0, MAX_QA)
    if (!qa.length) continue
    const session: DossierSession = {
      id: s(sIn.id, 80) || `blend-${Date.now()}-${sessionsAdded}`,
      at: typeof sIn.at === "number" ? sIn.at : Date.now(),
      field: s(sIn.field, 40) || "general",
      qa,
    }
    if (await appendDossierSession(uHash, session).catch(() => false)) {
      sessionsAdded++
      qaAdded += qa.length
    }
  }

  // Profile: union skills/projects/keywords, never replace.
  let profileMerged = false
  const pIn = body.profile
  if (pIn && typeof pIn === "object") {
    const cur = (await getDossierProfile(uHash).catch(() => null)) || { skills: [], projects: [], keywords: [] }
    const union = (a: string[], b: string[]) => [...new Set([...(a || []), ...(b || [])].map((x) => String(x).trim()).filter(Boolean))]
    const projUnion = [...(cur.projects || [])]
    for (const p of (pIn.projects || [])) {
      const name = String(p?.name || "").trim()
      if (name && !projUnion.some((x) => String(x.name).toLowerCase() === name.toLowerCase()))
        projUnion.push({ name: s(p.name, 120), role: s(p.role, 120), impact: s(p.impact, 500), keywords: Array.isArray(p.keywords) ? p.keywords.map((k) => s(k, 40)).filter(Boolean) : [] })
    }
    await saveDossierProfile(uHash, {
      skills: union(cur.skills || [], pIn.skills || []),
      projects: projUnion,
      keywords: union(cur.keywords || [], pIn.keywords || []),
      fields: union(cur.fields || [], pIn.fields || []),
    }).catch(() => {})
    profileMerged = true
  }

  return NextResponse.json({
    ok: true,
    sessionsAdded,
    qaAdded,
    profileMerged,
  }, { headers: NO_STORE })
}
