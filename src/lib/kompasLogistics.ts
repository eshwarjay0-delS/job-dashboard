import { interviewIntent } from "./kompasRelevance.ts"

// Owner rule, 29 Oct 2026 (11:26 PM CT): Kompas never answers logistics. No visa, work
// authorization or citizenship, pay, relocation, address, current location, start date,
// notice period or availability. The only personal content an answer may carry is what the
// resume says. interviewIntent() is broad on purpose ("hybrid cloud", "on-site audits" read as
// logistics there), so an ask is skipped only when it is ALSO a personal-terms question
// put to the candidate. A mixed ask keeps its non-logistics part.
const PERSONAL = new RegExp([
  String.raw`^\s*(?:notice|remote|bonus|salary|hybrid|on-?site|h-?1b|opt|ts\s*\/\s*sci|shift|weekend|overtime|citizen|clearance|sponsorship|relocation|start date|night shift|travel|visa|tn visa|w-?2|c2c|full[- ]time|contract|pto|benefits|401k|equity|ead|l-?1|hourly|day rate|(?:u\.?\s*s\.?|u\s+s)\s+citizen)[.?!]*\s*$`,
  String.raw`\bwhen (?:can|could|would) you (?:start|join|begin)\b|\bstart date\b|\bavailable to (?:start|join|begin)\b|\b(?:two|\d+)\s+weeks'?\s+notice\b|\bnotice period\b|\bstart in (?:two|\d+) weeks\b`,
  String.raw`(?<!\b(?:data ?cent(?:er|re)|server|workload|application|app|service|cloud|vault|database|office|team)\s)\brelocat(?:e|es|ed|ing|ion)\b(?!\s+(?:the|a|an|our|this|that|these|those|it|its|of|data|workloads?|services?|servers?|apps?|applications?|vault|psm|databases?)\b)`,
  String.raw`\bsponsor(?:ship)?\b|\bvisa\b|\bh-?1b\b|\bgreen card\b|\bwork(?:ing)? authori[sz]ation\b|\bauthori[sz]ed to work\b|\bcitizen(?:ship)?\b|\bead\b`,
  String.raw`\bsalary\b|\bcompensation\b|\b(?:desired|expected|your|hourly|day|pay) (?:pay|rate|range)\b|\bhow much (?:do|would|are) you\b.{0,30}\b(?:paid|make|earn|expect|looking for)\b|\bc2c\b|\bw-?2\b`,
  String.raw`\bwhere are you (?:based|located|living|from)\b|\bwhere do you live\b|\bcurrent(?:ly)? (?:location|located|based|living)\b|\byour (?:home |current )?address\b|\bare you local\b|\bcommute\b`,
  String.raw`\b(?:open|okay|ok|comfortable|willing|able|fine|happy)\s+(?:to|with)\s+(?:work(?:ing)?\s+)?(?:a\s+)?(?:hybrid|on-?site|remote|in the office|travel|relocat|nights?|weekends?|on-?call|shifts?)`,
  String.raw`\bdays?\s+in(?:\s+the)?\s+office\b|\bwilling to travel\b|\btravel (?:requirement|percent)|\b(?:do|have) you (?:have|hold|got) (?:an? )?(?:active )?(?:security )?clearance\b|\bclearable\b|\bfull[- ]time or contract\b|\bcontract or full[- ]time\b`,
  String.raw`\b(?:work(?:ing)?\s+(?:nights?|weekends?)|night shifts?|available for on-?call|work(?:ing)? on-?call)\b`,
  String.raw`\b(?:your|signing|annual|expected) bonus\b|\b(?:expect(?:ed)?|your) equity\b|\b401k\b|\bcontract role\b|\b(?:hold|on) opt\b|\bopt status\b|\b(?:need an l-?1|l-?1 visa)\b|\bearliest start\b|\b(?:how much notice|notice do you need)\b|\bcity do you live\b|\btime zone are you\b|\bwork (?:est|cst|pst|mst|eastern|central|pacific|mountain) hours\b|\bwork from home\b|\bare you remote\b|\bopen to weekends\b|\bbe on[- ]?call\b|\byour shift\b|\bpto\b`,
].join("|"), "i")

// Asks the classifier files elsewhere ("What is your current location?" reads as a definition)
// but that can only mean the candidate's own terms.
const UNAMBIGUOUS = /\bcurrent(?:ly)? (?:location|located|based|living)\b|\byour (?:home |current )?address\b|\bwhere (?:do you live|are you (?:based|located|living))\b|\bnotice period\b|\bsalary (?:expectation|range|requirement)s?\b|\b(?:need|require)\b.{0,25}\bsponsorship\b|\bauthori[sz]ed to work\b|\bwork authori[sz]ation\b|\b(?:your|signing|annual|expected) bonus\b|\b(?:expect(?:ed)?|your) equity\b|\b401k\b|\bw-?2\b|\bc2c\b|\bcontract role\b|\b(?:hold|on) opt\b|\bopt status\b|\b(?:need an l-?1|l-?1 visa)\b|\bearliest start\b|\b(?:how much notice|notice do you need)\b|\bcity do you live\b|\btime zone are you\b|\bwork (?:est|cst|pst|mst|eastern|central|pacific|mountain) hours\b|\bwork from home\b|\bare you remote\b|\bopen to weekends\b|\bbe on[- ]?call\b|\byour shift\b|\bpto\b/i

/** One clause is logistics only when the classifier says so and it asks about the candidate's own terms. */
export function isLogisticsAsk(clause: string): boolean {
  const c = String(clause || "").trim()
  return !!c && PERSONAL.test(c) && (interviewIntent(c) === "logistics" || UNAMBIGUOUS.test(c))
}

// "U.S." is not a sentence end.
const SENTENCE = /(?<=[?!]|(?<!\b[A-Za-z])\.)\s+/
const ASK = /\?|^\s*(?:(?:also|and|so|now)[, ]+)?(?:what|why|how|when|where|which|who|tell|describe|explain|give|walk|could|can|would|will|are|is|do|does|did|have|has|should|share|highlight)\b/i
const JOIN = /\s*(?:,\s*|\s)(?:and|also|plus)\s+(?=(?:are|is|do|does|did|would|will|can|could|what|when|where|how|have|has|any)\b)/i

/**
 * The question with every logistics clause removed: unchanged when none is logistics,
 * "" when all of it is, and the remaining clauses when the ask was mixed.
 */
export function withoutLogistics(question: string): string {
  const q = String(question || "").trim()
  if (!q) return q
  const clauses = q.split(SENTENCE).flatMap((s) => s.split(JOIN)).map((s) => s.trim()).filter(Boolean)
  const kept = clauses.filter((c) => !isLogisticsAsk(c))
  if (kept.length === clauses.length) return q
  // "We hire quickly. When could you start?" leaves a remark, not a question: stay quiet.
  if (!kept.some((c) => ASK.test(c))) return ""
  return kept.join(" ").trim()
}

/**
 * demo-final merge: the server-side backstop that runs after Voice's clause-level helper
 * (kompasRelevance.withoutLogistics). It only catches single-clause present-tense asks Voice lets
 * through ("Are you open to hybrid?"). Past-tense resume history ("What was your start date at
 * Citi?") and compounds ("Okta and your notice period") are left to Voice's helper, so a resume
 * fact or the technical half of a compound is never silenced by this backstop.
 */
export function logisticsBackstop(question: string): string {
  const q = String(question || "")
  if (!q.trim()) return q
  if (/\b(?:was|were|did|had)\b/i.test(q) || /\s(?:and|also|plus)\s/i.test(q)) return q
  // "How does work authorization work?" asks for the mechanism. It is not "are you authorized".
  if (/\bhow (?:does|do|did)\b[^?]{0,80}\bwork\b/i.test(q)) return q
  return withoutLogistics(q)
}
