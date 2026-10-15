/**
 * Gel points — the Compass business model's currency.
 *
 * Why (2026-10-11): the owner wants one number that answers "can I afford my
 * next interview": 1 point = 1 interview session, 1 resume preparation = 0.25
 * points (four resumes cost one session). The Kompas header shows "X interviews
 * left · Y resumes left" so he can top up before he's caught short.
 *
 * Balances live in blob storage, keyed by the same one-way user hash the STT
 * ledger uses — points per user, no identity in storage.
 *
 *   credits/balance/<userHash>.json     { points, updatedAt }
 *   credits/deductions/<day>/<ts>-<rand>.json   { userHash, points, for, ref, at }
 *
 * Deductions happen once per thing: a session deducts on its first STT chunk,
 * a resume deducts when the tailor finishes one. Top-ups are admin-only.
 */

const storage = () => import("./storage").then(m => m.blob)

export const POINTS_PER_INTERVIEW = 1
export const POINTS_PER_RESUME = 0.25
/** Starting grant when a user first appears. The owner tops up from the admin page. */
export const STARTING_POINTS = 20

const day = (at: number) => new Date(at).toISOString().slice(0, 10)

type Balance = { points: number; updatedAt: number }

async function readBalance(userHash: string): Promise<Balance> {
  try {
    const raw = await (await storage()).getText(`credits/balance/${userHash}.json`)
    if (raw) {
      const b = JSON.parse(raw) as Balance
      if (Number.isFinite(b.points)) return { points: b.points, updatedAt: b.updatedAt || 0 }
    }
  } catch { /* first sighting — grant the starting points */ }
  return { points: STARTING_POINTS, updatedAt: Date.now() }
}

async function writeBalance(userHash: string, b: Balance): Promise<void> {
  await (await storage()).put(`credits/balance/${userHash}.json`, JSON.stringify(b))
}

/** Current points for a user. Never rejects — 0 on storage failure. */
export async function getPoints(userHash: string): Promise<number> {
  try { return (await readBalance(userHash)).points } catch { return 0 }
}

/** What the header shows: whole interviews and whole resumes the points buy. */
export function pointsToDisplay(points: number): { interviews: number; resumes: number } {
  const p = Math.max(0, points)
  return { interviews: Math.floor(p / POINTS_PER_INTERVIEW), resumes: Math.floor(p / POINTS_PER_RESUME) }
}

/** Session cost by duration: 1 hour = 1 point, 30 min = 0.5 points, prorated. */
export function sessionPointsForMinutes(minutes: number): number {
  return Math.round((Math.max(0, minutes) / 60) * 100) / 100
}

/**
 * Deduct points once for `ref` (a session id, a resume id). Idempotent: the
 * same ref deducted twice costs once — retries and double-deliveries are safe.
 * Returns the new balance, or null when storage failed.
 */
export async function deductPoints(userHash: string, points: number, ref: string, forWhat: "interview" | "resume"): Promise<number | null> {
  try {
    const sb = await storage()
    const marker = `credits/deductions/${day(Date.now())}/${ref}.json`
    try {
      if (await sb.get(marker)) return (await readBalance(userHash)).points
    } catch { /* not deducted yet */ }
    const b = await readBalance(userHash)
    b.points = Math.max(0, Math.round((b.points - points) * 100) / 100)
    b.updatedAt = Date.now()
    await writeBalance(userHash, b)
    await sb.put(marker, JSON.stringify({ userHash, points, for: forWhat, ref, at: Date.now() }))
    return b.points
  } catch {
    return null
  }
}

/** Admin top-up. Returns the new balance, or null on failure. */
export async function addPoints(userHash: string, points: number): Promise<number | null> {
  try {
    const b = await readBalance(userHash)
    b.points = Math.round((b.points + points) * 100) / 100
    b.updatedAt = Date.now()
    await writeBalance(userHash, b)
    return b.points
  } catch {
    return null
  }
}
