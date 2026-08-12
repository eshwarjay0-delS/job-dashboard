import { randomBytes } from "crypto"
import { blob } from "@/lib/storage"

export type JobStatus = "running" | "done" | "error"
export interface Job {
  id: string
  status: JobStatus
  createdAt: number
  updatedAt: number
  userId?: string
  jd?: string
  filepath?: string
  resumeName?: string
  result?: unknown
  error?: string
}

// Storage key for a job record. basename guards against a caller passing a path.
const key = (id: string) => `jobs/${id.replace(/[^a-zA-Z0-9_-]/g, "")}.json`

export async function createJob(partial: Partial<Job>): Promise<Job> {
  const id = randomBytes(8).toString("hex")
  const now = Date.now()
  const job: Job = { id, status: "running", createdAt: now, updatedAt: now, ...partial }
  await blob.put(key(id), JSON.stringify(job))
  return job
}

export async function getJob(id: string): Promise<Job | null> {
  const raw = await blob.getText(key(id))
  if (!raw) return null
  try { return JSON.parse(raw) as Job } catch { return null }
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<void> {
  const cur = await getJob(id)
  if (!cur) return
  await blob.put(key(id), JSON.stringify({ ...cur, ...patch, updatedAt: Date.now() }))
}

// Most recent job (optionally scoped to a user) — used to recover the last result
// when the client lost its job id (e.g. localStorage cleared, different tab).
export async function latestJob(userId?: string): Promise<Job | null> {
  const keys = await blob.list("jobs")
  let best: Job | null = null
  for (const k of keys) {
    if (!k.endsWith(".json")) continue
    const id = k.slice("jobs/".length).replace(/\.json$/, "")
    const j = await getJob(id)
    if (!j) continue
    if (userId && j.userId && j.userId !== userId) continue
    if (!best || j.createdAt > best.createdAt) best = j
  }
  return best
}
