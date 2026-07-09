import { readFile, writeFile, mkdir, readdir } from "fs/promises"
import path from "path"
import { randomBytes } from "crypto"
import { JOBS_DIR } from "@/lib/paths"

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

const file = (id: string) => path.join(JOBS_DIR, path.basename(id) + ".json")

export async function createJob(partial: Partial<Job>): Promise<Job> {
  const id = randomBytes(8).toString("hex")
  const now = Date.now()
  const job: Job = { id, status: "running", createdAt: now, updatedAt: now, ...partial }
  await mkdir(JOBS_DIR, { recursive: true })
  await writeFile(file(id), JSON.stringify(job))
  return job
}

export async function getJob(id: string): Promise<Job | null> {
  try { return JSON.parse(await readFile(file(id), "utf8")) as Job } catch { return null }
}

export async function updateJob(id: string, patch: Partial<Job>): Promise<void> {
  const cur = await getJob(id)
  if (!cur) return
  await writeFile(file(id), JSON.stringify({ ...cur, ...patch, updatedAt: Date.now() }))
}

// Most recent job (optionally scoped to a user) — used to recover the last result
// when the client lost its job id (e.g. localStorage cleared, different tab).
export async function latestJob(userId?: string): Promise<Job | null> {
  try {
    const files = await readdir(JOBS_DIR)
    let best: Job | null = null
    for (const f of files) {
      if (!f.endsWith(".json")) continue
      const j = await getJob(f.replace(/\.json$/, ""))
      if (!j) continue
      if (userId && j.userId && j.userId !== userId) continue
      if (!best || j.createdAt > best.createdAt) best = j
    }
    return best
  } catch { return null }
}
