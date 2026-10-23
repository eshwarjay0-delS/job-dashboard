// What a tailored resume must contain, and how the last missing terms are put in.
//
// Owner, 19 Oct 2026, on a WhatsApp resume that came back at 96% with "missing: micro-segmentation security, technology,
// protocols": "doesn't have the audacity to apply them all in anyway ... always give this to gemini free api for more
// keywords each iteration. Then concatenate both given user input and that results. And resume tailor for best match."
//
// So the target is the job post's own terms PLUS Gemini's, cleaned of what is not a skill (generic words such as
// "technology", fragments such as "palo" beside "palo alto", Gemini's task sentences and years), and every target the
// rewrite still left out is written onto the best-fitting line of the resume's skills section. Certifications are
// ignored altogether (owner, 19 Oct 2026: "Ignore certs always"): never a target, never added, and one the AI writer
// slips into the skills section without the source resume listing it is taken out again.
// No imports: the tests load this file directly.

// Single words that describe a job post rather than a skill an ATS or a recruiter searches for.
const GENERIC = new Set([
  "technology", "technologies", "protocol", "protocols", "system", "systems", "solution", "solutions", "environment",
  "environments", "tool", "tools", "platform", "platforms", "team", "teams", "policy", "policies", "process", "processes",
  "standard", "standards", "service", "services", "application", "applications", "operations", "requirements",
  "experience", "knowledge", "skills", "ability", "issues", "support", "management", "data", "security", "solutioning",
  "projects", "project", "business", "stakeholders", "documentation", "enterprise", "infrastructure", "networks",
])

// The first word of a task sentence, not of a skill ("remove shadowed rules", "deploy and operate").
const TASK_VERBS = new Set([
  "remove", "clean", "deploy", "operate", "map", "troubleshoot", "automate", "optimize", "optimise", "document", "design",
  "implement", "maintain", "build", "review", "work", "collaborate", "improve", "support", "manage", "lead", "drive",
  "ensure", "perform", "develop", "create", "monitor", "configure", "integrate", "analyze", "analyse", "provide",
  "conduct", "plan", "run", "use", "help", "define", "establish", "own", "partner", "coordinate", "deliver", "prepare",
  "track", "respond", "investigate", "assess", "evaluate", "identify", "mentor", "communicate", "participate", "write",
])

// Endings that make a phrase about people, places or paperwork rather than a skill.
const NON_SKILL_TAIL = /\b(teams?|environments?|issues|records|groups of people|stakeholders|candidates?|customers?|clients?|years?|yrs)$/

// A word boundary after a terminal + does not match end-of-string or punctuation.
// Use a token-end assertion, and recognize Salesforce credential names without a Certified prefix.
const CERT = /\b(certified|certification|certificate|cissp|ccsp|cism|cisa|crisc|cgeit|oscp|osce|oswe|ceh|gsec|gcih|gcia|gcfa|gpen|gwapt|giac|security\+|network\+|a\+|cysa\+|casp\+|pentest\+|comptia|ccna|ccnp|ccie|pcnse|pcnsa|pccse|nse ?[1-8]|jncia|jncis|jncip|cka|ckad|cks|pmp|capm|csm|cspo|safe agilist|cipp(?:\/[a-z]+)?|cipm|cdpse|ccsk|az-\d{3}|sc-\d{3}|ai-\d{3}|dp-\d{3}|ms-\d{3}|aws certified|cpa|cfa|frm|salesforce platform developer (?:ii|i)|salesforce cpq specialist)(?![a-z0-9_+])/i

export function isCertification(term: string): boolean {
  return CERT.test(term)
}

const words = (s: string) => s.toLowerCase().split(/[^a-z0-9+#.]+/).filter(Boolean)

/** A term Gemini suggested that reads as a skill: short, a noun phrase, not a task, a length of time or a list. */
export function skillLike(term: string): boolean {
  const t = term.toLowerCase().trim()
  if (t.length < 2 || t.length > 48) return false
  const w = t.split(/\s+/)
  if (w.length > 4) return false
  if (/\b(and|or|with|across|for|to|of the)\b/.test(t) && w.length > 2) return false
  if (TASK_VERBS.has(w[0])) return false
  if (/\d+\s*\+|\b\d+\s*(?:years?|yrs)\b/.test(t)) return false
  if (NON_SKILL_TAIL.test(t)) return false
  if (w.length === 1 && GENERIC.has(t)) return false
  return true
}

/**
 * The terms the resume is measured against and must end up containing: the job post's own extracted terms and Gemini's
 * skill-like suggestions, together. Generic single words go, and so does a single word that only appears inside a
 * longer target ("palo" beside "palo alto", "micro" beside "micro-segmentation"): the longer term is what is checked.
 */
export function targetKeywords(extracted: string[], generated: string[]): string[] {
  const all = [...new Set([
    ...extracted.map(k => k.toLowerCase().trim()),
    ...generated.map(k => k.toLowerCase().trim()).filter(skillLike),
  ])].filter(k => k && !(k.split(/\s+/).length === 1 && GENERIC.has(k)) && !isCertification(k))
  const multi = all.filter(k => /[\s\-/]/.test(k))
  return all.filter(k => {
    if (/[\s\-/]/.test(k)) return true
    return !multi.some(m => m !== k && words(m).includes(k))
  })
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

/** The term as the job post writes it ("Palo Alto", "micro-segmentation"), else as given. */
export function jdSpelling(term: string, jd: string): string {
  const m = jd.match(new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, "i"))
  return m ? m[0] : term
}

const contains = (text: string, term: string) =>
  new RegExp(`(?<![A-Za-z0-9])${escapeRe(term)}(?![A-Za-z0-9])`, "i").test(text)

/**
 * Skills lines with every certification the source resume does not list taken out (the AI writer adds them now and
 * then: PCNSE appeared in a test on 19 Oct 2026). Returns only the lines that changed. A heading ("Governance,
 * Compliance: ") is kept as it is; only the listed items are looked at.
 */
export function withoutAddedCerts(lines: { idx: number; text: string }[], sourceText: string): { idx: number; text: string }[] {
  const out: { idx: number; text: string }[] = []
  for (const l of lines) {
    const heading = l.text.match(/^([^:\n]{2,70}:)\s*/)?.[0] || ""
    const body = l.text.slice(heading.length)
    const sep = separatorOf(body)
    const end = /[.;]\s*$/.test(body) ? body.trim().slice(-1) : ""
    const items = (end ? body.trim().slice(0, -1) : body).split(sep.trim() === "," ? /\s*,\s*/ : new RegExp(`\\s*${escapeRe(sep.trim())}\\s*`))
    const kept = items.filter(item => !(isCertification(item) && !contains(sourceText, item.trim())))
    if (kept.length === items.length) continue
    out.push({ idx: l.idx, text: `${heading}${kept.join(sep)}${end}` })
  }
  return out
}

function separatorOf(line: string): string {
  if (line.includes(" | ")) return " | "
  if (line.includes("•")) return " • "
  if (!line.includes(",") && line.includes(";")) return "; "
  return ", "
}

/**
 * Put each term on the skills line it fits best (the line sharing the most words with it, else the longest list),
 * keeping the line's own separator and any "Heading:" in front. Returns only the lines that changed. A term already
 * on some line is left alone.
 */
export function placeInSkills(lines: { idx: number; text: string }[], terms: string[], jd: string): { idx: number; text: string }[] {
  if (!lines.length || !terms.length) return []
  const cur = lines.map(l => ({ idx: l.idx, text: l.text }))
  const listy = cur.filter(l => /[,|•;]/.test(l.text) || /^[^:\n]{2,70}:/.test(l.text))
  const pool = listy.length ? listy : cur
  const items = (t: string) => (t.match(/[,|•;]/g) || []).length
  const changed = new Set<number>()
  for (const term of terms) {
    if (cur.some(l => contains(l.text, term))) continue
    const shown = jdSpelling(term, jd)
    const tw = words(term).filter(w => w.length >= 3)
    let best = pool[0], bestScore = -1
    for (const l of pool) {
      const lw = new Set(words(l.text))
      const score = tw.filter(w => lw.has(w)).length * 10 + Math.min(items(l.text), 9)
      if (score > bestScore) { best = l; bestScore = score }
    }
    const text = best.text.replace(/\s+$/, "")
    const heading = text.match(/^([^:\n]{2,70}:)\s*$/)
    if (heading) best.text = `${heading[1]} ${shown}`
    else {
      const end = text.match(/[.;]$/) ? text.slice(-1) : ""
      const body = end ? text.slice(0, -1) : text
      best.text = `${body}${separatorOf(body)}${shown}${end}`
    }
    changed.add(best.idx)
  }
  return cur.filter(l => changed.has(l.idx))
}

export type RelationalPair = { parent: string; terms: string[] }

/** Keep Gemini's related terms only when the parent skill is in what the candidate confirmed. */
export function parseConfirmedVocabulary(text: string, evidence: string): RelationalPair[] {
  let t = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/\s*```$/, "").trim()
  const a = t.indexOf("["), b = t.lastIndexOf("]")
  if (a >= 0 && b > a) t = t.slice(a, b + 1)
  let arr: unknown
  try { arr = JSON.parse(t) } catch { return [] }
  if (!Array.isArray(arr)) return []
  const out: RelationalPair[] = []
  for (const item of arr) {
    if (!item || typeof item !== "object") continue
    const rec = item as { parent?: unknown; terms?: unknown }
    const parent = typeof rec.parent === "string" ? rec.parent.toLowerCase().trim() : ""
    if (parent.length < 2 || !contains(evidence, parent)) continue
    const terms = Array.isArray(rec.terms) ? rec.terms.flatMap(v => typeof v === "string" ? [v.toLowerCase().trim()] : []) : []
    if (terms.length) out.push({ parent, terms: [...new Set(terms)].slice(0, 6) })
  }
  return out
}
export type ResumeBullet = { idx: number; role: string; text: string }

/** A related term is allowed only when the candidate already stated the parent skill, or the baseline already shows it. */
export function groundedPairs(pairs: RelationalPair[], evidence: string): RelationalPair[] {
  const out: RelationalPair[] = []
  for (const pair of pairs) {
    const parent = pair.parent.toLowerCase().trim()
    if (parent.length < 2 || !contains(evidence, parent)) continue
    const terms = [...new Set(pair.terms.map(t => t.toLowerCase().trim()).filter(t => t !== parent && skillLike(t) && !isCertification(t)))]
    out.push({ parent, terms })
  }
  return out
}

function clause(terms: string[]): string {
  return terms.length === 1 ? terms[0] : `${terms.slice(0, -1).join(", ")} and ${terms[terms.length - 1]}`
}

/**
 * Write confirmed skills and their related vocabulary into the skills list and into a bullet for the role the
 * candidate named. A parent the evidence does not contain is dropped, so a job-post tool they never confirmed stays out.
 */
export function weaveConfirmedVocabulary(input: {
  skills: { idx: number; text: string }[]
  bullets: ResumeBullet[]
  pairs: RelationalPair[]
  evidence: string
  jd: string
}): { skills: { idx: number; text: string }[]; bullets: { idx: number; text: string }[]; text: string } {
  const pairs = groundedPairs(input.pairs, input.evidence)
  const wanted = pairs.flatMap(p => [p.parent, ...p.terms])
  const skillEdits = placeInSkills(input.skills, wanted, input.jd)
  const skillText = new Map(input.skills.map(s => [s.idx, s.text]))
  for (const edit of skillEdits) skillText.set(edit.idx, edit.text)
  const bulletText = input.bullets.map(b => ({ ...b }))
  const evidence = input.evidence.toLowerCase()
  for (const pair of pairs) {
    const shown = pair.terms.map(t => jdSpelling(t, input.jd))
    const named = bulletText.filter(b => {
      const roleWord = b.role.toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 4)
      return contains(b.text, pair.parent) || roleWord.some(w => evidence.includes(w) && evidence.includes(pair.parent))
    })
    const home = named[0]
    if (!home) continue
    const missing = shown.filter(t => !contains(home.text, t))
    if (!missing.length) continue
    const text = home.text.replace(/\s+$/, "")
    const end = /[.]$/.test(text) ? "." : ""
    const body = end ? text.slice(0, -1) : text
    home.text = `${body}, including ${clause(missing)}${end}`
  }
  const skills = [...skillText.entries()].map(([idx, text]) => ({ idx, text }))
  const text = [...skills.map(s => s.text), ...bulletText.map(b => b.text)].join("\n")
  return { skills: skillEdits, bullets: bulletText.filter(b => !input.bullets.some(o => o.idx === b.idx && o.text === b.text)).map(b => ({ idx: b.idx, text: b.text })), text }
}
