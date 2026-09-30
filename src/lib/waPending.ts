/**
 * WhatsApp bot state that has to hold up under concurrent webhook calls.
 *
 * A JD and a resume forwarded together reach the webhook as two near-simultaneous calls. The old
 * single session document was read-modify-write, so those calls could overwrite each other's half
 * (then neither generated), and a half left behind by a failed run made BOTH calls generate. Here
 * each half is its own object, and a pair is handed out under a short claim so exactly one call
 * generates from it.
 */
import { createHash } from "crypto"
import { blob } from "@/lib/storage"

export type PendingJd = { text: string; msgId: string; at: number }
export type PendingResume = { path: string; name: string; msgId: string; at: number }
export type Job = { jd: string; resumePath: string; resumeName: string }

// A half waits this long for its other half. Past that it's an abandoned send, and pairing it with
// a new message would tailor the wrong resume (or the wrong JD).
const PAIR_TTL_MS = Number(process.env.WHATSAPP_PAIR_TTL_MS) || 60 * 60 * 1000
// A claim older than this belongs to a call that died mid-handshake and is ignored.
const CLAIM_STALE_MS = 15000

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))
const hash = (s: string) => createHash("sha1").update(s).digest("hex").slice(0, 24)
const dir = (sender: string) => `whatsapp/pending/${sender}`
const keys = {
  jd: (s: string) => `${dir(s)}/jd.json`,
  resume: (s: string) => `${dir(s)}/resume.json`,
  claim: (s: string) => `${dir(s)}/claim.json`,
  lastJob: (s: string) => `${dir(s)}/last-job.json`,
  seen: (s: string, msgId: string) => `whatsapp/seen/${s}/${hash(msgId)}`,
  // The pre-2026-09-16 single session document; only ever deleted now.
  legacySession: (s: string) => `whatsapp/session-${s}.json`,
}

async function read<T>(key: string): Promise<T | null> {
  try {
    const raw = await blob.getText(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch { return null }
}
const live = <T extends { at: number }>(v: T | null): T | null => (v && Date.now() - v.at < PAIR_TTL_MS ? v : null)

/** True the first time a message id is seen, false for a re-delivery of the same message. */
export async function firstSighting(sender: string, msgId: string): Promise<boolean> {
  const key = keys.seen(sender, msgId)
  if (await blob.exists(key)) return false
  await blob.put(key, String(Date.now()))
  return true
}

export const getJd = async (sender: string) => live(await read<PendingJd>(keys.jd(sender)))
export const getResume = async (sender: string) => live(await read<PendingResume>(keys.resume(sender)))
export const putJd = (sender: string, v: PendingJd) => blob.put(keys.jd(sender), JSON.stringify(v))
export const putResume = (sender: string, v: PendingResume) => blob.put(keys.resume(sender), JSON.stringify(v))

export async function clearPending(sender: string): Promise<void> {
  await Promise.all([
    blob.delete(keys.jd(sender)),
    blob.delete(keys.resume(sender)),
    blob.delete(keys.claim(sender)),
    blob.delete(keys.legacySession(sender)),
  ])
}

// The pair of the last FAILED tailor, kept for the "retry" command instead of being left pending.
export const getLastJob = (sender: string) => read<Job & { at: number }>(keys.lastJob(sender))
export const putLastJob = (sender: string, job: Job) => blob.put(keys.lastJob(sender), JSON.stringify({ ...job, at: Date.now() }))
export const clearLastJob = (sender: string) => blob.delete(keys.lastJob(sender))

/**
 * Takes the pending JD + resume if both are there. Among concurrent callers exactly one gets the
 * Job, and both halves are deleted as it is handed out; everyone else gets null.
 *
 * Claim handshake (R2 reads are strongly consistent and the last write wins): wait out a live claim
 * held by someone else, write ours, wait `settleMs` so a racing writer's claim lands, and read it
 * back. Only the caller whose claim survived takes the halves, and it releases the claim when done.
 */
export async function takePair(sender: string, me: string, settleMs = 1200): Promise<Job | null> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const [jd, resume] = await Promise.all([getJd(sender), getResume(sender)])
    if (!jd || !resume) return null
    const held = await read<{ owner: string; at: number }>(keys.claim(sender))
    if (held && held.owner !== me && Date.now() - held.at < CLAIM_STALE_MS) {
      await sleep(settleMs)
      continue
    }
    await blob.put(keys.claim(sender), JSON.stringify({ owner: me, at: Date.now() }))
    await sleep(settleMs)
    const back = await read<{ owner: string }>(keys.claim(sender))
    if (back?.owner !== me) continue
    try {
      // Re-read under the claim: another caller may have taken the pair meanwhile.
      const [j, r] = await Promise.all([getJd(sender), getResume(sender)])
      if (!j || !r) return null
      await Promise.all([blob.delete(keys.jd(sender)), blob.delete(keys.resume(sender))])
      return { jd: j.text, resumePath: r.path, resumeName: r.name }
    } finally {
      await blob.delete(keys.claim(sender))
    }
  }
  return null
}
