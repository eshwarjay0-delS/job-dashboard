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

export async function getKeyBalance(provider: string): Promise<KeyBalance> {
  try {
    const raw = await (await storage()).getText(`key-balances/${provider}.json`)
    if (raw) {
      const b = JSON.parse(raw) as KeyBalance
      if (Number.isFinite(b.loadedUsd) && b.loadedUsd >= 0) return b
    }
  } catch { /* never set */ }
  return { loadedUsd: 0, updatedAt: 0 }
}

/** Declare (or re-declare) what was loaded on a key. Admin/owner only — the route checks. */
export async function setKeyBalance(provider: string, loadedUsd: number): Promise<KeyBalance> {
  const b: KeyBalance = { loadedUsd: Math.max(0, Math.round(loadedUsd * 100) / 100), updatedAt: Date.now() }
  await (await storage()).put(`key-balances/${provider}.json`, JSON.stringify(b))
  return b
}
