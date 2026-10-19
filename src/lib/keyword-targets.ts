// What a tailored resume must contain, and how the last missing terms are put in.
//
// Owner, 19 Oct 2026, on a WhatsApp resume that came back at 96% with "missing: micro-segmentation security, technology,
// protocols": "doesn't have the audacity to apply them all in anyway ... always give this to gemini free api for more
// keywords each iteration. Then concatenate both given user input and that results. And resume tailor for best match."
//
// So the target is the job post's own terms PLUS Gemini's, cleaned of what is not a skill (generic words such as
// "technology", fragments such as "palo" beside "palo alto", Gemini's task sentences and years), and every target the
// rewrite still left out is written onto the best-fitting line of the resume's skills section. Certifications are the
// one exception: listing one is a claim to hold it, so they are named to the person instead of being added.
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

const CERT = /\b(certified|certification|certificate|cissp|ccsp|cism|cisa|crisc|cgeit|oscp|osce|oswe|ceh|gsec|gcih|gcia|gcfa|gpen|gwapt|giac|security\+|network\+|a\+|cysa\+|casp\+|pentest\+|comptia|ccna|ccnp|ccie|pcnse|pcnsa|pccse|nse ?[1-8]|jncia|jncis|jncip|cka|ckad|cks|pmp|capm|csm|cspo|safe agilist|cipp(?:\/[a-z]+)?|cipm|cdpse|ccsk|az-\d{3}|sc-\d{3}|ai-\d{3}|dp-\d{3}|ms-\d{3}|aws certified|cpa|cfa|frm)\b/i

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
  ])].filter(k => k && !(k.split(/\s+/).length === 1 && GENERIC.has(k)))
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
