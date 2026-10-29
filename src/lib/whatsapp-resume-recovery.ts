/**
 * Durable WhatsApp resume recovery. The original JD and chosen source path survive
 * serverless timeouts and session consumption; no generated draft is delivered here.
 * Never log this record: it contains a candidate's JD and sender identity.
 */
import { blob } from "./storage"
import { createHash } from "crypto"
import { retryDelayMs } from "./whatsapp-retry-policy"

export type ResumeRecoveryJob = {
  version: 1
  id: string
  from: string
  userId: string
  jd: string
  jdId: string
  resumePath: string
  resumeName?: string
  resumeFiled?: string
  files?: {
    userDir: string; email: string; said: string; depth: number
    rel: string; abs: string; redo?: boolean
  }
  status: "pending" | "sending" | "delivered" | "uncertain"
  createdAt: number
  updatedAt: number
  attempts: number
  retryAt: number
  best?: { token: string; coverage: number; supportedCoverage: number }
  deliveredMessageId?: string
  deliveryState?: "accepted" | "sent" | "delivered" | "read" | "failed"
  errorCode?: string
  /** The chat was already told this attempt did not send a file. Later quiet retries stay quiet. */
  toldUser?: boolean
}

export const recoveryKey = (id: string) => `whatsapp/resume-recovery/${id}.json`

export async function readResumeRecovery(id: string): Promise<ResumeRecoveryJob | null> {
  const raw = await blob.getText(recoveryKey(id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ResumeRecoveryJob
    return parsed.version === 1 && parsed.id === id ? parsed : null
  } catch { return null }
}

export async function enqueueResumeRecovery(input: Omit<ResumeRecoveryJob, "version" | "status" | "createdAt" | "updatedAt" | "attempts" | "retryAt">): Promise<ResumeRecoveryJob> {
  const now = Date.now()
  const fresh: ResumeRecoveryJob = { ...input, version: 1, status: "pending", createdAt: now, updatedAt: now, attempts: 0, retryAt: now }
  await blob.putIfAbsent(recoveryKey(input.id), JSON.stringify(fresh))
  return (await readResumeRecovery(input.id)) || fresh
}

export async function patchResumeRecovery(id: string, patch: Partial<ResumeRecoveryJob>): Promise<void> {
  const job = await readResumeRecovery(id)
  if (!job || job.status === "delivered") return
  // The immutable input is never overwritten by a stale retry.
  const { id: _id, jd: _jd, from: _from, userId: _uid, ...updates } = patch
  await blob.put(recoveryKey(id), JSON.stringify({ ...job, ...updates, updatedAt: Date.now() }))
}

export async function deferResumeRecovery(id: string, code: string, candidate?: { token: string; coverage: number; supportedCoverage: number }): Promise<void> {
  const job = await readResumeRecovery(id)
  if (!job || job.status === "delivered" || job.status === "uncertain" || job.status === "sending") return
  const attempts = job.attempts + 1
  const best = candidate && (!job.best || candidate.supportedCoverage > job.best.supportedCoverage ||
    (candidate.supportedCoverage === job.best.supportedCoverage && candidate.coverage > job.best.coverage))
    ? candidate : job.best
  await patchResumeRecovery(id, { status: "pending", attempts, retryAt: Date.now() + retryDelayMs(attempts), errorCode: code, best })
}

export async function dueResumeRecoveries(limit = 1): Promise<ResumeRecoveryJob[]> {
  const keys = (await blob.list("whatsapp/resume-recovery")).filter(k => k.endsWith(".json"))
  const now = Date.now()
  const jobs = await Promise.all(keys.map(async key => {
    try {
      const raw = await blob.getText(key)
      return raw ? JSON.parse(raw) as ResumeRecoveryJob : null
    } catch { return null }
  }))
  return jobs.filter((j): j is ResumeRecoveryJob =>
    !!j && j.version === 1 && j.status === "pending" && j.retryAt <= now &&
    j.createdAt <= now)
    .sort((a, b) => a.retryAt - b.retryAt).slice(0, limit)
}

/** Index by a one-way hash of Meta's message id; never scan every user's jobs on callbacks. */
const messageIndexKey = (wamid: string) =>
  `whatsapp/resume-message-index/${createHash("sha256").update(wamid).digest("hex")}.txt`

export async function markResumeDocumentAccepted(id: string, wamid: string): Promise<boolean> {
  await blob.put(messageIndexKey(wamid), id)
  const current = await readResumeRecovery(id)
  if (!current) return false
  // A signed failure callback can beat the original HTTP response. Keep the
  // failed message id as a tombstone so a late HTTP 200 cannot resurrect it.
  if (current.deliveryState === "failed" && current.deliveredMessageId === wamid) return false
  if (current.status === "delivered" && current.deliveredMessageId && current.deliveredMessageId !== wamid) return false
  await patchResumeRecovery(id, { status: "delivered", deliveredMessageId: wamid, deliveryState: "accepted" })
  return true
}

/** Authenticated Meta callbacks distinguish an API acceptance from real handset delivery. */
export async function recordResumeDeliveryStatus(wamid: string, state: "sent" | "delivered" | "read" | "failed", opaqueJobId?: string): Promise<void> {
  if (!wamid) return
  let id = await blob.getText(messageIndexKey(wamid))
  // Meta echoes the opaque job id even if the original HTTP response timed out.
  // Reconcile that ambiguous send instead of leaving it stuck or duplicating it.
  if (!id && opaqueJobId && /^[a-f0-9]{64}$/.test(opaqueJobId)) {
    const unknown = await readResumeRecovery(opaqueJobId)
    if (unknown && !unknown.deliveredMessageId && (unknown.status === "uncertain" || unknown.status === "sending")) {
      id = opaqueJobId
      await blob.put(messageIndexKey(wamid), id)
      await blob.put(recoveryKey(id), JSON.stringify({ ...unknown,
        status: state === "failed" ? "pending" : "delivered",
        deliveredMessageId: wamid,
        deliveryState: state, updatedAt: Date.now(),
        ...(state === "failed" ? { attempts: unknown.attempts + 1, retryAt: Date.now() + retryDelayMs(unknown.attempts + 1), errorCode: "meta_delivery_failed" } : {}),
      }))
      if (state === "delivered" || state === "read")
        console.info("[whatsapp] timed-out document reconciled as delivered", { job: id.slice(0, 12), state })
      return
    }
  }
  if (!id) return
  const job = await readResumeRecovery(id)
  if (!job || job.deliveredMessageId !== wamid) return
  if (state === "failed") {
    if (job.deliveryState === "delivered" || job.deliveryState === "read") return
    const attempts = job.attempts + 1
    await blob.put(recoveryKey(id), JSON.stringify({
      ...job, status: "pending", deliveryState: "failed", deliveredMessageId: wamid,
      attempts, retryAt: Date.now() + retryDelayMs(attempts), errorCode: "meta_delivery_failed",
      updatedAt: Date.now(),
    }))
    return
  }
  const rank = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: -1 }
  if (rank[state] <= rank[job.deliveryState || "accepted"]) return
  await blob.put(recoveryKey(id), JSON.stringify({ ...job, deliveryState: state,
    status: job.status === "pending" && job.deliveryState === "failed" ? "delivered" : job.status,
    updatedAt: Date.now() }))
  if (state === "delivered" || state === "read")
    console.info("[whatsapp] resume handset delivery confirmed", { job: id.slice(0, 12), state })
}
