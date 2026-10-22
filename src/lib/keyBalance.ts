/**
 * API key balances — the deterministic "how many resumes can I still make".
 *
 * Why (2026-10-11): the owner loaded $10 on his OpenAI key for resume prep and
 * asked for the real number: "how many resumes can I make, and when do I need
 * to add more". Price tables guess; this counts. He declares what he loaded
 * once ("I put $10 on OpenAI"), and every measured cent the ledgers record is
 * subtracted. What is left divided by the measured cost per resume is how many
 * resumes remain — a measured number, not an estimate, once the first resume
 * calibrates it. Before that, the price table gives the fallback, labeled so.
 *
 *   key-balances/<provider>.json   { loadedUsd, updatedAt }
 *
 * Spend comes from the ledgers that already meter every call (llmLedger,
 * tailorLedger) — this file only holds the declared top-ups.
 */

const storage = () => import("./storage").then(m => m.blob)

export type KeyBalance = { loadedUsd: number; updatedAt: number }

/**
 * Declared starting balances (2026-10-11): the owner loaded $10 on his OpenAI
 * key and $9.94 in OpenRouter credits. These are the seed — the first top-up
 * written through /api/budget/topup replaces them in storage. Kept in code
 * (not only in R2) so a fresh deployment never shows $0 for money he loaded.
 */
const SEED_BALANCES: Record<string, number> = {
  openai: 10,
  openrouter: 9.94,
  groq: 0,
}

export async function getKeyBalance(provider: string): Promise<KeyBalance> {
  try {
    const raw = await (await storage()).getText(`key-balances/${provider}.json`)
    if (raw) {
      const b = JSON.parse(raw) as KeyBalance
      if (Number.isFinite(b.loadedUsd) && b.loadedUsd >= 0) return b
    }
  } catch { /* never set */ }
  const seed = SEED_BALANCES[provider] ?? 0
  return { loadedUsd: seed, updatedAt: 0 }
}

/** Declare (or re-declare) what was loaded on a key. Admin/owner only — the route checks. */
export async function setKeyBalance(provider: string, loadedUsd: number): Promise<KeyBalance> {
  const b: KeyBalance = { loadedUsd: Math.max(0, Math.round(loadedUsd * 100) / 100), updatedAt: Date.now() }
  await (await storage()).put(`key-balances/${provider}.json`, JSON.stringify(b))
  return b
}

/**
 * One resume's typical token shape (keyword expansion + main generation) and
 * its price-table cost before a measured cost exists. THE source every
 * surface uses (owner, 22 Oct 2026: the same resume was priced differently
 * on different pages): the sidebar, the resume page and the budget board all
 * take their pre-calibration fallback from here, never from a local copy.
 *   RESUME_FALLBACK_USD       — the OpenAI route resumes actually run on (gpt-6-luna prices)
 *   RESUME_FALLBACK_CHEAP_USD — the cheapest route (gpt-oss-120b prices)
 */
export const RESUME_TOKENS = { in: 3900, out: 1200 }
export const RESUME_FALLBACK_USD = (RESUME_TOKENS.in * 0.10 + RESUME_TOKENS.out * 0.50) / 1e6
export const RESUME_FALLBACK_CHEAP_USD = (RESUME_TOKENS.in * 0.037 + RESUME_TOKENS.out * 0.17) / 1e6
