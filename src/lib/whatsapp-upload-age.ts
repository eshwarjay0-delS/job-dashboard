// 30 Oct 2026: a .docx sent earlier in WhatsApp and never used stayed paired with the next job post (no age check),
// so a Salesforce Security post ran against an unrelated resume and came back at 0%. A pending upload is now used
// only while it is fresh (default 30 minutes; the same-message "resume with the job post" case is seconds old).
// WHATSAPP_UPLOAD_MAX_AGE = minutes; 0/off turns the check off (old behaviour). Import-free for the tests' vm loader.
export const DEFAULT_UPLOAD_MAX_AGE_MIN = 30

export function uploadMaxAgeMin(env: Record<string, string | undefined> | undefined = globalThis.process?.env): number {
  const raw = String(env?.WHATSAPP_UPLOAD_MAX_AGE ?? "").trim().toLowerCase()
  if (raw === "0" || raw === "false" || raw === "off" || raw === "no") return 0
  const n = Number(raw)
  return raw && Number.isFinite(n) && n > 0 ? n : DEFAULT_UPLOAD_MAX_AGE_MIN
}

/** True when a pending upload is too old to pair with this job post. An upload with no recorded time keeps the old behaviour. */
export function uploadStale(resumeAt: number | undefined, now = Date.now(), env?: Record<string, string | undefined>): boolean {
  const max = uploadMaxAgeMin(env ?? globalThis.process?.env)
  if (!max || !resumeAt || !Number.isFinite(resumeAt)) return false
  return now - resumeAt > max * 60_000
}
