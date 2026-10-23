// What the Chief may not write into a draft on its own: checked in code on every draft before a Gmail draft or an
// approval card is made, so a prompt that is ignored still cannot get one through.
//
// The mistakes it prevents, each in the owner's words (23 Oct 2026, his spec of the Chief):
// - a draft addressed to someone on his never-contact list ("Never email [the vendors he names]");
// - a rate guessed ("Rates never guessed — 'rate unconfirmed, ask <recruiter> before approving'"; the course: "an AI that
//   guesses your price loses you the deal");
// - a skill claimed that his resume does not carry ("Resume gaps named, never filled — 'missing: …, not on your resume'");
// - a submission taken as filed ("Submissions never assumed filed — 'filing may be in motion, verify by phone'");
// - an employer claim a recruiter asked for, echoed back ("Employer claims never echoed — 'flagged, your call'");
// - and a commitment (accepting a rate or an offer, signing) made for him.
// Each is left in the draft as a visible flag in square brackets and listed on the card; a card with an open flag
// cannot be sent until he edits it (src/app/api/whatsapp/webhook/route.ts).
//
// What counts as his: a figure, a claim or a commitment that is in his own words (his messages to the Chief, his brief),
// or, for skills and employers, on his own resume. Nothing else is.

export type FlagKind = "rate" | "commitment" | "gap" | "filing" | "employer" | "unchecked"
export type Flag = { kind: FlagKind; note: string }

export const COMMITMENT_FLAG = "[commitment — yours to make]"
export const FILING_FLAG = "[filing may be in motion — verify by phone]"
export const EMPLOYER_FLAG = "[employer claim — flagged, your call]"
export const rateFlag = (who: string) => `[rate unconfirmed — ask ${who} before approving]`
export const gapFlag = (term: string) => `[missing: ${term} — not on your resume]`

/** Any flag still open in a text: a draft holding one is never sent. */
const OPEN_FLAG = /\[(?:rate unconfirmed — [^\]]*|commitment — yours to make|missing: [^\]]*|filing may be in motion — verify by phone|employer claim — flagged, your call)\]/g
export function openFlags(text: string): string[] {
  return [...String(text || "").matchAll(OPEN_FLAG)].map(m => m[0])
}

// ── Never contact ────────────────────────────────────────────────────────────
const alnum = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "")

/**
 * The never-contact entry a recipient matches, or "". An entry is an address ("jane@x.com"), a domain ("x.com", which
 * covers its subdomains) or a name ("Example Staffing", matched against the recipient's domain and display name).
 */
export function neverContactHit(list: string[], to: string, toName = ""): string {
  const email = String(to || "").trim().toLowerCase().replace(/^.*<([^>]+)>.*$/, "$1")
  const domain = email.includes("@") ? email.split("@").pop() || "" : ""
  const labels = domain.split(".").filter(Boolean)
  const base = alnum(labels.slice(0, -1).join("")) // the domain without its ending: "examplestaffing" for examplestaffing.com
  const name = alnum(toName)
  for (const raw of list || []) {
    const e = String(raw || "").trim().toLowerCase()
    if (!e) continue
    if (e.includes("@")) { if (email === e) return raw; continue }
    if (/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(e)) { if (domain === e || domain.endsWith(`.${e}`)) return raw; continue }
    const key = alnum(e)
    if (key.length < 3) continue
    const hit = key.length >= 4
      ? base.includes(key) || labels.some(l => alnum(l) === key) || (!!name && name.includes(key))
      : labels.some(l => alnum(l) === key) || name === key
    if (hit) return raw
  }
  return ""
}

// ── Figures: rates, bill rates, pay rates, prices, salaries ──────────────────
const NUM = String.raw`\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?`
const UNIT = String.raw`(?:\s?(?:\/|per|an?)\s?(?:hr|hour|h|day|week|wk|month|mo|year|yr|annum)\b)`
const FIGURES: RegExp[] = [
  // $85/hr, US$ 90 per hour, USD 120k, ₹ 18 lakh, €70 an hour
  new RegExp(String.raw`(?:US\$|USD\s?|\$|€|£|₹|INR\s?|Rs\.?\s?)\s?(?:${NUM})(?:\s?[kK]\b)?(?:\s?(?:lakhs?|LPA)\b)?${UNIT}?`, "g"),
  // 85 USD, 90 dollars an hour, 18 LPA
  new RegExp(String.raw`\b(?:${NUM})(?:\s?[kK])?\s?(?:USD|dollars|LPA|lakhs?(?:\s+per\s+annum)?)\b${UNIT}?`, "gi"),
  // 85/hr, 85 per hour, 120k per year
  new RegExp(String.raw`\b(?:${NUM})(?:\s?[kK])?\s?(?:\/\s?(?:hr|hour|h|yr|year)\b|per\s+(?:hour|hr|year|annum)\b|an\s+hour\b)`, "gi"),
]
// "the rate would be 85", "salary of 120k", "bill rate: 95": only the number is a figure.
const KEYWORD_FIGURE = /\b(?:bill rate|pay rate|hourly rate|rate|salary|price|pricing|compensation|ctc|budget)\b(\s*(?:is|of|at|would be|will be|=|:|-|~)?\s*(?:around|about|approximately|approx\.?|roughly|~)?\s*)(\d[\d,]*(?:\.\d+)?(?:\s?[kK]\b)?)(?![\d,.]*\s*(?:%|years?|yrs?|months?|weeks?|days?|hours?\b|people|candidates|roles|interviews))/gi

function valueOf(s: string): number | null {
  const m = /(\d[\d,]*(?:\.\d+)?)\s?([kK])?(?:\s?(lakhs?|LPA))?/.exec(s)
  if (!m) return null
  let n = Number(m[1].replace(/,/g, ""))
  if (!Number.isFinite(n)) return null
  if (m[2]) n *= 1000
  else if (m[3]) n *= 100000
  return n
}

/** Every number the person wrote, as a value (so "120k" from him covers "$120,000" in a draft). */
function numbersIn(words: string[]): Set<number> {
  const out = new Set<number>()
  for (const w of words) for (const m of String(w || "").matchAll(/\d[\d,]*(?:\.\d+)?(?:\s?[kK]\b)?/g)) {
    const v = valueOf(m[0])
    if (v !== null) out.add(v)
  }
  return out
}

type Span = { start: number; end: number; text: string; value: number | null }
function figureSpans(text: string): Span[] {
  const spans: Span[] = []
  for (const re of FIGURES) for (const m of text.matchAll(re)) spans.push({ start: m.index!, end: m.index! + m[0].length, text: m[0], value: valueOf(m[0]) })
  for (const m of text.matchAll(KEYWORD_FIGURE)) {
    const start = m.index! + m[0].length - m[2].length
    spans.push({ start, end: start + m[2].length, text: m[2], value: valueOf(m[2]) })
  }
  // Overlaps keep the longest: "$85/hr" wins over the "85/hr" inside it.
  spans.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
  const kept: Span[] = []
  for (const s of spans) if (!kept.length || s.start >= kept[kept.length - 1].end) kept.push(s)
  return kept
}

// ── Claims ───────────────────────────────────────────────────────────────────
const COMMITMENT = /\b(?:I|we)(?:'m|'ll|'d| am| are| will| would| can| hereby| do)?\s+(?:happily\s+|gladly\s+)?(?:(?:be\s+)?(?:happy|glad|willing|like|want) to\s+)?(?:accept|agree to|agree on|commit to|confirm (?:the|my|our|this|that) (?:rate|offer|terms|start date)|take the (?:offer|rate)|sign the (?:offer|contract|rtr|agreement))\b/i
const FILED = /\b(?:you(?:'ve| have)?\s+(?:already\s+)?(?:submitted|filed)\s+(?:me|my\s+(?:profile|resume|candidacy))|(?:we|I)(?:'ve| have)\s+(?:already\s+)?(?:been\s+)?submitted|(?:my|our)\s+(?:profile|resume|candidacy|submission)\s+(?:has been|was|is|got)\s+(?:submitted|filed|in)\b|(?:now that|since|as)\s+(?:I(?:'m| am| was|'ve been| have been)\s+submitted|you\s+submitted)|(?:our|my|the)\s+submission\s+(?:for|to|on)\b)/i
const CLAIM_LEAD = /\b(?:(?:hands-on |strong |solid |deep |extensive |proven )?experience (?:with|in|on)|experienced (?:with|in)|expertise (?:with|in)|proficient (?:with|in)|skilled (?:with|in)|certified in|worked (?:extensively )?(?:with|on)|background in|knowledge of|familiar with)\s+/gi
const NAME = String.raw`[A-Z][\w&.'-]*(?:\s+[A-Z][\w&.'-]*){0,3}`
const EMPLOYER_IN_DRAFT = [
  new RegExp(String.raw`\b(?:[Mm]y\s+)?(?:current|present)\s+employer\s+(?:is|:)\s+(${NAME})`, "g"),
  new RegExp(String.raw`\bI(?:'m| am)\s+(?:currently\s+)?(?:working|employed)\s+(?:at|with|for)\s+(${NAME})`, "g"),
]
const EMPLOYER_ASK = new RegExp(String.raw`\b(?:claim|mention|list|put|show|state|say|use|keep)\s+(?:that\s+)?(${NAME})\s+as\s+(?:your\s+|the\s+)?(?:current|present|recent|latest|last)\s+employer`, "g")

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]/g, "")
const has = (hay: string, term: string) => { const t = norm(term); return t.length > 0 && norm(hay).includes(t) }

function sentenceEnd(text: string, from: number): number {
  const m = /[.!?](?=\s|$)|\n/.exec(text.slice(from))
  return m ? from + m.index + (m[0] === "\n" ? 0 : 1) : text.length
}

const near = (text: string, at: number) => {
  const s = text.slice(Math.max(0, at - 30), at + 40).replace(/\s+/g, " ").trim()
  return `…${s}…`
}

export type GuardInput = {
  subject: string
  body: string
  /** The recipient's address, and their name when known: "ask <name> before approving". */
  to?: string
  toName?: string
  /** The person's own words: their messages to the Chief and their brief. */
  ownWords?: string[]
  /** The text of the person's own resumes (not tailored copies), when it could be read. Null: could not be read. */
  resumeText?: string | null
  /** True only when the thread itself shows the submission was confirmed. */
  filed?: boolean
  /** What the recruiter wrote on the thread, read for an employer claim they asked for. */
  context?: string
}

/** Who to ask about a rate: the recipient's name, else the name in their address, else "the recruiter". */
export function askWho(to = "", toName = ""): string {
  const first = String(toName || "").replace(/<.*$/, "").replace(/["']/g, "").trim().split(/\s+/)[0]
  if (first && /^[\p{L}][\p{L}'.-]{1,29}$/u.test(first)) return first
  const local = String(to || "").split("@")[0].split(/[._-]/)[0]
  return local && /^[a-z]{2,20}$/i.test(local) ? local[0].toUpperCase() + local.slice(1).toLowerCase() : "the recruiter"
}

/** Leave in the draft only what is the person's own; flag the rest in place and list it for the card. */
export function guardDraft(input: GuardInput): { subject: string; body: string; flags: Flag[] } {
  const own = (input.ownWords || []).filter(Boolean)
  const ownText = own.join("\n")
  const resume = input.resumeText ?? null
  const flags: Flag[] = []
  const who = askWho(input.to, input.toName)
  const ownNumbers = numbersIn(own)
  const asked = [...String(input.context || "").matchAll(EMPLOYER_ASK)].map(m => m[1].trim()).filter(n => !has(ownText, n))

  const one = (text: string): string => {
    let out = text
    // Rates and prices: a figure he did not write is replaced by the question.
    for (const s of figureSpans(out).reverse()) {
      if (s.value !== null && ownNumbers.has(s.value)) continue
      out = out.slice(0, s.start) + rateFlag(who) + out.slice(s.end)
      flags.push({ kind: "rate", note: `rate unconfirmed — ask ${who} before approving` })
    }
    // An employer claim a recruiter asked him to make is never echoed.
    for (const name of asked) {
      const re = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")
      if (re.test(out)) out = out.replace(re, EMPLOYER_FLAG)
    }
    // An employer the draft names as current, that his resume does not show.
    for (const re of EMPLOYER_IN_DRAFT) {
      out = out.replace(re, (whole: string, name: string) => {
        if (has(ownText, name) || (resume && has(resume, name))) return whole
        const bare = name.replace(/\.$/, "")
        flags.push({ kind: "employer", note: `the draft named ${bare} as your current employer — flagged, your call` })
        return EMPLOYER_FLAG + (bare === name ? "" : ".")
      })
    }
    // Skills claimed that his resume does not carry: named, never filled.
    const missing: string[] = []
    const edits: { start: number; end: number; term: string }[] = []
    for (const m of out.matchAll(CLAIM_LEAD)) {
      const from = m.index! + m[0].length
      const stop = /[.;:!?\n()]|\s(?:for|to|at|across|which|that|since|while|including|in order)\s|\sand\s(?:I|we)\s/i.exec(out.slice(from))
      const clause = out.slice(from, stop ? from + stop.index : out.length)
      let offset = from
      for (const part of clause.split(/(,\s*|\s+and\s+|\s*\/\s*|\s+&\s+|\s+or\s+)/)) {
        const term = part.trim().replace(/^(?:the|both|multiple|several|various)\s+/i, "")
        const isSep = /^(,\s*|\s+and\s+|\s*\/\s*|\s+&\s+|\s+or\s+)$/.test(part)
        // A tool or a platform reads as one (Splunk, SD-WAN, AWS, C++); plain prose ("large teams") is not a claim to check.
        const named = /[A-Z]/.test(term) || /[-+#./\d]/.test(term)
        if (!isSep && named && /[a-z]/i.test(term) && term.split(/\s+/).length <= 4 && !has(ownText, term)) {
          if (resume && !has(resume, term)) {
            const start = offset + part.indexOf(term)
            edits.push({ start, end: start + term.length, term })
          }
        }
        offset += part.length
      }
    }
    for (const e of edits.sort((a, b) => b.start - a.start)) {
      out = out.slice(0, e.start) + gapFlag(e.term) + out.slice(e.end)
      missing.unshift(e.term)
    }
    if (missing.length) flags.push({ kind: "gap", note: `missing: ${[...new Set(missing)].join(", ")} — not on your resume` })
    // A commitment made for him: the sentence becomes the question.
    if (!COMMITMENT.test(ownText)) {
      out = out.split(/(?<=[.!?])(\s+)/).map(sentence => {
        if (!COMMITMENT.test(sentence)) return sentence
        flags.push({ kind: "commitment", note: "a commitment (accepting, agreeing or signing) — yours to make" })
        return COMMITMENT_FLAG
      }).join("")
    }
    // A submission is never taken as filed unless the thread confirms it or he said so.
    if (!input.filed && !FILED.test(ownText)) {
      const m = FILED.exec(out)
      if (m && !out.includes(FILING_FLAG)) {
        const end = sentenceEnd(out, m.index + m[0].length)
        out = `${out.slice(0, end)} ${FILING_FLAG}${out.slice(end)}`
        flags.push({ kind: "filing", note: `the draft treats a submission as filed (${near(out, m.index)}) — filing may be in motion, verify by phone` })
      }
    }
    return out
  }

  const subject = one(String(input.subject || ""))
  const body = one(String(input.body || ""))
  for (const name of asked) flags.push({ kind: "employer", note: `recruiter asked you to claim ${name} as current employer — flagged, your call` })
  if (resume === null && new RegExp(CLAIM_LEAD.source, "i").test(body)) flags.push({ kind: "unchecked", note: "skills the draft claims could not be checked against your resume (none could be read from Files)" })
  return { subject, body, flags: dedupe(flags) }
}

function dedupe(flags: Flag[]): Flag[] {
  const seen = new Set<string>()
  return flags.filter(f => { const k = `${f.kind}|${f.note}`; if (seen.has(k)) return false; seen.add(k); return true })
}
