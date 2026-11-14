/**
 * Durable WhatsApp resume recovery. Initial-JD jobs retain the original JD and chosen source;
 * swipe-reply jobs retain the exact replied-to version, edit request and generated candidate.
 * Never log these records: they contain a candidate's JD, sender identity and resume references.
 */
import { blob } from "./storage"
import { createHash } from "crypto"
import { retryDelayMs } from "./whatsapp-retry-policy"

export type ResumeRefinementSnapshot = {
  /** Original Meta message id that carried the reply-to edit. */
  replyTo: string
  /** Exact user edit request; immutable after enqueue. */
  request: string
  /** Exact generated version the user replied to. */
  sourcePath: string
  sourceHash: string
  /** Durable private copy inside this sender's version directory. */
  sourceSnapshotPath: string
  /** Stable SHA-256 of sender + inbound Meta message id. */
  idempotencyKey: string
  genSnapshot: {
    meta?: unknown
    changes?: string[]
    source?: string
    saved?: string
    depth?: number
    held?: boolean
    createdAt?: number
  }
  generatedPath?: string
  generatedSha256?: string
  resultSnapshot?: unknown
  generationState?: "queued" | "generated" | "rejected" | "ready"
  rejectionCode?: string
}

export type ResumeRecoveryJob = {
  version: 1
  kind?: "jd" | "refine"
  refinement?: ResumeRefinementSnapshot
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
  status: "pending" | "sending" | "delivered" | "uncertain" | "blocked"
  processingAt?: number
  processingToken?: string
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

export async function enqueueResumeRefinement(input: {
  id: string
  from: string
  userId: string
  jd: string
  jdId: string
  resumePath: string
  resumeName?: string
  resumeFiled?: string
  refinement: ResumeRefinementSnapshot
}): Promise<ResumeRecoveryJob> {
  if (!/^[a-f0-9]{64}$/.test(input.id) ||
      input.refinement.idempotencyKey !== input.id ||
      !/^[a-f0-9]{64}$/.test(input.refinement.sourceHash) ||
      input.refinement.request.trim().length < 3 ||
      !input.refinement.replyTo || !input.refinement.sourceSnapshotPath ||
      input.resumePath !== input.refinement.sourceSnapshotPath) {
    throw new Error("invalid_refinement_recovery_input")
  }
  const now = Date.now()
  const fresh: ResumeRecoveryJob = {
    ...input, kind: "refine", version: 1, status: "pending",
    createdAt: now, updatedAt: now, attempts: 0, retryAt: now,
    refinement: { ...input.refinement, generationState: "queued" },
  }
  await blob.putIfAbsent(recoveryKey(input.id), JSON.stringify(fresh))
  const existing = await readResumeRecovery(input.id)
  if (!existing || existing.kind !== "refine" ||
      existing.from !== input.from || existing.userId !== input.userId ||
      existing.refinement?.idempotencyKey !== input.refinement.idempotencyKey ||
      existing.refinement?.replyTo !== input.refinement.replyTo ||
      existing.jd !== input.jd || existing.jdId !== input.jdId ||
      existing.resumePath !== input.resumePath ||
      existing.refinement?.request !== input.refinement.request ||
      existing.refinement?.sourcePath !== input.refinement.sourcePath ||
      existing.refinement?.sourceHash !== input.refinement.sourceHash ||
      existing.refinement?.sourceSnapshotPath !== input.refinement.sourceSnapshotPath ||
      JSON.stringify(existing.refinement?.genSnapshot || {}) !== JSON.stringify(input.refinement.genSnapshot || {})) {
    throw new Error("refinement_idempotency_conflict")
  }
  return existing
}

/** Update only mutable refinement diagnostics/result fields; source identity and request remain immutable. */
export async function patchResumeRefinement(
  id: string,
  refinementPatch: Partial<ResumeRefinementSnapshot>,
  jobPatch: Partial<ResumeRecoveryJob> = {},
): Promise<void> {
  const job = await readResumeRecovery(id)
  if (!job || job.kind !== "refine" || job.status === "delivered") return
  const {
    replyTo: _replyTo, request: _request, sourcePath: _sourcePath,
    sourceHash: _sourceHash, sourceSnapshotPath: _sourceSnapshotPath,
    idempotencyKey: _idempotencyKey, genSnapshot: _genSnapshot,
    ...mutableRefinement
  } = refinementPatch
  const {
    id: _id, jd: _jd, jdId: _jdId, from: _from, userId: _userId, kind: _kind,
    refinement: _refinement, resumePath: _resumePath, resumeName: _resumeName,
    resumeFiled: _resumeFiled, files: _files,
    ...mutableJob
  } = jobPatch
  await blob.put(recoveryKey(id), JSON.stringify({
    ...job,
    ...mutableJob,
    refinement: { ...(job.refinement || {}), ...mutableRefinement },
    updatedAt: Date.now(),
  }))
}

export async function dueResumeRefinements(limit = 1, now = Date.now()): Promise<ResumeRecoveryJob[]> {
  const keys = (await blob.list("whatsapp/resume-recovery")).filter(k => k.endsWith(".json"))
  const jobs = await Promise.all(keys.map(async key => {
    try {
      const raw = await blob.getText(key)
      return raw ? JSON.parse(raw) as ResumeRecoveryJob : null
    } catch { return null }
  }))
  return jobs.filter((job): job is ResumeRecoveryJob =>
    !!job && job.version === 1 && job.kind === "refine" &&
    job.status === "pending" && job.retryAt <= now && job.createdAt <= now &&
    !!job.refinement?.idempotencyKey,
  ).sort((a, b) => a.retryAt - b.retryAt).slice(0, limit)
}

/** A per-attempt immutable claim makes concurrent webhook/cron workers single-winner. */
export async function claimResumeRefinement(
  id: string,
  now = Date.now(),
  leaseMs = 330_000,
): Promise<ResumeRecoveryJob | null> {
  const job = await readResumeRecovery(id)
  if (!job || job.kind !== "refine" || job.status !== "pending" || job.retryAt > now) return null
  if (job.processingAt && now - job.processingAt < leaseMs) return null
  const attemptIndex = Math.max(0, Number(job.attempts) || 0)
  const token = createHash("sha256").update(id + ":" + now + ":" + Math.random()).digest("hex").slice(0, 24)
  const claimKey = "whatsapp/resume-refinement-claims/" + id + "/" + attemptIndex + ".json"
  const claim = JSON.stringify({ at: now, token })
  let won = await blob.putIfAbsent(claimKey, claim)
  let claimedAttempt = attemptIndex
  if (!won) {
    let previous: { at?: number } | null = null
    try { previous = JSON.parse((await blob.getText(claimKey)) || "null") } catch { previous = null }
    if (!previous?.at || now - previous.at < leaseMs) return null
    claimedAttempt = attemptIndex + 1
    const nextKey = "whatsapp/resume-refinement-claims/" + id + "/" + claimedAttempt + ".json"
    won = await blob.putIfAbsent(nextKey, claim)
    if (!won) return null
  }
  const attempts = claimedAttempt + 1
  await patchResumeRefinement(id, {}, { attempts, processingAt: now, processingToken: token })
  return { ...job, attempts, processingAt: now, processingToken: token }
}

export async function deferResumeRefinement(id: string, code: string, now = Date.now()): Promise<void> {
  const job = await readResumeRecovery(id)
  if (!job || job.kind !== "refine" ||
      job.status === "delivered" || job.status === "uncertain" ||
      job.status === "sending" || job.status === "blocked") return
  const attempts = Math.max(1, Number(job.attempts) || 1)
  await patchResumeRefinement(id, { rejectionCode: code }, {
    status: "pending",
    retryAt: now + retryDelayMs(attempts),
    errorCode: code,
    processingAt: 0,
    processingToken: "",
  })
}

export async function patchResumeRecovery(id: string, patch: Partial<ResumeRecoveryJob>): Promise<void> {
  const job = await readResumeRecovery(id)
  if (!job || job.status === "delivered") return
  // The immutable input is never overwritten by a stale retry.
  const { id: _id, jd: _jd, from: _from, userId: _uid, kind: _kind, refinement: _refinement, ...updates } = patch
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
    if (existing?.version === 1 && existing.kind !== "refine" && existing.from === from && existing.userId === userId && existing.jd === jd)
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
    !!j && j.version === 1 && j.kind !== "refine" && j.status === "pending" && j.retryAt <= now &&
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
  // Meta HTTP 200 means accepted by the API, not delivered to the handset.
  // Keep the job out of automatic resend while waiting for a signed callback.
  await patchResumeRecovery(id, { status: "uncertain", deliveredMessageId: wamid, deliveryState: "accepted", processingAt: 0, processingToken: "" })
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
        status: state === "failed" ? "pending" : (state === "delivered" || state === "read") ? "delivered" : "uncertain",
        deliveredMessageId: wamid,
        deliveryState: state, updatedAt: Date.now(),
        processingAt: 0, processingToken: "",
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
      processingAt: 0, processingToken: "", updatedAt: Date.now(),
    }))
    return
  }
  const rank = { accepted: 0, sent: 1, delivered: 2, read: 3, failed: -1 }
  if (rank[state] <= rank[job.deliveryState || "accepted"]) return
  await blob.put(recoveryKey(id), JSON.stringify({ ...job, deliveryState: state,
    // Only a signed delivered/read callback confirms handset receipt.
    // A signed sent callback still cannot justify a duplicate automatic send.
    status: state === "delivered" || state === "read" ? "delivered" : "uncertain",
    processingAt: 0, processingToken: "", updatedAt: Date.now() }))
  if (state === "delivered" || state === "read")
    console.info("[whatsapp] resume handset delivery confirmed", { job: id.slice(0, 12), state })
}
