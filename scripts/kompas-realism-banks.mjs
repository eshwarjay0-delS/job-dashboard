#!/usr/bin/env node
/**
 * r7 realism banks (pending #29, 29 Oct 2026). OFFLINE fixture builder: no model, no network, no token.
 * Two fictional dossiers (data engineering, backend) with question banks. bankQuestions(role) expands them into a large
 * bank of realistic asks per mode; sequences(n, seed) makes interview sequences mixing plain asks, voice-transcript noise,
 * follow-ups, pushbacks, wrong-premise asks, coding and design asks and uncovered topics. Deterministic for a seed.
 */
import { readFileSync } from "node:fs"
export const ROLES = ["data-engineering", "backend"]
export const LEVELS = ["engineer", "director", "architect"]
export function loadBank(role) { return JSON.parse(readFileSync(new URL(`./fixtures/kompas-realism/${role}.json`, import.meta.url), "utf8")) }
const FRAMES = ["Tell me about your work on {t}.", "How did you handle {t}?", "Walk me through {t}.", "What was the hardest part of {t}?", "How would you explain {t} to a new hire?", "What did you learn from {t}?"]
const MODE_FRAMES = {
  engineer: ["How exactly did you implement {t}?", "What tools did you use for {t}?"],
  director: ["How did you get buy-in for {t}?", "What was the business risk in {t}?"],
  architect: ["What trade-offs did you weigh in {t}?", "How would {t} scale if traffic grew ten times?"],
}
// Voice-transcript noise seen in real captures: fillers, restarts, a dropped capital, no question mark, invisible chars.
const NOISE = [
  (q) => `um, ${q.charAt(0).toLowerCase()}${q.slice(1)}`,
  (q) => q.replace(/[?.]$/, ""),
  (q) => `so, uh, ${q.replace(/^(\w+)/, "$1 $1")}`,
  (q) => q.replace(/ /, "\u00a0").replace(/ (\w)/, " \u200b$1"),
  (q) => `${q.replace(/[?.]$/, "")}, you know, like, in practice?`,
  (q) => `Okay so the thing is, ${q.charAt(0).toLowerCase()}${q.slice(1)}`,
]
export function bankQuestions(role) {
  const b = loadBank(role)
  const out = []
  for (const t of b.topics) {
    for (const f of FRAMES) out.push({ kind: "plain", q: f.replace("{t}", t), topic: t })
    for (const lv of LEVELS) for (const f of MODE_FRAMES[lv]) out.push({ kind: "plain", level: lv, q: f.replace("{t}", t), topic: t })
  }
  for (const q of b.coding) out.push({ kind: "coding", q })
  for (const q of b.design) out.push({ kind: "design", q })
  for (const q of b.behavioral) out.push({ kind: "behavioral", q })
  for (const t of b.uncovered) out.push({ kind: "uncovered", q: `Tell me about your work on ${t}.`, topic: t })
  for (const [q, premise] of b.wrongPremise) out.push({ kind: "wrong-premise", q, premise })
  const base = out.slice()
  base.forEach((x, i) => { if (i % 3 === 0) out.push({ ...x, kind: x.kind === "plain" ? "noisy" : x.kind, noisy: true, q: NOISE[i % NOISE.length](x.q) }) })
  return out
}
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296) }
/** n sequences of 3-6 turns: an opener, then a mix of follow-ups, pushbacks, noise and fresh asks. */
export function sequences(n, seed = 7) {
  const r = rng(seed)
  const banks = Object.fromEntries(ROLES.map((role) => [role, { b: loadBank(role), qs: bankQuestions(role) }]))
  const pick = (a) => a[Math.floor(r() * a.length)]
  const out = []
  for (let i = 0; i < n; i++) {
    const role = ROLES[i % ROLES.length]
    const { b, qs } = banks[role]
    const turns = []
    const len = 3 + Math.floor(r() * 4)
    turns.push(qs[(i * 7) % qs.length])
    for (let k = 1; k < len; k++) {
      const x = r()
      if (x < 0.2) turns.push({ kind: "follow-up", q: pick(b.followUps) })
      else if (x < 0.32) turns.push({ kind: "pushback", q: pick(b.pushbacks) })
      else if (x < 0.42) { const [q, premise] = pick(b.wrongPremise); turns.push({ kind: "wrong-premise", q, premise }) }
      else if (x < 0.52) turns.push({ kind: "coding", q: pick(b.coding) })
      else turns.push(pick(qs))
    }
    out.push({ id: `${role}-${i}`, role, level: LEVELS[i % 3], resume: b.resume, turns })
  }
  return out
}
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const role of ROLES) { const q = bankQuestions(role); const kinds = {}; q.forEach((x) => (kinds[x.kind] = (kinds[x.kind] || 0) + 1)); console.log(role, q.length, JSON.stringify(kinds)) }
}
