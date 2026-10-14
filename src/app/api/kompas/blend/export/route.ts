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

  const [profile, sessions] = await Promise.all([
    getDossierProfile(uHash).catch(() => null),
    getDossierSessions(uHash, 50).catch(() => []),
  ])

  // Pros only: sessions with real Q&A. A turn counts when it has both a
  // question and a spoken answer worth keeping.
  const goodSessions = (sessions || [])
    .map((s) => ({
      ...s,
      qa: (s.qa || []).filter((t) => t && t.q && t.q.trim() && t.a && t.a.trim().length > 20),
    }))
    .filter((s) => s.qa.length > 0)

  const fields: Record<string, unknown> = {}
  for (const f of (profile?.fields || [])) {
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
    profile: profile || null,
    sessions: goodSessions,
    fields,
    counts: {
      sessions: goodSessions.length,
      qa: goodSessions.reduce((n, s) => n + s.qa.length, 0),
      fields: Object.keys(fields).length,
    },
  }, { headers: NO_STORE })
}
