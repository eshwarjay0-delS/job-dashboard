import { NextRequest, NextResponse } from "next/server"
import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { runInThisContext } from "node:vm"
import { authenticatedUser } from "@/lib/authBoundary"
import { checkRateLimit } from "@/lib/rateLimit"
import { hashUserId } from "@/lib/sttLedger"
import { blob } from "@/lib/storage"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// The original perfACT nine-listener/two-anchor algorithm, now hosted by
// MarketFit. The algorithm comes from the copied, versioned source, not a
// simplified rewrite. Shared R2 storage is scoped per authenticated user.
const NO_STORE = { "Cache-Control": "no-store" }
type Anchor = Record<string, unknown> & { prose?: string }
type Anchors = Partial<Record<"engineer" | "director", Anchor>>
type LevelCore = {
  ANCHORS: string[]
  LADDER: string[]
  key: (question: string, role: string, resume: string) => string
  maturityKey: (question: string, resume: string) => string
  sessionLevelsKey: (sid: string, question: string, resume: string) => string
  fromProse: (text: string, level: string) => Anchor | null
  shape: (raw: unknown, level: string) => Anchor | null
  deriveAll: (anchors: Anchors) => Record<string, unknown>
}
type Diamond = {
  POLICY: string
  MAP: Record<string, string>
  ANCHORS: string[]
  plan: (level: string, anchors: Anchors, peerOf?: string) => unknown
  questionPlan: (anchors: Anchors) => unknown
}
type GlobalLevels = typeof globalThis & { KompasLevels?: LevelCore; KompasDiamond?: Diamond }

let loader: Promise<{ L: LevelCore; D: Diamond }> | null = null
function algorithm() {
  if (!loader) loader = (async () => {
    const globals = globalThis as GlobalLevels
    // Both files are fixed files from this repository; request data is NEVER
    // evaluated. Reuse exact source so the derived answers and cache keys agree.
    if (!globals.KompasDiamond) {
      runInThisContext(await readFile(join(process.cwd(), "public", "kompas", "diamond.js"), "utf8"), { filename: "kompas/diamond.js", timeout: 1000 })
    }
    if (!globals.KompasLevels) {
      runInThisContext(await readFile(join(process.cwd(), "public", "kompas", "levels-core.js"), "utf8"), { filename: "kompas/levels-core.js", timeout: 1000 })
    }
    if (!globals.KompasLevels || !globals.KompasDiamond) throw new Error("Kompas level sources missing")
    return { L: globals.KompasLevels, D: globals.KompasDiamond }
  })()
  return loader
}

const str = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : ""
const validAnchors = (a: unknown, L: LevelCore): Anchors => {
  const input = a && typeof a === "object" && !Array.isArray(a) ? a as Record<string, unknown> : {}
  const out: Anchors = {}
  for (const k of ["engineer", "director"] as const) {
    if (input[k]) {
      const shaped = L.shape(input[k], k)
      if (shaped) out[k] = shaped
    }
  }
  return out
}
const pair = (a: Anchors) => !!(a.engineer && a.director)
const keyFor = (userHash: string, L: LevelCore, question: string, resume: string) =>
  `dossier/${userHash}/levels/${L.maturityKey(question, resume).replace(/[^a-zA-Z0-9:_-]/g, "")}.json`

async function readAnchors(key: string, L: LevelCore): Promise<Anchors> {
  const text = await blob.getText(key).catch(() => null)
  if (!text) return {}
  try { return validAnchors(JSON.parse(text), L) } catch { return {} }
}
function reply(
  L: LevelCore, D: Diamond, anchors: Anchors,
  { question, role, resume, sessionId, level, peerOf, source }:
  { question: string; role: string; resume: string; sessionId: string; level: string; peerOf: string; source: string },
) {
  const ready = pair(anchors)
  return {
    levels: L.deriveAll(anchors), anchors: ready ? anchors : null,
    key: sessionId ? L.sessionLevelsKey(sessionId, question, resume) : L.maturityKey(question, resume),
    maturityKey: L.maturityKey(question, resume),
    sessionKey: sessionId ? L.sessionLevelsKey(sessionId, question, resume) : "",
    dossierKey: sessionId ? "perfact.dossier." + sessionId : "",
    asked: question,
    plan: D.plan(level, anchors, peerOf || undefined),
    question: D.questionPlan(anchors),
    source, calls: 0, tokens: 0, wrote: [], shared: ready,
  }
}

export async function GET() {
  try {
    const { L, D } = await algorithm()
    return NextResponse.json({
      feature: "Answers by level", policy: D.POLICY, ladder: L.LADDER,
      madeFrom: D.MAP, anchors: D.ANCHORS, sharedStore: true,
    }, { headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "Level rules unavailable." }, { status: 503, headers: NO_STORE })
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-levels:${user.id}`, { max: 100, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Wait a moment and try again." }, { status: 429, headers: NO_STORE })
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: "Could not read the level request." }, { status: 400, headers: NO_STORE })
  }
  if (JSON.stringify(body).length > 30000)
    return NextResponse.json({ error: "That level request is too large." }, { status: 413, headers: NO_STORE })

  try {
    const { L, D } = await algorithm()
    const question = str(body.question, 400), role = str(body.role, 120)
    const resume = str(body.resume, 6000), sessionId = str(body.sessionId, 100)
    const level = str(body.level, 30) || "engineer", peerOf = str(body.peerOf, 30)
    const reqInfo = { question, role, resume, sessionId, level, peerOf, source: "derived" }

    if (body.anchors && !body.prose) {
      return NextResponse.json(reply(L, D, validAnchors(body.anchors, L), reqInfo), { headers: NO_STORE })
    }
    if (question.length < 8)
      return NextResponse.json({ levels: {}, calls: 0, error: "No question given." }, { headers: NO_STORE })

    const key = keyFor(hashUserId(user.id), L, question, resume)
    const prior = await readAnchors(key, L)
    if (body.lookup)
      return NextResponse.json(reply(L, D, prior, { ...reqInfo, source: pair(prior) ? "maturity" : "miss" }), { headers: NO_STORE })

    if (body.prose && typeof body.prose === "object" && !Array.isArray(body.prose)) {
      const prose = body.prose as Record<string, unknown>
      const next: Anchors = { ...prior }
      for (const anchor of ["engineer", "director"] as const) {
        const text = str(prose[anchor], 6000)
        if (text) {
          const shaped = L.fromProse(text, anchor)
          if (shaped) next[anchor] = shaped
        }
      }
      if (pair(next)) await blob.put(key, JSON.stringify(next))
      return NextResponse.json(reply(L, D, next, { ...reqInfo, source: "prose" }), { headers: NO_STORE })
    }
    // The frontend generates the two expensive prose anchors via /api/answer.
    // Switching levels is always a zero-call deterministic operation.
    return NextResponse.json(reply(L, D, prior, { ...reqInfo, source: pair(prior) ? "maturity" : "miss" }), { headers: NO_STORE })
  } catch {
    return NextResponse.json({ levels: {}, calls: 0, error: "The level cache is unavailable." }, { status: 503, headers: NO_STORE })
  }
}
