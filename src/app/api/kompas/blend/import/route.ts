import { NextRequest, NextResponse } from "next/server"
import { createHash } from "node:crypto"
import { authenticatedUser } from "@/lib/authBoundary"
import { hashUserId } from "@/lib/sttLedger"
import { checkRateLimit } from "@/lib/rateLimit"
import {
  getDossierProfile, getDossierSessions, saveDossierProfile, appendDossierSession,
  type DossierSession, type DossierProfile,
} from "@/lib/dossier"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
export const maxDuration = 60

// One curated Kompas blend. Preserves all existing dossier content and accepts
// both legacy server-only exports and current { server, browser } envelopes.
// Prepared examples are LABELLED, never silently treated as experiences.
const NO_STORE = { "Cache-Control": "no-store" }
const MAX_BYTES = 4 * 1024 * 1024
const MAX_QA = 2000
type Q = { q?: unknown; a?: unknown }
type Session = Partial<DossierSession> & { qa?: Q[] }
type Profile = Partial<DossierProfile>
type Data = { kind?: unknown; profile?: Profile | null; sessions?: Session[]; fields?: Record<string, unknown> }
type Browser = { qa?: Q[]; prepared?: Q[] }
type Envelope = Data & { version?: unknown; server?: Data | null; browser?: Browser | null }
const s = (v: unknown, max: number) => typeof v === "string" ? v.trim().slice(0, max) : ""
const clean = (list: unknown, max = MAX_QA) =>
  (Array.isArray(list) ? list : [])
    .map(t => ({ q: s((t as Q)?.q, 500), a: s((t as Q)?.a, 4000) }))
    .filter(t => t.q && t.a.length > 20).slice(0, max)
const fingerprint = (q: string, a: string) =>
  createHash("sha256").update(q.trim().toLowerCase().replace(/\s+/g, " ") + "\0" + a.trim().toLowerCase().replace(/\s+/g, " ")).digest("hex")
const tag = (v: string) => createHash("sha256").update(v).digest("hex").slice(0, 24)

export async function POST(request: NextRequest) {
  const user = await authenticatedUser(request)
  if (!user) return NextResponse.json({ error: "Sign in again to use this." }, { status: 401, headers: NO_STORE })
  const limited = checkRateLimit(`kompas-blend-import:${user.id}`, { max: 10, windowMs: 60_000 })
  if (!limited.ok) return NextResponse.json({ error: "Wait a moment before importing again." }, { status: 429, headers: NO_STORE })
  if (Number(request.headers.get("content-length")) > MAX_BYTES)
    return NextResponse.json({ error: "That blend exceeds the import size limit. Preserve it as a browser archive." }, { status: 413, headers: NO_STORE })

  let envelope: Envelope
  try {
    const raw = await request.text()
    if (raw.length > MAX_BYTES) throw new Error("oversized")
    envelope = JSON.parse(raw) as Envelope
  } catch {
    return NextResponse.json({ error: "That is not a readable Kompas blend file." }, { status: 400, headers: NO_STORE })
  }
  if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)
    || (envelope.kind && envelope.kind !== "kompas-blend") || (envelope.version && envelope.version !== 1))
    return NextResponse.json({ error: "That is not a supported Kompas blend export." }, { status: 400, headers: NO_STORE })

  const data: Data = envelope.server && typeof envelope.server === "object" && !Array.isArray(envelope.server)
    ? envelope.server : envelope
  const uHash = hashUserId(user.id)
  let sessionsAdded = 0, qaAdded = 0, preparedAdded = 0, profileMerged = false
  const warnings: string[] = []

  // Keep every unique server session and its real transcript answers.
  const oldSessions = Array.isArray(data.sessions) ? data.sessions.slice(0, 200) : []
  for (const rawSession of oldSessions) {
    const qa = clean(rawSession.qa)
    if (!qa.length) continue
    const session: DossierSession = {
      id: s(rawSession.id, 80) || `blend-server-${tag(JSON.stringify(qa))}`,
      at: typeof rawSession.at === "number" && Number.isFinite(rawSession.at) ? rawSession.at : Date.now(),
      field: s(rawSession.field, 40) || "general", qa,
    }
    if (await appendDossierSession(uHash, session).catch(() => false)) {
      sessionsAdded++; qaAdded += qa.length
    }
  }
  if (Array.isArray(data.sessions) && data.sessions.length > 200) warnings.push("Only 200 server sessions could be imported per request.")

  // Browser Q&A and rehearsed replies are never omitted. Dedupe across
  // earlier server sessions by normalized question+answer text. Store prepared
  // answers in separate labelled sessions, not as invented real experience.
  const browser = envelope.browser && typeof envelope.browser === "object" ? envelope.browser : null
  const before = await getDossierSessions(uHash, 50000).catch(() => [])
  const seen = new Set(before.flatMap(x => (x.qa || []).map(t => fingerprint(t.q, t.a))))
  for (const [field, rows] of [
    ["imported-answer", browser?.qa],
    ["prepared", browser?.prepared],
  ] as const) {
    const unique: Array<{ q: string; a: string }> = []
    for (const row of clean(rows)) {
      const key = fingerprint(row.q, row.a)
      if (seen.has(key)) continue
      seen.add(key); unique.push(row)
    }
    for (let i = 0; i < unique.length; i += 25) {
      const qa = unique.slice(i, i + 25)
      const session: DossierSession = {
        id: `blend-${field}-${tag(JSON.stringify(qa))}`,
        at: Date.now(), field, qa,
      }
      if (await appendDossierSession(uHash, session).catch(() => false)) {
        sessionsAdded++; qaAdded += qa.length
        if (field === "prepared") preparedAdded += qa.length
      }
    }
    if (Array.isArray(rows) && rows.length > MAX_QA) warnings.push(`Only ${MAX_QA} ${field} records could be imported in one request.`)
  }

  // Profile union is additive, and always stays scoped to the signed-in
  // user. Imported field research is not copied into global shared records.
  const pIn = data.profile
  if (pIn && typeof pIn === "object" && !Array.isArray(pIn)) {
    const cur = (await getDossierProfile(uHash).catch(() => null)) ||
      { skills: [], projects: [], keywords: [], fields: [] as string[] }
    const union = (a: unknown, b: unknown) =>
      [...new Set([...(Array.isArray(a) ? a : []), ...(Array.isArray(b) ? b : [])]
        .filter(x => typeof x === "string").map(x => String(x).trim().slice(0, 120)).filter(Boolean))].slice(0, 500)
    const projects = [...(cur.projects || [])]
    for (const p of (Array.isArray(pIn.projects) ? pIn.projects : []).slice(0, 100)) {
      if (!p || typeof p !== "object") continue
      const name = s(p.name, 120)
      if (name && !projects.some(x => x.name.toLowerCase() === name.toLowerCase())) projects.push({
        name, role: s(p.role, 120), impact: s(p.impact, 500),
        keywords: union([], p.keywords).slice(0, 30),
      })
    }
    try {
      await saveDossierProfile(uHash, {
        skills: union(cur.skills, pIn.skills), projects: projects.slice(0, 200),
        keywords: union(cur.keywords, pIn.keywords),
        fields: union(cur.fields, pIn.fields),
      })
      profileMerged = true
    } catch { warnings.push("The profile could not be saved; existing profile data was kept.") }
  }

  if (data.fields && Object.keys(data.fields).length) {
    warnings.push("Shared field research was preserved in the export but not imported into the global knowledge base without review.")
  }
  return NextResponse.json({
    ok: true, sessionsAdded, qaAdded, preparedAdded, profileMerged,
    warnings, browserPromoted: qaAdded > 0,
  }, { headers: NO_STORE })
}
