// Per-profile keyword cache. Built by scripts/build-kompas-lexicon.py.
// Lookups are in-memory maps. Unknown terms are reported, never invented.

import { appendFileSync, mkdirSync, readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { glossFor, validateStatement } from "./kompasGloss.ts"

export type LexiconEntry = {
  term: string
  surface: string
  evidence: string[]
  sources: string[]
}

export type KnownTerms = {
  profile: string
  known: Array<{ term: string; surface: string; evidence: string }>
  unknown: string[]
}

export const DEFAULT_LEXICON_PROFILE = "eshwarjay05"
const PROFILES = new Set(["eshwarjay05", "jayeshwar44", "eshwarjay06", "jayeshwar24"])

type Index = Record<string, Record<string, LexiconEntry>>

let index: Index | null = null
const byProfile = new Map<string, Map<string, LexiconEntry>>()

function repoCwd(): string {
  return typeof process !== "undefined" && typeof process.cwd === "function" ? process.cwd() : ""
}

function loadIndex(): Index {
  if (index) return index
  const cwd = repoCwd()
  if (!cwd) { index = {}; return index }
  try { index = JSON.parse(readFileSync(join(cwd, "src/lib/kompas-lexicon.json"), "utf8")) as Index }
  catch { index = {} }
  return index
}

export function sessionProfile(id?: string): string {
  const clean = String(id || "").toLowerCase()
  return PROFILES.has(clean) ? clean : DEFAULT_LEXICON_PROFILE
}

function table(profile: string): Map<string, LexiconEntry> {
  const id = sessionProfile(profile)
  const cached = byProfile.get(id)
  if (cached) return cached
  const rows = loadIndex()[id] || {}
  const map = new Map<string, LexiconEntry>()
  for (const [key, entry] of Object.entries(rows)) map.set(key, entry)
  byProfile.set(id, map)
  return map
}

function norm(text: string): string {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#./ -]+/g, " ").replace(/\s+/g, " ").trim()
}

/** One hash lookup. A miss is unknown, not a guess. */
export function lookupTerm(profile: string, term: string): LexiconEntry | null {
  const key = norm(term)
  if (!key) return null
  return table(profile).get(key) || null
}

/** Match known terms in one line. Multi-word forms are hash lookups of 2–6 grams. */
export function matchKnownTerms(profile: string, text: string): KnownTerms {
  const id = sessionProfile(profile)
  const map = table(id)
  const words = norm(text).split(" ").filter(Boolean)
  const known: KnownTerms["known"] = []
  const seen = new Set<string>()
  const take = (key: string) => {
    const entry = map.get(key)
    if (!entry || seen.has(entry.term)) return
    seen.add(entry.term)
    known.push({ term: entry.term, surface: entry.surface, evidence: entry.evidence[0] || "" })
  }
  for (let size = Math.min(6, words.length); size >= 2; size--) {
    for (let i = 0; i + size <= words.length; i++) take(words.slice(i, i + size).join(" "))
  }
  for (const word of words) take(word)
  const unknown = (String(text || "").match(/\b[A-Z][A-Z0-9]{1,8}\b/g) || [])
    .map((token) => token.toLowerCase())
    .filter((token) => !map.has(token) && !known.some((item) => item.term === token))
  return { profile: id, known, unknown: [...new Set(unknown)] }
}

/** A short framing sentence. A glossed term uses its reviewed order. An unglossed term gets no invented definition. */
export function lexiconClause(profile: string, text: string): string {
  const hit = matchKnownTerms(profile, text).known.find((item) => item.evidence && !/known on this profile/i.test(item.evidence))
  if (!hit) return ""
  const gloss = glossFor(hit.term)
  const evidence = hit.evidence.replace(/\s+/g, " ").trim().split(/\s+/).slice(0, 10).join(" ")
  const framed = gloss.glossed
    ? `${gloss.gloss.order} ${hit.surface} is on this resume: ${evidence}.`
    : `${hit.surface} is on this resume: ${evidence}.`
  const check = validateStatement(framed, hit.evidence)
  return check.ok ? check.line : check.line
}

/** JD terms that are not on the profile. Logged locally, not added to the index. */
export function noteCandidateTerm(profile: string, term: string, file?: string): boolean {
  const key = norm(term)
  if (!key || lookupTerm(profile, key)) return false
  if (typeof process === "undefined" || process.env.KOMPAS_LEXICON_CANDIDATES === "0") return false
  const cwd = repoCwd()
  const path = file || (cwd ? join(cwd, "data/kompas-lexicon-candidates.jsonl") : "")
  if (!path) return false
  try {
    mkdirSync(dirname(path), { recursive: true })
    appendFileSync(path, JSON.stringify({ profile: sessionProfile(profile), term: key, at: new Date().toISOString() }) + "\n")
  } catch { /* a full disk must not block the answer */ }
  return true
}
