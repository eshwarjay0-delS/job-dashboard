import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { keysFor, resolveKeys, callLLM } from "@/lib/llm"
import { checkRateLimit } from "@/lib/rateLimit"
import { hashUserId } from "@/lib/sttLedger"
import { readPreparedDossier, savePreparedDossier } from "@/lib/kompas-dossier-store"
import {
  buildDualDossierPlan, dossierCitationWarnings,
  type DossierPrompt, type DossierStage,
} from "@/lib/kompas-dossier-bots"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 120
const HEADERS = { "Cache-Control": "no-store" }
type RequestBody = { mode?: DossierStage | "combined"; sources?: unknown }
const MAX_BYTES = 1_100_000

/**
 * Authenticated, on-demand Kompas dossier builder. This does NOT access consumer
 * NotebookLM or private ChatGPT history: submitted excerpts are the only inputs.
 * Both analytical roles use the app's approved, configured LLM providers.
 *
 * POST { mode: "notebook" | "dossier" | "combined", sources: [{
 *   id, kind: "resume"|"job_description"|"document"|"chat_transcript"|
 *   "interview_transcript"|"interview_expectations"|"candidate_correction",
 *   title, text
 * }] }
 */
/** Load a previously committed manuscript; no model invocation. */
export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in." }, { status: 401, headers: HEADERS })
  const digest = request.nextUrl.searchParams.get("digest") || ""
  if (!/^[a-f0-9]{64}$/.test(digest)) return NextResponse.json({ error: "Valid digest required." }, { status: 400, headers: HEADERS })
  try {
    const document = await readPreparedDossier(hashUserId(user.id), digest)
    if (!document) return NextResponse.json({ error: "No prepared dossier at this digest." }, { status: 404, headers: HEADERS })
    return NextResponse.json({ ok: true, dossier: document }, { headers: HEADERS })
  } catch {
    return NextResponse.json({ error: "Dossier storage unavailable." }, { status: 503, headers: HEADERS })
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in to prepare a dossier." }, { status: 401, headers: HEADERS })
  const size = Number(request.headers.get("content-length") || 0)
  if (size > MAX_BYTES) return NextResponse.json({ error: "Request too large; divide sources without dropping content." }, { status: 413, headers: HEADERS })
  let body: RequestBody
  try {
    const raw = await request.text()
    if (raw.length > MAX_BYTES) return NextResponse.json({ error: "Request too large; divide sources without dropping content." }, { status: 413, headers: HEADERS })
    body = JSON.parse(raw) as RequestBody
  } catch {
    return NextResponse.json({ error: "Invalid JSON request." }, { status: 400, headers: HEADERS })
  }
  const mode = body?.mode || "combined"
  if (!["notebook", "dossier", "combined"].includes(mode)) {
    return NextResponse.json({ error: "Invalid dossier mode." }, { status: 400, headers: HEADERS })
  }
  let plan
  try { plan = buildDualDossierPlan(body.sources) }
  catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid sources." }, { status: 400, headers: HEADERS })
  }
  const allowed = checkRateLimit("kompas:dossier:" + user.id, { max: 4, windowMs: 60 * 60_000 })
  if (!allowed.ok) return NextResponse.json({ error: "Dossier generation limit reached. Try later." }, { status: 429, headers: { ...HEADERS, "Retry-After": String(allowed.retryAfterSec || 3600) } })
  const keys = await keysFor("kompas:dossier", resolveKeys())
  const run = (p: DossierPrompt) => callLLM({
    keys, tier: "heavy", system: p.system, user: p.user,
    maxTokens: 6500, timeoutMs: 28000,
    purpose: "kompas:dossier-" + p.role,
  })
  try {
    if (mode !== "combined") {
      const stage = await run(mode === "notebook" ? plan.notebook : plan.dossier)
      return NextResponse.json({
        ok: true, mode, sourceDigest: plan.sourceDigest, version: plan.version,
        generation: { text: stage.text, provider: stage.provider, model: stage.model },
        sourceManifest: plan.sources.map(({ id, kind, title, digest }) => ({ id, kind, title, digest })),
        citationWarnings: dossierCitationWarnings(stage.text, plan.sources),
        factualReview: "required", pdfExport: "not-yet-generated", googleNotebookApiUsed: false,
      }, { headers: HEADERS })
    }
    // Both specialists analyze the SAME sources independently before synthesis.
    const [notebook, dossier] = await Promise.all([run(plan.notebook), run(plan.dossier)])
    const combined = await run(plan.synthesis(notebook.text, dossier.text))
    await savePreparedDossier(hashUserId(user.id), plan.sourceDigest, plan.sources, {
      notebook: notebook.text, dossier: dossier.text, unified: combined.text,
    })
    return NextResponse.json({
      ok: true, mode, sourceDigest: plan.sourceDigest, version: plan.version,
      notebook: { text: notebook.text, provider: notebook.provider, model: notebook.model },
      dossier: { text: dossier.text, provider: dossier.provider, model: dossier.model },
      unified: { text: combined.text, provider: combined.provider, model: combined.model },
      sourceManifest: plan.sources.map(({ id, kind, title, digest }) => ({ id, kind, title, digest })),
      citationWarnings: dossierCitationWarnings(combined.text, plan.sources),
      factualReview: "required", pdfExport: "not-yet-generated", googleNotebookApiUsed: false,
      serverStored: true,
    }, { headers: HEADERS })
  } catch {
    // A failed call is never represented as completed; do not supply a generic
    // "successful" dossier with fictional work history.
    return NextResponse.json({ error: "Dossier models unavailable or timed out. No dossier was marked complete.", sourceDigest: plan.sourceDigest },
      { status: 503, headers: HEADERS })
  }
}
