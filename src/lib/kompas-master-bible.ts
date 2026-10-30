/**
 * Master Bible + immutable session mini-dossiers.
 * A mini is an exact, attributable session Q&A record; NOT evidence that a
 * generated answer describes candidate experience. The master is a versioned,
 * compact searchable projection; source mini files remain unchanged.
 */
import { createHash } from "node:crypto"
import { blob, type Blob } from "./storage"
import {
  buildFastDossierIndex, extendFastDossierIndex, queryFastDossier,
  formatFastDossierContext, type FastDossierIndex,
} from "./kompas-fast-dossier"
import type { DossierSource } from "./kompas-dossier-bots"

const sha = (s: string) => createHash("sha256").update(s).digest("hex")
const digestOK = (s: string) => /^[a-f0-9]{64}$/.test(s)
const version = "kompas-master-bible-v1"
const metaKey = (owner: string) => "dossier/" + owner + "/master/head.json"
const revKey = (owner: string, rev: number) =>
  "dossier/" + owner + "/master/revisions/" + String(rev).padStart(10, "0") + ".json"
const miniKey = (owner: string, session: string) =>
  "dossier/" + owner + "/mini/" + sha(session) + ".json"
export type SessionMini = {
  version: typeof version
  sessionId: string
  field: string
  at: string
  digest: string
  qa: { q: string; a: string }[]
}
export type MasterBible = {
  version: typeof version
  revision: number
  sessionCount: number
  latestSession: string
  sourceDigest: string
  index: FastDossierIndex
}
const warm = new Map<string, { at: number; value: MasterBible }>()
function putWarm(owner: string, value: MasterBible) {
  warm.delete(owner)
  warm.set(owner, { at: Date.now(), value })
  while (warm.size > 4) warm.delete(warm.keys().next().value!)
}

type MiniStore = Pick<Blob, "getText"|"put"|"putIfAbsent">
export function masterBibleStore(storage: MiniStore = blob) {
  async function readRevision(owner: string, n: number): Promise<MasterBible | null> {
    const raw = await storage.getText(revKey(owner, n))
    if (!raw) return null
    const value = JSON.parse(raw) as MasterBible
    if (value.version !== version || value.revision !== n) throw new Error("Invalid Bible revision")
    return value
  }
  async function readLatest(owner: string, forWrite = false): Promise<MasterBible | null> {
    if (!digestOK(owner)) throw new Error("Invalid owner")
    const cached = warm.get(owner)
    if (!forWrite && cached && Date.now() - cached.at < 8_000) return cached.value
    const raw = await storage.getText(metaKey(owner))
    const head = raw ? JSON.parse(raw) as { revision?: number } : null
    let n = Number.isSafeInteger(head?.revision) && (head?.revision ?? -1) >= 0 ? head!.revision! : -1
    // A concurrent writer might have updated the immutable revision before its
    // pointer. Writers walk forward to avoid losing committed sessions.
    if (forWrite) {
      while (n < 1000000 && await storage.getText(revKey(owner, n + 1)) !== null) n++
    }
    if (n < 0) return null
    const result = await readRevision(owner, n)
    if (result) putWarm(owner, result)
    return result
  }
  async function saveSession(owner: string, id: string, field: string, qa: { q: string; a: string }[]) {
    if (!digestOK(owner) || !/^[A-Za-z0-9_.:-]{1,80}$/.test(id))
      throw new Error("Invalid owner or session ID")
    if (!Array.isArray(qa) || qa.length < 1 || qa.length > 200 ||
      qa.some(row => !row || typeof row.q !== "string" || typeof row.a !== "string" || !row.q.trim() || !row.a.trim()))
      throw new Error("No usable session Q&A")
    const clean = qa.map(({ q, a }) => ({ q: q.slice(0, 8000), a: a.slice(0, 16000) }))
    const contentHash = sha(JSON.stringify({ id, field, qa: clean }))
    const mini: SessionMini = { version, sessionId: id, field: field.slice(0, 80),
      at: new Date().toISOString(), digest: contentHash, qa: clean }
    const created = await storage.putIfAbsent(miniKey(owner, id), JSON.stringify(mini))
    if (!created) {
      const previous = await storage.getText(miniKey(owner, id))
      if (!previous || (JSON.parse(previous) as SessionMini).digest !== mini.digest)
        throw new Error("Session already exists with different Q&A; preserve both versions explicitly")
    }
    // A stored mini may have failed at the subsequent master projection step.
    // Retry remains safe because master has an immutable idempotency history.
    const text = clean.map((pair, i) =>
      "Session " + id + " turn " + (i + 1) + "\nInterviewer: " + pair.q + "\nPrior answer (not proof of candidate work): " + pair.a
    ).join("\n\n")
    const source: DossierSource = { id: "session-" + sha(id).slice(0, 24),
      kind: "interview_transcript", title: "Session " + id + " (" + field + ")",
      text, digest: sha(text) }
    const delta = buildFastDossierIndex([source], sha(contentHash), "", "")
    for (let retry = 0; retry < 30; retry++) {
      const current = await readLatest(owner, true)
      if (current?.latestSession === id) return { added: false, revision: current.revision }
      // Historical idempotency check: past revisions each keep the id of the
      // committed mini. O(session count) only at session close, never on a turn.
      for (let rev = current?.revision ?? -1; rev >= 0; rev--) {
        const history = rev === current?.revision ? current : await readRevision(owner, rev)
        if (history?.latestSession === id) return { added: false, revision: current!.revision }
      }
      const n = (current?.revision ?? -1) + 1
      const merged = extendFastDossierIndex(current?.index ?? null, delta, 800)
      const value: MasterBible = {
        version, revision: n, sessionCount: (current?.sessionCount || 0) + 1,
        latestSession: id, sourceDigest: sha((current?.sourceDigest || "") + contentHash),
        index: merged,
      }
      if (!await storage.putIfAbsent(revKey(owner, n), JSON.stringify(value))) continue
      // The pointer is a best-effort fast location; revision files are durable.
      await storage.put(metaKey(owner), JSON.stringify({ revision: n, sourceDigest: value.sourceDigest }))
      putWarm(owner, value)
      return { added: true, revision: n }
    }
    throw new Error("Bible update contention; mini saved for retry")
  }
  async function context(owner: string, question: string, opts: {
    firstPerson?: boolean; followUp?: string; maxChars?: number
  } = {}): Promise<string> {
    const bible = await readLatest(owner)
    if (!bible) return ""
    const hits = queryFastDossier(bible.index, question, {
      firstPerson: false, followUp: opts.followUp, limit: 5, maxChars: opts.maxChars ?? 2600,
    })
    return formatFastDossierContext(hits)
  }
  return { readLatest, saveSession, context }
}
export const saveSessionMiniDossier = (owner: string, id: string, field: string, qa: {q:string;a:string}[]) =>
  masterBibleStore().saveSession(owner, id, field, qa)
export const masterBibleContext = (owner: string, question: string, opts?: {
  firstPerson?: boolean; followUp?: string; maxChars?: number
}) => masterBibleStore().context(owner, question, opts)
