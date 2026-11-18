/**
 * Durable WhatsApp resume recovery. The original JD and chosen source path survive
 * serverless timeouts and session consumption; no generated draft is delivered here.
 * Never log this record: it contains a candidate's JD and sender identity.
 *
 * Every state transition uses storage-version compare-and-swap. A Meta callback,
 * a late HTTP response and a retry worker must never replace a newer state snapshot.
 */
import { blob } from "./storage"
import { createHash, randomBytes } from "crypto"
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
  /** A per-run fencing token. Never log or expose it outside the signed Meta callback field. */
  claimToken?: string
  /** Six minutes exceeds this route's 300-second platform ceiling. */
  claimUntil?: number
  /** Retained after lease release so late signed callbacks can reconcile this exact send attempt. */
  attemptToken?: string
  /** The chat was already told this attempt did not send a file. Later quiet retries stay quiet. */
  toldUser?: boolean
}

const RECOVERY_CAS_ATTEMPTS = 8
const RECOVERY_CLAIM_MS = 6 * 60_000

export const recoveryKey = (id: string) => "whatsapp/resume-recovery/" + id + ".json"

type RecoveryDecision<T> = { result: T; next?: ResumeRecoveryJob }

async function updateResumeRecovery<T>(
  id: string,
  mutate: (job: ResumeRecoveryJob) => RecoveryDecision<T>,
): Promise<T | null> {
  const key = recoveryKey(id)
  for (let attempt = 0; attempt < RECOVERY_CAS_ATTEMPTS; attempt++) {
    const snapshot = await blob.getWithEtag(key)
    if (!snapshot) return null
    let job: ResumeRecoveryJob
    try { job = JSON.parse(snapshot.data.toString("utf8")) as ResumeRecoveryJob }
    catch { return null }
    if (job.version !== 1 || job.id !== id) return null
    const decision = mutate(job)
    if (!decision.next) return decision.result
    if (await blob.putIfMatch(key, snapshot.etag, JSON.stringify(decision.next))) return decision.result
    // Another writer won. Re-read and re-evaluate; never replay a stale snapshot.
  }
  throw new Error("WhatsApp resume recovery compare-and-swap retry limit reached")
}

export async function readResumeRecovery(id: string): Promise<ResumeRecoveryJob | null> {
  const raw = await blob.getText(recoveryKey(id))
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as ResumeRecoveryJob
    return parsed.version === 1 && parsed.id === id ? parsed : null
  } catch { return null }
}

export async function enqueueResumeRecovery(input: Omit<ResumeRecoveryJob,
  "version" | "status" | "createdAt" | "updatedAt" | "attempts" | "retryAt" | "claimToken" | "claimUntil" | "attemptToken"
>): Promise<ResumeRecoveryJob> {
  const now = Date.now()
  const fresh: ResumeRecoveryJob = { ...input, version: 1, status: "pending", createdAt: now, updatedAt: now, attempts: 0, retryAt: now }
  await blob.putIfAbsent(recoveryKey(input.id), JSON.stringify(fresh))
  return (await readResumeRecovery(input.id)) || fresh
}

/** Atomically lease one pending job. Expired leases can be replaced; old workers are fenced. */
export async function claimResumeRecoveryWorker(id: string): Promise<string | null> {
  const now = Date.now()
  return (await updateResumeRecovery(id, job => {
    if (job.status !== "pending") return { result: null }
    if (job.deliveryState === "accepted" || job.deliveryState === "sent" ||
        job.deliveryState === "delivered" || job.deliveryState === "read") return { result: null }
    if (job.claimToken && (job.claimUntil || 0) > now) return { result: null }
    const token = randomBytes(16).toString("hex")
    return { result: token, next: { ...job, claimToken: token, claimUntil: now + RECOVERY_CLAIM_MS, attemptToken: token, updatedAt: now } }
  })) || null
}

/** Release only the lease owned by this worker; a stale worker cannot clear a newer lease. */
export async function releaseResumeRecoveryWorker(id: string, token: string): Promise<boolean> {
  const now = Date.now()
  const result = await updateResumeRecovery(id, job => {
    if (!token || job.claimToken !== token) return { result: false }
    const next = { ...job, updatedAt: now }
    delete next.claimToken
    delete next.claimUntil
    return { result: true, next }
  })
  return result ?? false
}

export async function patchResumeRecovery(id: string, patch: Partial<ResumeRecoveryJob>, claimToken?: string): Promise<boolean> {
  const {
    id: _id, version: _version, createdAt: _createdAt, jd: _jd, from: _from, userId: _userId,
    claimToken: _claimToken, claimUntil: _claimUntil, attemptToken: _attemptToken, ...updates
  } = patch
  const now = Date.now()
  const result = await updateResumeRecovery(id, job => {
    if (job.status === "delivered" || job.deliveryState === "delivered" || job.deliveryState === "read")
      return { result: false }
    if (claimToken) {
      if (job.claimToken !== claimToken || (job.claimUntil || 0) <= now) return { result: false }
    } else if (job.claimToken && (job.claimUntil || 0) > now) {
      return { result: false }
    }
    // Delivered/read are already rejected by the terminal guard above.
    // Accepted/sent remain non-retryable so an ambiguous send is not duplicated.
    if (updates.status === "pending" &&
        (job.deliveryState === "accepted" || job.deliveryState === "sent")) return { result: false }
    if (updates.status === "sending" && job.status !== "pending" && job.status !== "sending")
      return { result: false }
    return { result: true, next: { ...job, ...updates, updatedAt: now } as ResumeRecoveryJob }
  })
  return result ?? false
}

export async function deferResumeRecovery(
  id: string,
  code: string,
  candidate?: { token: string; coverage: number; supportedCoverage: number },
  claimToken?: string,
): Promise<boolean> {
  const now = Date.now()
  const result = await updateResumeRecovery(id, job => {
    if (job.status === "delivered" || job.status === "uncertain" || job.status === "sending")
      return { result: false }
    if (claimToken) {
      if (job.claimToken !== claimToken || (job.claimUntil || 0) <= now) return { result: false }
    } else if (job.claimToken && (job.claimUntil || 0) > now) {
      return { result: false }
    }
    if (job.deliveryState === "accepted" || job.deliveryState === "sent" ||
        job.deliveryState === "delivered" || job.deliveryState === "read") return { result: false }
    const attempts = job.attempts + 1
    const best = candidate && (!job.best || candidate.supportedCoverage > job.best.supportedCoverage ||
      (candidate.supportedCoverage === job.best.supportedCoverage && candidate.coverage > job.best.coverage))
      ? candidate : job.best
    return { result: true, next: { ...job, status: "pending", attempts, retryAt: now + retryDelayMs(attempts), errorCode: code, best, updatedAt: now } }
  })
  return result ?? false
}

/** Legacy bootstrap must not create a second job for a JD already queued, sending,
 * accepted by Meta, or handset-delivered. Compare actual persisted input rather
 * than a mutable session timestamp. Fail closed if listing fails. */
export async function hasResumeRecoveryForJD(from: string, userId: string, jd: string): Promise<boolean> {
  const keys = (await blob.list("whatsapp/resume-recovery")).filter(k => k.endsWith(".json"))
  for (const key of keys) {
    let existing: ResumeRecoveryJob | null = null
    try {
      const raw = await blob.getText(key)
      existing = raw ? JSON.parse(raw) as ResumeRecoveryJob : null
    } catch { continue }
    if (existing?.version === 1 && existing.from === from && existing.userId === userId && existing.jd === jd)
      return true
  }
  return false
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
    j.createdAt <= now && (!j.claimToken || (j.claimUntil || 0) <= now))
    .sort((a, b) => a.retryAt - b.retryAt).slice(0, limit)
}

const messageIndexKey = (wamid: string) =>
  "whatsapp/resume-message-index/" + createHash("sha256").update(wamid).digest("hex") + ".txt"

async function ensureMessageIndex(wamid: string, id: string): Promise<boolean> {
  const key = messageIndexKey(wamid)
  const existing = await blob.getText(key)
  if (existing !== null) return existing === id
  if (await blob.putIfAbsent(key, id)) return true
  return (await blob.getText(key)) === id
}

export async function markResumeDocumentAccepted(id: string, wamid: string, attemptToken?: string): Promise<boolean> {
  if (!wamid || !(await readResumeRecovery(id))) return false
  if (!await ensureMessageIndex(wamid, id)) return false
  const now = Date.now()
  const result = await updateResumeRecovery(id, job => {
    if (attemptToken) {
      if (job.claimToken !== attemptToken || job.attemptToken !== attemptToken || (job.claimUntil || 0) <= now) return { result: false }
    } else if (job.claimToken && (job.claimUntil || 0) > now) {
      return { result: false }
    }
    if (job.deliveryState === "failed" && job.deliveredMessageId === wamid) return { result: false }
    if (job.deliveryState === "sent" && job.deliveredMessageId === wamid) return { result: true }
    if (job.deliveryState === "delivered" || job.deliveryState === "read")
      return { result: job.deliveredMessageId === wamid }
    if (job.status === "delivered") return { result: job.deliveredMessageId === wamid }
    if (job.deliveredMessageId && job.deliveredMessageId !== wamid &&
        (job.deliveryState === "accepted" || job.deliveryState === "sent")) return { result: false }
    return { result: true, next: { ...job, status: "uncertain", deliveredMessageId: wamid, deliveryState: "accepted", updatedAt: now } }
  })
  return result ?? false
}

/** Authenticated Meta callbacks distinguish API acceptance from real handset delivery. */
export async function recordResumeDeliveryStatus(
  wamid: string,
  state: "sent" | "delivered" | "read" | "failed",
  opaqueJobId?: string,
): Promise<void> {
  if (!wamid) return
  const opaqueMatch = /^([a-f0-9]{64})(?::([a-f0-9]{32}))?$/.exec(String(opaqueJobId || ""))
  const opaqueId = opaqueMatch?.[1]
  const attemptToken = opaqueMatch?.[2]
  const indexKey = messageIndexKey(wamid)
  let id = await blob.getText(indexKey)
  if (id && opaqueId && id !== opaqueId) return
  if (!id && opaqueId) {
    const created = await blob.putIfAbsent(indexKey, opaqueId)
    id = created ? opaqueId : await blob.getText(indexKey)
    if (id !== opaqueId) return
  }
  if (!id) return

  const now = Date.now()
  const updated = await updateResumeRecovery(id, job => {
    const currentMessage = job.deliveredMessageId === wamid
    const currentAttempt = !!attemptToken && job.attemptToken === attemptToken && (job.status === "sending" || job.status === "uncertain")
    const legacyInFlight = !attemptToken && !job.deliveredMessageId &&
      (job.status === "uncertain" || job.status === "sending")
    if (!currentMessage && !currentAttempt && !legacyInFlight) return { result: false }

    if (state === "failed") {
      if (job.deliveryState === "delivered" || job.deliveryState === "read") return { result: false }
      if (job.deliveryState === "failed" && currentMessage) return { result: false }
      const attempts = job.attempts + 1
      return {
        result: true,
        next: { ...job, status: "pending", deliveredMessageId: wamid, deliveryState: "failed",
          attempts, retryAt: now + retryDelayMs(attempts), errorCode: "meta_delivery_failed", updatedAt: now },
      }
    }

    const rank = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: -1 }
    const currentState = currentMessage ? (job.deliveryState || "accepted") : "accepted"
    if (rank[state] <= rank[currentState]) return { result: false }
    return {
      result: true,
      next: { ...job, deliveredMessageId: wamid, deliveryState: state,
        status: state === "delivered" || state === "read" ? "delivered" : "uncertain", updatedAt: now },
    }
  })
  if (updated && (state === "delivered" || state === "read"))
    console.info("[whatsapp] resume handset delivery confirmed", { job: id.slice(0, 12), state })
}
