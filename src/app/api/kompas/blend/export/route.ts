import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { hashUserId } from "@/lib/sttLedger"
import { getDossierProfile, getDossierSessions, getFieldKnowledge } from "@/lib/dossier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// GET /api/kompas/blend/export — the server-side "pros" for the blend.
//
// The owner's blend directive (2026-10-14): export everything usable from both
// apps — the pros, never the cons — so the two Kompas copies mix into one
// human-sounding whole. This route exports MarketFit's server-held pros:
// the dossier profile (resume), session Q&A (with [beat]/[breath] pause
// markers intact), and field knowledge. Only successful, non-empty Q&A is
// exported — degraded, failed or empty turns are cons and stay out.

const NO_STORE = { "Cache-Control": "no-store" }

export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const uHash = hashUserId(user.id)
  // Export the full dossier in pages. The previous fixed last-50 limit silently
  // lost older interviews, which is unacceptable before the perfACT sunset.
  const page = Math.max(0, Math.min(100000, Number(request.nextUrl.searchParams.get("page")) || 0))
  const limit = 100
  const [profile, sessions] = await Promise.all([
    getDossierProfile(uHash).catch(() => null),
    getDossierSessions(uHash, 100000).catch(() => []),
  ])

  // Pros only: sessions with real Q&A. A turn counts when it has both a
  // question and a spoken answer worth keeping.
  const goodSessions = (sessions || [])
    .map((s) => ({
      ...s,
      qa: (s.qa || []).filter((t) => t && t.q && t.q.trim() && t.a && t.a.trim().length > 20),
    }))
    .filter((s) => s.qa.length > 0)
  const pageSessions = goodSessions.slice(page * limit, (page + 1) * limit)
  const nextPage = (page + 1) * limit < goodSessions.length ? page + 1 : null

  const fields: Record<string, unknown> = {}
  for (const f of (page === 0 ? profile?.fields || [] : [])) {
    try {
      const k = await getFieldKnowledge(f)
      if (k) fields[f] = k
    } catch { /* skip */ }
  }

  return NextResponse.json({
    kind: "kompas-blend",
    version: 1,
    exportedAt: new Date().toISOString(),
    source: "marketfit",
    profile: page === 0 ? profile || null : null,
    sessions: pageSessions,
    fields,
    page,
    limit,
    nextPage,
    totalSessions: goodSessions.length,
    counts: {
      sessions: pageSessions.length,
      qa: pageSessions.reduce((n, s) => n + s.qa.length, 0),
      fields: Object.keys(fields).length,
    },
  }, { headers: NO_STORE })
}
