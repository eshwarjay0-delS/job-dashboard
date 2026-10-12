/**
 * The Dossier — Kompas's persistent bible per user.
 *
 * Why (2026-10-12): the owner asked for a dossier that "keeps on building":
 * every resume, every keyword, every session's Q&A transcript goes in, and the
 * dossier makes each future session smarter while using fewer tokens (the model
 * reads the user's real project context instead of regenerating it).
 *
 * Layout in blob storage (per userHash — no identity in storage):
 *   dossier/{userHash}/profile.json        parsed resume: skills, projects, keywords
 *   dossier/{userHash}/sessions.jsonl      one line per session: id, date, field, qa[]
 *   dossier/{userHash}/index.json          { sessions: n, lastUpdated, fields: [] }
 *
 * Field knowledge (shared across users — specializations, not people):
 *   dossier/fields/{field}.json           { scenarios[], systemDesign[], loopRounds[], updatedAt }
 *
 * The dossier is append-only for sessions: history is never rewritten, only
 * added to. Profile is replaced when a new resume is parsed.
 */

const storage = () => import("./storage").then(m => m.blob)

export type DossierProfile = {
  skills: string[]
  projects: { name: string; role: string; impact: string; keywords: string[] }[]
  keywords: string[]
  updatedAt: number
}

export type DossierQA = { q: string; a: string }
export type DossierSession = {
  id: string
  at: number
  field: string
  qa: DossierQA[]
}

export type FieldKnowledge = {
  field: string
  scenarios: { title: string; context: string; whatWentRight: string; impact: string }[]
  systemDesign: { topic: string; keyPoints: string[] }[]
  loopRounds: { round: string; focus: string; sampleQuestions: string[] }[]
  updatedAt: number
}

const uKey = (userHash: string, name: string) => `dossier/${userHash}/${name}`
const fKey = (field: string) => `dossier/fields/${field.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`

/** The user's profile: skills, projects, keywords. Null when nothing parsed yet. */
export async function getDossierProfile(userHash: string): Promise<DossierProfile | null> {
  try {
    const raw = await (await storage()).getText(uKey(userHash, "profile.json"))
    return raw ? (JSON.parse(raw) as DossierProfile) : null
  } catch { return null }
}

/** Store/replace the parsed resume profile. */
export async function saveDossierProfile(userHash: string, profile: Omit<DossierProfile, "updatedAt">): Promise<void> {
  const sb = await storage()
  await sb.put(uKey(userHash, "profile.json"), JSON.stringify({ ...profile, updatedAt: Date.now() }))
  await touchIndex(userHash, { lastUpdated: Date.now() })
}

/** Append one session's Q&A to the dossier. Idempotent per session id. */
export async function appendDossierSession(userHash: string, session: Omit<DossierSession, "at"> & { at?: number }): Promise<boolean> {
  try {
    const sb = await storage()
    const key = uKey(userHash, "sessions.jsonl")
    const existing = (await sb.getText(key).catch(() => "")) || ""
    if (existing.includes(`"id":"${session.id}"`)) return false // already recorded
    const line = JSON.stringify({ ...session, at: session.at || Date.now() }) + "\n"
    // sessions.jsonl is append-only; storage has no append, so read-modify-write
    await sb.put(key, existing + line)
    await touchIndex(userHash, { lastUpdated: Date.now() })
    return true
  } catch { return false }
}

/** Recent sessions (newest first), capped for prompt-size sanity. */
export async function getDossierSessions(userHash: string, limit = 10): Promise<DossierSession[]> {
  try {
    const raw = (await (await storage()).getText(uKey(userHash, "sessions.jsonl")).catch(() => "")) || ""
    const all = raw.split("\n").filter(Boolean).map(l => { try { return JSON.parse(l) as DossierSession } catch { return null } }).filter(Boolean) as DossierSession[]
    return all.slice(-limit).reverse()
  } catch { return [] }
}

/** Field knowledge: the background-researched specialization bible. Null when unresearched. */
export async function getFieldKnowledge(field: string): Promise<FieldKnowledge | null> {
  try {
    const raw = await (await storage()).getText(fKey(field))
    return raw ? (JSON.parse(raw) as FieldKnowledge) : null
  } catch { return null }
}

/** Store background research for a specialization. */
export async function saveFieldKnowledge(k: Omit<FieldKnowledge, "updatedAt">): Promise<void> {
  await (await storage()).put(fKey(k.field), JSON.stringify({ ...k, updatedAt: Date.now() }))
}

/** Compact context for answer generation: profile + relevant field + recent Q&A.
 *  Token-efficient by design: only the slices the question needs. */
export async function dossierContext(userHash: string, field: string, maxSessions = 3): Promise<string> {
  const parts: string[] = []
  const [profile, fieldK, sessions] = await Promise.all([
    getDossierProfile(userHash),
    getFieldKnowledge(field),
    getDossierSessions(userHash, maxSessions),
  ])
  if (profile) {
    parts.push(`CANDIDATE PROFILE — skills: ${profile.skills.slice(0, 20).join(", ")}.`)
    for (const p of profile.projects.slice(0, 4)) {
      parts.push(`PROJECT "${p.name}" (${p.role}): ${p.impact} Keywords: ${p.keywords.slice(0, 8).join(", ")}.`)
    }
  }
  if (fieldK && fieldK.scenarios.length) {
    parts.push(`FIELD REALISM BANK (${fieldK.field}):`)
    for (const s of fieldK.scenarios.slice(0, 3)) {
      parts.push(`- ${s.title}: ${s.context} What went right: ${s.whatWentRight} Impact: ${s.impact}`)
    }
  }
  if (sessions.length) {
    parts.push(`PRIOR SESSIONS (how this person actually answered before):`)
    for (const sess of sessions) {
      for (const qa of sess.qa.slice(0, 4)) {
        parts.push(`Q: ${qa.q.slice(0, 200)}\nA: ${qa.a.slice(0, 400)}`)
      }
    }
  }
  return parts.join("\n")
}

async function touchIndex(userHash: string, patch: Record<string, unknown>): Promise<void> {
  try {
    const sb = await storage()
    const key = uKey(userHash, "index.json")
    const raw = (await sb.getText(key).catch(() => "")) || "{}"
    const idx = { ...JSON.parse(raw), ...patch }
    await sb.put(key, JSON.stringify(idx))
  } catch { /* index is best-effort */ }
}
