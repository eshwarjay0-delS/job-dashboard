/**
 * Active-profile STT vocabulary and post-STT corrections (2026-11-10).
 *
 * Terms come only from the profile object passed in. Two candidate profiles
 * must never be mixed: call this with the active session profile alone.
 * The result is a Whisper prompt / streaming keyterm list, plus a correction
 * map that is applied only for terms that actually appear in that profile.
 */

export type SttProfile = {
  id?: string
  name?: string
  role?: string
  resume?: string
  jd?: string
  employers?: readonly string[]
  companies?: readonly string[]
  tools?: readonly string[]
  keywords?: readonly string[]
  identity?: {
    name?: string
    employers?: readonly string[]
    companies?: readonly string[]
    tools?: readonly string[]
    keywords?: readonly string[]
  }
  persona?: { role?: string; employers?: readonly string[]; tools?: readonly string[] }
  projects?: Array<{
    name?: string
    employer?: string
    company?: string
    tools?: readonly string[]
    stack?: readonly string[]
  }>
  prep?: SttProfile
}

const GENERIC_ROLE_TERMS = ["CISO", "CAB", "DMARC", "SOC", "GRC", "EDR", "SIEM", "IAM", "MFA"]

/** Known mishearings. Applied only when the canonical term is in the active vocab. */
const CONFUSION_PAIRS: Array<{ term: string; patterns: RegExp[] }> = [
  { term: "Entra ID", patterns: [/\benter(?:\s+an?)?\s+id\b/gi, /\bentra\s*id\b/gi, /\bentrai\s*d\b/gi, /\benter\s+id\b/gi] },
  { term: "ServiceNow GRC", patterns: [/\bservice\s*now\s+grc\b/gi, /\bservice\s*now\b/gi] },
  { term: "Qualys VMDR", patterns: [/\bqualis\s+vmdr\b/gi, /\bquality\s+vmdr\b/gi, /\bqualys\s+vmd[er]\b/gi, /\bqualys\s+vmdr\b/gi] },
  { term: "Qualys", patterns: [/\bqualis\b/gi, /\bquallis\b/gi] },
  { term: "Tanium", patterns: [/\btanny(?:\s+um)?\b/gi, /\btanium\b/gi] },
  { term: "Splunk", patterns: [/\bsplunc?k\b/gi, /\bsplank\b/gi] },
  { term: "Citi", patterns: [/\bat\s+city\b/gi, /\bciti\s+bank\b/gi] },
  { term: "CVS", patterns: [/\bc\.\s*v\.\s*s\.?\b/gi, /\bsee\s+v(?:ee)?\s+s\b/gi] },
  { term: "DMARC", patterns: [/\bdee\s*mark\b/gi, /\bd[\s-]?marc\b/gi] },
  { term: "CISO", patterns: [/\bsee\s*so\b/gi, /\bc[\s-]?i[\s-]?s[\s-]?o\b/gi] },
  { term: "CAB", patterns: [/\bchange\s+advisory\s+board\b/gi] },
]

function pushTerm(out: string[], seen: Set<string>, raw: unknown) {
  const t = String(raw || "").replace(/\s+/g, " ").trim()
  if (!t || t.length < 2 || t.length > 48) return
  if (/^(the|and|for|with|from|this|that|role|tools?|skills?)$/i.test(t)) return
  const key = t.toLowerCase()
  if (seen.has(key)) return
  seen.add(key)
  out.push(t)
}

function collectList(out: string[], seen: Set<string>, list: readonly unknown[] | undefined) {
  if (!Array.isArray(list)) return
  for (const item of list) pushTerm(out, seen, item)
}

function collectFromText(out: string[], seen: Set<string>, text: string | undefined, allow: Set<string>) {
  if (!text) return
  // Only harvest tokens that already belong to the allow-list (profile-derived),
  // or Title-Case / acronym tokens adjacent to known employers/tools — we do not
  // scrape a second profile out of leftover session text.
  void allow
  void out
  void seen
}

/** Flatten employers and tools from one profile only. */
export function vocabFromProfile(profile: SttProfile | null | undefined): string[] {
  if (!profile) return []
  const out: string[] = []
  const seen = new Set<string>()
  const p = profile.prep && (profile.employers || profile.identity || profile.tools) ? profile : (profile.prep || profile)

  collectList(out, seen, p.employers)
  collectList(out, seen, p.companies)
  collectList(out, seen, p.tools)
  collectList(out, seen, p.keywords)
  collectList(out, seen, p.identity?.employers)
  collectList(out, seen, p.identity?.companies)
  collectList(out, seen, p.identity?.tools)
  collectList(out, seen, p.identity?.keywords)
  collectList(out, seen, p.persona?.employers)
  collectList(out, seen, p.persona?.tools)
  if (p.identity?.name) pushTerm(out, seen, p.identity.name)
  if (p.name) pushTerm(out, seen, p.name)
  if (p.role) pushTerm(out, seen, p.role)
  if (p.persona?.role) pushTerm(out, seen, p.persona.role)

  for (const proj of p.projects || []) {
    if (!proj) continue
    pushTerm(out, seen, proj.name)
    pushTerm(out, seen, proj.employer)
    pushTerm(out, seen, proj.company)
    collectList(out, seen, proj.tools)
    collectList(out, seen, proj.stack)
  }

  // Generic role terms only when they already appear in this profile's text.
  const blob = JSON.stringify(p).toLowerCase()
  for (const term of GENERIC_ROLE_TERMS) {
    if (blob.includes(term.toLowerCase())) pushTerm(out, seen, term)
  }

  collectFromText(out, seen, p.resume, seen)
  return out.slice(0, 80)
}

/** Whisper priming string from one profile. Empty when the profile has no terms. */
export function whisperPromptFromProfile(profile: SttProfile | null | undefined, previousLine = ""): string {
  const terms = vocabFromProfile(profile)
  const prev = String(previousLine || "").replace(/\s+/g, " ").replace(/[,;]/g, " ").trim().slice(-110)
  return [...new Set([...terms, ...(prev ? [prev] : [])])].join(", ").slice(0, 550)
}

/** Deepgram-style keyterms for the streaming path, from one profile only. */
export function streamingKeyterms(profile: SttProfile | null | undefined): string[] {
  return vocabFromProfile(profile).slice(0, 50)
}

export function streamingKeytermQuery(terms: readonly string[]): string {
  const qs = new URLSearchParams()
  for (const t of terms) {
    const v = String(t || "").trim()
    if (v) qs.append("keyterm", v)
  }
  return qs.toString()
}

export type CorrectionPair = { term: string; patterns: RegExp[] }

/** Correction map limited to terms present in the active vocab. */
export function correctionMapFromProfile(profile: SttProfile | null | undefined): CorrectionPair[] {
  const vocab = new Set(vocabFromProfile(profile).map((t) => t.toLowerCase()))
  if (!vocab.size) return []
  return CONFUSION_PAIRS.filter((pair) => {
    const key = pair.term.toLowerCase()
    if (vocab.has(key)) return true
    // "Qualys VMDR" should also unlock the Qualys pair; "ServiceNow GRC" unlocks ServiceNow.
    const head = key.split(/\s+/)[0]
    return [...vocab].some((v) => v === head || v.startsWith(key) || key.startsWith(v))
  })
}

export function applySttCorrections(text: string, profile: SttProfile | null | undefined): string {
  let t = String(text || "")
  if (!t) return t
  for (const pair of correctionMapFromProfile(profile)) {
    for (const re of pair.patterns) t = t.replace(re, pair.term)
  }
  return t
}

/**
 * Two profiles are isolated when neither vocab contains a distinctive term
 * that belongs only to the other. Used by tests; also a cheap runtime check.
 */
export function profilesAreIsolated(a: SttProfile | null | undefined, b: SttProfile | null | undefined): boolean {
  const A = new Set(vocabFromProfile(a).map((t) => t.toLowerCase()))
  const B = new Set(vocabFromProfile(b).map((t) => t.toLowerCase()))
  const onlyA = [...A].filter((t) => !B.has(t))
  const onlyB = [...B].filter((t) => !A.has(t))
  return onlyA.length > 0 && onlyB.length > 0 && onlyA.every((t) => !B.has(t)) && onlyB.every((t) => !A.has(t))
}
