import { createHash } from "node:crypto"
import { blob } from "./storage"
import { type DossierSource } from "./kompas-dossier-bots"
import { buildFastDossierIndex, type FastDossierIndex, FAST_DOSSIER_VERSION } from "./kompas-fast-dossier"

const fp = (v: string) => createHash("sha256").update(v).digest("hex")
const isDigest = (v: string) => /^[a-f0-9]{64}$/.test(v)
const key = (ownerHash: string, digest: string, name: string) =>
  "dossier/" + ownerHash + "/fast/" + digest + "/" + name
const CACHE_LIMIT = 4
const CACHE_TTL_MS = 15 * 60_000
const warm = new Map<string, { at: number; value: FastDossierIndex }>()

function touch(id: string, value: FastDossierIndex) {
  warm.delete(id)
  warm.set(id, { at: Date.now(), value })
  if (warm.size > CACHE_LIMIT) warm.delete(warm.keys().next().value!)
}

export type SavedDossier = {
  version: string
  sourceDigest: string
  stages: { notebook?: string; dossier?: string; unified?: string }
  sourceManifest: { id: string; kind: string; title: string; digest: string }[]
  createdAt: string
}

/** Persist only for the authenticated owner. Never key by a user-supplied path. */
export async function savePreparedDossier(
  ownerHash: string, sourceDigest: string, sources: DossierSource[], stages: SavedDossier["stages"],
): Promise<void> {
  if (!isDigest(ownerHash) || !isDigest(sourceDigest)) throw new Error("Invalid owner or dossier identity.")
  const resumeText = sources.filter(s => s.kind === "resume").map(s => s.text).join("\n")
  const jdText = sources.filter(s => s.kind === "job_description").map(s => s.text).join("\n")
  const idx = buildFastDossierIndex(sources, sourceDigest, fp(resumeText), fp(jdText))
  const document: SavedDossier = {
    version: FAST_DOSSIER_VERSION, sourceDigest, stages,
    sourceManifest: sources.map(({ id, kind, title, digest }) => ({ id, kind, title, digest })),
    createdAt: idx.createdAt,
  }
  // Save first. Do not call a cache insertion durable persistence.
  await blob.put(key(ownerHash, sourceDigest, "index.json"), JSON.stringify(idx))
  await blob.put(key(ownerHash, sourceDigest, "manuscript.json"), JSON.stringify(document))
  touch(ownerHash + ":" + sourceDigest, idx)
}

export async function readPreparedDossier(ownerHash: string, digest: string): Promise<SavedDossier | null> {
  if (!isDigest(ownerHash) || !isDigest(digest)) return null
  const raw = await blob.getText(key(ownerHash, digest, "manuscript.json"))
  if (!raw) return null
  const p = JSON.parse(raw) as SavedDossier
  return p?.sourceDigest === digest && p.version === FAST_DOSSIER_VERSION ? p : null
}

/** The hot path reads at most one indexed object, never the full manuscript. */
export async function loadFastDossier(
  ownerHash: string, digest: string, resume: string, jd: string,
): Promise<FastDossierIndex | null> {
  if (!isDigest(ownerHash) || !isDigest(digest)) return null
  const id = ownerHash + ":" + digest
  const cached = warm.get(id)
  let idx: FastDossierIndex | null = null
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) idx = cached.value
  else {
    const raw = await blob.getText(key(ownerHash, digest, "index.json"))
    if (!raw) return null
    idx = JSON.parse(raw) as FastDossierIndex
    if (idx?.version !== FAST_DOSSIER_VERSION || idx.sourceDigest !== digest) return null
    touch(id, idx)
  }
  // Defend against stale or mismatched resume/JD, even within one account.
  if (resume && idx.resumeFingerprint !== fp(resume)) return null
  if (jd && idx.jobFingerprint !== fp(jd)) return null
  if (!resume || !jd) return null // don't infer personal context without the active pair
  return idx
}
