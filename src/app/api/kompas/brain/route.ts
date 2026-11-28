import { NextRequest, NextResponse } from "next/server"
import { authenticatedUser } from "@/lib/authBoundary"
import { hashUserId } from "@/lib/sttLedger"
import { checkRateLimit } from "@/lib/rateLimit"
import { getDossierProfile, getDossierSessions } from "@/lib/dossier"
import { blob } from "@/lib/storage"
import { masterBibleStore } from "@/lib/kompas-master-bible"
import { HOUSTON_RESUME } from "@/lib/kompasHonestyGate"
import {
  ensureAnswerBrain, readBrain, saveChunkEdit, seedBrain, writeSessionBack,
  type BrainSources, type FeedbackNote,
} from "@/lib/kompasLivingBrain"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

const NO_STORE = { "Cache-Control": "no-store" }
const MAX = 500_000

function str(value: unknown, max: number): string {
  return typeof value === "string" ? value.replace(/\u0000/g, "").trim().slice(0, max) : ""
}

function pairs(value: unknown, max: number): { q: string; a: string }[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, max).map((row) => {
    const item = row && typeof row === "object" ? row as { q?: unknown; a?: unknown; text?: unknown; source?: unknown } : {}
    return { q: str(item.q, 800), a: str(item.a ?? item.text, 2000), source: str(item.source, 40) }
  }).filter((row) => row.q || row.a)
}

function notesOf(value: unknown): FeedbackNote[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 40).map((row) => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {}
    return {
      question: str(item.question, 800),
      answer: str(item.answer, 2000),
      before: str(item.before, 400),
      note: str(item.note, 800),
    }
  }).filter((row) => row.note)
}

async function gather(owner: string, body: Record<string, unknown>): Promise<BrainSources> {
  const sources: BrainSources = {
    houston: HOUSTON_RESUME,
    persona: str(body.persona, 8000),
    books: pairs(body.books, 12),
  }
  try {
    const profile = await getDossierProfile(owner)
    if (profile) sources.persona = [sources.persona, (profile.skills || []).slice(0, 24).join(", ")].filter(Boolean).join("\n")
  } catch { /* the dossier store stays untouched */ }
  try { sources.dossierSessions = await getDossierSessions(owner, 8) } catch { /* read only */ }
  try {
    const bible = await masterBibleStore().readLatest(owner)
    sources.masterChunks = (bible?.index?.chunks || []).slice(-8).map((item) => ({ title: item.title, text: item.text }))
  } catch { /* the 16-hex owner key is not a master-bible digest; the revision files stay */ }
  try {
    const active = await blob.getText(`dossier/${owner}/fast/active.json`)
    const digest = active ? str((JSON.parse(active) as { digest?: unknown }).digest, 80) : ""
    if (/^[a-f0-9]{64}$/.test(digest)) {
      const raw = await blob.getText(`dossier/${owner}/fast/${digest}/index.json`)
      const index = raw ? JSON.parse(raw) as { chunks?: { title?: string; text?: string }[] } : null
      sources.preparedChunks = (index?.chunks || []).slice(0, 6).map((item) => ({ title: item.title, text: item.text || "" }))
    }
  } catch { /* prepared index stays where it is */ }
  return sources
}

export async function GET(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const owner = hashUserId(user.id)
  const question = str(request.nextUrl.searchParams.get("q"), 500)
  if (request.nextUrl.searchParams.get("warm") === "1") {
    const warmed = await ensureAnswerBrain(owner, { question })
    return NextResponse.json({ ok: true, warmed: true, trace: warmed.trace }, { headers: NO_STORE })
  }
  const brain = await readBrain(owner)
  return NextResponse.json({
    ok: true,
    revision: brain.doc.revision,
    updatedAt: brain.doc.updatedAt,
    markdown: brain.markdown,
    versions: brain.versions,
    chunks: brain.doc.chunks,
    trace: question ? (await ensureAnswerBrain(owner, { question })).trace : [],
  }, { headers: NO_STORE })
}

export async function PUT(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-brain:${user.id}`, { max: 60, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: "Nothing to save." }, { status: 400, headers: NO_STORE }) }
  const id = str(body.id, 40)
  if (!id) return NextResponse.json({ error: "Missing chunk." }, { status: 400, headers: NO_STORE })
  try {
    const doc = await saveChunkEdit(hashUserId(user.id), id, {
      body: typeof body.body === "string" ? body.body : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      weight: typeof body.weight === "number" ? body.weight : undefined,
    })
    return NextResponse.json({ ok: true, revision: doc.revision, chunks: doc.chunks }, { headers: NO_STORE })
  } catch (error) {
    const message = error instanceof Error && /Houston|Unknown/.test(error.message) ? error.message : "Could not save that chunk."
    return NextResponse.json({ error: message }, { status: 400, headers: NO_STORE })
  }
}

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  if (Number(request.headers.get("content-length")) > MAX) {
    return NextResponse.json({ error: "That brain update is too large." }, { status: 413, headers: NO_STORE })
  }
  const limited = checkRateLimit(`kompas-brain:${user.id}`, { max: 30, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Too much at once. Wait a moment." }, { status: 429, headers: NO_STORE })
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: "Nothing to save." }, { status: 400, headers: NO_STORE }) }
  const owner = hashUserId(user.id)
  const action = str(body.action, 20)
  try {
    if (action === "seed") {
      const doc = await seedBrain(owner, await gather(owner, body))
      return NextResponse.json({ ok: true, revision: doc.revision, chunks: doc.chunks }, { headers: NO_STORE })
    }
    if (action === "session") {
      const result = await writeSessionBack(owner, {
        qa: pairs(body.qa, 40),
        transcript: str(body.transcript, 12000),
        notes: notesOf(body.notes),
      })
      return NextResponse.json({ ok: true, ...result }, { headers: NO_STORE })
    }
    return NextResponse.json({ error: "Unknown brain action." }, { status: 400, headers: NO_STORE })
  } catch {
    return NextResponse.json({ error: "The brain could not be saved." }, { status: 503, headers: NO_STORE })
  }
}
