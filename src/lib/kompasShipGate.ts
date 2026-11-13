// Fix 3 (defensibility cycle): never ship worse. A part-miss, a ledger contradiction, technical incoherence or an
// attribution failure fails an answer regardless of its mean. A new answer replaces the stored best only when it passes
// every hard gate AND beats the stored answer on the current scorer; otherwise the stored answer is what ships.

export const HARD_CODES = new Set([
  "checklist-missed", "part-missed", "contradiction", "ledger-fact-swap", "ledger-employer-swap", "ledger-outcome-swap",
  "technical-incoherence", "os-mismatch", "tool-capability", "detection-overreach", "attribution", "authority-wrong", "followup-collapse", "slogan",
])

export type GateInput = {
  /** deterministic scorer verdict (all hard deterministic gates) */
  detPass: boolean
  /** deterministic rank on the current scorer (higher is better) */
  rank: number
  /** hard findings by code (deterministic + interrogation) */
  hardCodes?: string[]
  /** interrogation verdict; null when interrogation is off */
  interrogation?: { pass: boolean; survives: boolean } | null
}

export function passesAllHardGates(x: GateInput, { interrogationRequired = true }: { interrogationRequired?: boolean } = {}): boolean {
  if (!x.detPass) return false
  if ((x.hardCodes || []).some((c) => HARD_CODES.has(c))) return false
  if (interrogationRequired && !(x.interrogation && x.interrogation.pass)) return false
  return true
}

// Lexicographic: all hard gates > survives follow-ups > deterministic pass > rank. A failing answer can never outrank a passing one.
export function fullRank(x: GateInput, opts: { interrogationRequired?: boolean } = {}): number {
  return (passesAllHardGates(x, opts) ? 1e6 : 0) + (x.interrogation?.survives ? 1e5 : 0) + (x.detPass ? 1e4 : 0) + Math.max(-9999, Math.min(9999, x.rank || 0))
}

export type ShipDecision = { ship: "new" | "previous"; replace: boolean; reason: string }
export function decideShip(fresh: GateInput, previous: GateInput | null, opts: { interrogationRequired?: boolean } = {}): ShipDecision {
  const ok = passesAllHardGates(fresh, opts)
  if (!previous) return { ship: "new", replace: ok, reason: ok ? "first answer, passes every hard gate" : "first answer (nothing to compare), fails a hard gate" }
  if (!ok) return { ship: "previous", replace: false, reason: "new answer fails a hard gate; earlier answer kept" }
  if (fullRank(fresh, opts) > fullRank(previous, opts)) return { ship: "new", replace: true, reason: "passes every hard gate and beats the earlier answer" }
  return { ship: "previous", replace: false, reason: "passes, but does not beat the earlier answer on the current scorer" }
}

// Audit for a round: matched questions where the stored best was replaced by something no better. Must be empty.
export function replacedByWorse(rows: Array<{ id: string; replaced: boolean; fresh: GateInput; previous: GateInput | null }>, opts: { interrogationRequired?: boolean } = {}): string[] {
  return rows.filter((r) => r.replaced && r.previous && fullRank(r.fresh, opts) <= fullRank(r.previous, opts)).map((r) => r.id)
}
