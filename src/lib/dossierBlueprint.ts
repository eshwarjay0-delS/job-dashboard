// Dossier blueprint (research/dossier-blueprint.md): the parts, item shape and figure gate the ChatGPT-style
// dossier engine shares. Additive: the persona and section routes keep every existing part and field; these are
// optional extras. The gate is the dossier's version of the metric rule (notebooklm-lens-spec.md §4): a figure
// the sources do not state is never reworded into a softer claim here; it becomes a visibly marked hole the
// candidate fills before the call.
import { allowedNumbers, needsGuard } from "./kompasGuards.ts"

export const HOLE = "[ ___ confirm: your actual figure ]"
export const HOLE_RE = /\[ ___ [^\]]*\]/g

/** New persona parts, in blueprint order. The existing parts (cover, who, projects, …) are unchanged. */
export const BLUEPRINT_PARTS = ["evidence", "oneminute", "signals", "fixfirst", "ladder", "jargon"] as const
/** Round-5 parts, additive: BLUEPRINT_PARTS above is unchanged and still the default order. */
export const BLUEPRINT_PARTS_EXTRA = ["whycompany", "first30", "onepage", "riskxlate"] as const
export type BlueprintPart = (typeof BLUEPRINT_PARTS)[number] | (typeof BLUEPRINT_PARTS_EXTRA)[number]

export const BLUEPRINT_GUIDE: Record<BlueprintPart, string> = {
  evidence: "Cover and evidence base: role, company, round. List every source given and what each can prove. Then a two-source table: | Claim | Supported by | Status | — status is 'resume', 'JD (emphasis only, not experience)', or 'illustrative: rehearse as I would'. End with: a proposed answer is a rehearsal draft, not proof an incident happened.",
  oneminute: "The interview in one minute: what the manager actually needs (numbered), what the role is not, and a one-sentence first-person positioning line. Only from the JD, expectations and notes given.",
  signals: "Signals: 4-8 short phrases quoted exactly from the JD, expectations or notes, each as: > \"quote\" then 'What it changes:' one line about how answers should shift. Never paraphrase inside the quote marks.",
  fixfirst: "Fix before the call: contradictions between what was said in earlier sessions and the resume (employers, dates, titles, tools), plus facts learned about the team. Blunt, one line each. If nothing conflicts, say so.",
  ladder: "Follow-up ladders: for the questions already asked or most likely, the 2nd, 3rd and 4th question an interviewer asks next, each with a one-line note on what it tests.",
  jargon: "Jargon sheet: the JD's terms, each defined in one plain line, then why it matters here. No numbers that are not in the sources.",
  whycompany: "Why this company: a dated company snapshot ('As of <date>, public sources only') where every fact carries its public source link and a quoted line; a fact with no public source given is a marked hole, never recalled from memory. Then a first-person 'why here' answer that ties two or three snapshot facts to the JD and to resume work only.",
  first30: "The first 30 minutes: a minute-by-minute outline of how the call likely opens (introductions, the tell-me-about-yourself, the first technical probe, my questions) with what I say at each step. Timings are a plan, not a claim.",
  onepage: "One-page summary: positioning line, three strongest resume-backed proofs, the open holes to fill, three questions I will ask, and the one thing not to say. Must fit one printed page.",
  riskxlate: "Technical-to-risk translations: a table | Technical thing | What it means as risk | How I would say it |. Each row ties a resume or JD term to the business risk in one plain sentence. No figures not in the sources.",
}

export const BLUEPRINT_RULES = [
  "First person, speakable. Past tense only where the resume supports it; otherwise 'I would'.",
  "Never invent numbers, incidents, employers, dates or tools. A figure not in the sources is written exactly as " + HOLE + ".",
  "An unknown fact (name, date, tool, outcome) is written as [ ___ confirm before the call: what ] — never guessed.",
  "Never change or repeat the resume name, contact details or dates beyond what the sources show.",
  "No logistics: never write about visa or work authorization, citizenship, pay or rates, relocation, current location, address, start date, contract terms, or on-site/remote/hybrid arrangements, even if a source mentions them. Only resume-derived experience and the role's work.",
].join("\n")

// Eshwar's rule (29 Oct 2026): no logistics anywhere in a dossier or answer. Phrases, not bare words, so
// "address the root cause" or "relocated the pipeline" are not caught.
const LOGISTICS: RegExp[] = [
  /\b(?:visa|h-?1b|green\s*card|sponsorship|sponsor\s+(?:me|my|a\s+visa)|work\s+authori[sz]ation|authori[sz]ed\s+to\s+work|citizen(?:ship)?|work\s+permit|\bOPT\b|EAD)\b/gi,
  /\b(?:salary|compensation|pay\s+(?:rate|range|expectations?)|hourly\s+rate|bill\s+rate|rate\s+expectations?|per\s+hour)\b/gi,
  /\b(?:relocat(?:e|ion|ing)\b(?!\s+(?:the|a|an|our|my|its)\s+(?:log|pipeline|data|bucket|service|server|workload|database)))/gi,
  /\b(?:current(?:ly)?\s+(?:location|located|based)|where\s+(?:are\s+you|I\s+am|I'm)\s+(?:located|based)|local\s+to|commut(?:e|ing)|home\s+address|mailing\s+address|street\s+address)\b/gi,
  /\b(?:start\s+date|notice\s+period|available\s+to\s+start|when\s+(?:could|can|would)\s+you\s+start)\b/gi,
  /\b(?:on-?site|in-?office|in\s+office|hybrid|(?:fully\s+|not\s+)?remote\s*(?:role|position|work|job)?(?=\W)|work\s+from\s+home|days?\s+(?:a|per|each)\s+week|working\s+model|return\s+to\s+office)\b/gi,
  /\b(?:contract\s+(?:length|term|duration|terms)|conversion\s+to\s+(?:full-?time|FTE|perm)|contract-to-hire|w-?2|c2c|1099)\b/gi,
  /^#{1,4}\s.*\blogistics\b/gim,
]
export function bannedLogistics(text: string): string[] {
  const out: string[] = []
  for (const re of LOGISTICS) for (const m of String(text || "").matchAll(new RegExp(re.source, re.flags))) out.push(m[0].trim())
  return out
}
/** Drops every line that carries logistics; a heading naming logistics drops its whole section. */
export function stripLogistics(md: string): string {
  const out: string[] = []
  let skipLevel = 0
  for (const line of String(md || "").split("\n")) {
    const h = /^(#{1,4})\s/.exec(line)
    if (skipLevel && h && h[1].length <= skipLevel) skipLevel = 0
    if (skipLevel) continue
    if (h && /\blogistics\b/i.test(line)) { skipLevel = h[1].length; continue }
    if (bannedLogistics(line).length) continue
    out.push(line)
  }
  return out.join("\n")
}

// AD079 names these Kompas answers as invented. They never come back, whatever digits the sources hold.
const BANNED: RegExp[] = [
  /\b\d[\d,]*[\s-]*point\s+risk\s+(?:tolerance|threshold)\b/gi,
  /\b(?:risk\s+)?(?:tolerance|threshold)\s+of\s+\d[\d,]*[\s-]*points?\b/gi,
  /\b(?:fixed\s+)?\d+[\s-]*day\s+SLA\b/gi,
  /\bclosure[\s-]+rates?\b[^.\n]{0,40}?\d+(?:\.\d+)?\s*%/gi,
  /\b\d+(?:\.\d+)?\s*%[^.\n]{0,30}?\bclosure[\s-]+rates?\b/gi,
]
export function bannedFigures(text: string): string[] {
  const out: string[] = []
  for (const re of BANNED) for (const m of String(text || "").matchAll(new RegExp(re.source, re.flags))) out.push(m[0])
  return out
}

const CONTACT: RegExp[] = [
  /[\w.+-]+@[\w-]+\.[\w.]+/g,
  /(?:\+?1[\s.-]?)?\(?\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/g,
  /\bhttps?:\/\/\S+/g,
  /\b(?:www\.)?linkedin\.com\/\S*/gi,
]
export function stripContact(text: string): string {
  // A public source link on a snapshot citation line ("> Source S1: ...") is a citation, not contact detail;
  // every other URL, and any email, phone or LinkedIn on any line, is still removed.
  return String(text || "").split("\n").map((line) => {
    const cite = /^\s*> Source S\d+:/.test(line)
    let t = line
    for (const re of CONTACT) {
      if (cite && re.source.startsWith("\\bhttps?")) { t = t.replace(re, (u) => /linkedin|teams\.|zoom\.|calendly|mailto/i.test(u) ? "[contact left out]" : u); continue }
      t = t.replace(re, "[contact left out]")
    }
    return t
  }).join("\n")
}

const FIGURE_RE = /\b\d[\d,.]*\+?(?:\s*(?:%|x\b|years?|yrs?|months?|k\b|M\b))?/g

/** Every figure the sources do not state becomes HOLE. Returns the gated text and what was blocked. */
const NUM_WORD = "two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|dozen|dozens|hundreds|thousands"
const NUM_NOUN = "percent|per cent|analysts|engineers|people|staff|teams|tickets|findings|alerts|incidents|issues|hours|days|weeks|months|years|servers|hosts|endpoints|controls|applications|apps|vendors|clients|users|accounts"
const WORD_CLAIM_RE = new RegExp(`\\b(?:(?:${NUM_WORD})(?:[\\s-]+(?:${NUM_WORD}))?\\s+(?:${NUM_NOUN})|halved|doubled|tripled|quadrupled|tenfold)\\b`, "gi")
const RANGE_RE = /(\d[\d,.]*)\s*[-\u2013]\s*(\d[\d,.]*)(\s*%)?/g

/** Every figure the sources do not state becomes HOLE. Also closes three gaps found by probing (round 6):
 *  numeric ranges (each end must be sourced), full-width digits (NFKC first), and spelled-number claims. */
export function gateFigures(text: string, sources: Array<string | undefined>): { text: string; blocked: string[] } {
  const src = sources.map((x) => String(x || "").normalize("NFKC"))
  const lowSrc = src.join("\n").toLowerCase()
  const blocked: string[] = []
  let t = String(text || "").normalize("NFKC")
  t = t.replace(RANGE_RE, (m, a: string, b: string, pct: string | undefined, at: number, full: string) => {
    const p = pct ? "%" : ""
    // Only a quantity range is a claim: "70-80%", "10-15 tickets", "between 3-5". Identifiers and
    // labels ("NIST 800-53", "Minute 0-2", "pages 3-4") are left to the core check's own rules.
    const after = full.slice(at + m.length, at + m.length + 24)
    const before = full.slice(Math.max(0, at - 12), at)
    const quantity = !!pct || new RegExp(`^\\s*(?:k\\b|M\\b|x\\b|${NUM_NOUN})`, "i").test(after) || /\b(?:from|between|within|about|around|roughly)\s*$/i.test(before)
    if (!quantity) return m
    const bad = gateFiguresCore(`${a}${p}`, src).blocked.length || gateFiguresCore(`${b}${p}`, src).blocked.length
    if (!bad) return m
    blocked.push(m.trim()); return HOLE
  })
  t = t.replace(WORD_CLAIM_RE, (m) => { if (lowSrc.includes(m.toLowerCase())) return m; blocked.push(m); return HOLE })
  const core = gateFiguresCore(t, src)
  return { text: core.text, blocked: [...blocked, ...core.blocked] }
}

function gateFiguresCore(text: string, sources: Array<string | undefined>): { text: string; blocked: string[] } {
  // List markers in a source ("1. ", "## 3. ") are structure: they must not whitelist "3 weeks" or "6 analysts".
  const allowed = allowedNumbers(...sources.map((x) => String(x || "").replace(/^(\s*(?:#+\s*)?)\d+[.)]\s/gm, "$1")))
  const blocked: string[] = []
  let t = String(text || "")
  for (const re of BANNED) t = t.replace(new RegExp(re.source, re.flags), (m) => { blocked.push(m); return HOLE })
  const lines = t.split("\n").map((line) => line.replace(FIGURE_RE, (fig: string, at: number, full: string) => {
    const before = full.slice(0, at)
    const after = full.slice(at + fig.length)
    // A markdown list or heading number ("1. ", "## 3. ") is structure, not a claim.
    if (/^\s*(?:#+\s*)?$/.test(before) && /^\d+\.$/.test(fig) && /^\s/.test(after)) return fig
    if (/^\s*(?:#+\s*)?$/.test(before) && /^\d+$/.test(fig) && /^[.)]\s/.test(after)) return fig
    // A dossier cross-reference ("Arc 4", "item 2", "section 7", "rung 3") is a label, not a claim.
    if (/^\d{1,2}\.?$/.test(fig) && /\b(?:arc|item|section|part|angle|question|rung|page|volume)\s+$/i.test(before)) return fig
    // Mask every other digit so needsGuard judges this one figure in its own sentence.
    const masked = full.slice(0, at).replace(/\d/g, "N") + fig + full.slice(at + fig.length).replace(/\d/g, "N")
    const core = fig.replace(/\.$/, "")
    if (!needsGuard(masked, allowed) || !needsGuard(masked.replace(fig, core), allowed)) return fig
    blocked.push(fig.trim())
    return (/\$$/.test(before) ? "\u0000" : "") + HOLE + (/\.$/.test(fig) && !/^\d/.test(after) ? "." : "")
  }))
  return { text: lines.join("\n").replace(/\$\u0000/g, ""), blocked }
}

export function holesIn(text: string): string[] {
  return String(text || "").match(HOLE_RE) || []
}

export type Angles = { direct: string; architect: string; brownfield: string }
export type DossierItem = {
  q: string
  a: string[]
  angles?: Angles
  ladder?: string[]
  failure?: string
  opener?: string
  [k: string]: unknown
}

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "")

/** Old items pass through with their fields; angles/ladder/failure are added only when present and complete. */
export function normalizeItem(raw: unknown): DossierItem {
  const o = (raw || {}) as Record<string, unknown>
  const item: DossierItem = { ...o, q: s(o.q, 300), a: Array.isArray(o.a) ? o.a.map((x) => s(x, 600)).filter(Boolean).slice(0, 6) : [] }
  delete item.angles; delete item.ladder; delete item.failure; delete item.opener
  const opener = s(o.opener, 300)
  if (opener) item.opener = opener
  const g = (o.angles || {}) as Record<string, unknown>
  const angles = { direct: s(g.direct, 1200), architect: s(g.architect, 1200), brownfield: s(g.brownfield, 1200) }
  if (angles.direct && angles.architect && angles.brownfield) item.angles = angles
  const ladder = Array.isArray(o.ladder) ? o.ladder.map((x) => s(x, 300)).filter(Boolean).slice(0, 3) : []
  if (ladder.length === 3) item.ladder = ladder
  const failure = s(o.failure, 600)
  if (failure) item.failure = failure
  return item
}

/** Gate every text field of an item. */
export function gateItem(item: DossierItem, sources: string[]): { item: DossierItem; blocked: string[] } {
  const blocked: string[] = []
  const g = (t: string) => { const r = gateFigures(stripContact(t), sources); blocked.push(...r.blocked); return r.text }
  const out: DossierItem = { ...item, q: g(item.q), a: item.a.map(g) }
  if (item.angles) out.angles = { direct: g(item.angles.direct), architect: g(item.angles.architect), brownfield: g(item.angles.brownfield) }
  if (item.ladder) out.ladder = item.ladder.map(g)
  if (item.failure) out.failure = g(item.failure)
  if (item.opener) out.opener = g(item.opener)
  return { item: out, blocked }
}

// T6: the 8 core sections a dossier must carry (blueprint skeleton 1, 2, 4, 5, 7, 8, 11, 12).
export const CORE_SECTIONS: Array<[string, RegExp]> = [
  ["evidence base", /^#{1,3} .*evidence base/im],
  ["interview in one minute", /^#{1,3} .*in one minute/im],
  ["fix before the call", /^#{1,3} .*fix (?:first|before)/im],
  ["positioning", /^#{1,3} .*positioning/im],
  ["answer architecture", /^#{1,3} .*answer architecture/im],
  ["story arcs", /^#{1,3} .*(?:story arcs|projects)/im],
  ["questions three ways", /^#{1,3} .*three ways/im],
  ["follow-up ladders", /^#{1,3} .*ladder/im],
]

export const CORE_SECTIONS_EXTRA: Array<[string, RegExp]> = [
  ["why this company", /^#{1,3} .*why (?:bny|this company|here)/im],
  ["company snapshot", /^#{1,3} .*company snapshot/im],
  ["first 30 minutes", /^#{1,3} .*first 30 minutes/im],
  ["one-page summary", /^#{1,3} .*one-page summary/im],
  ["technical-to-risk translations", /^#{1,3} .*technical[- ]to[- ]risk/im],
]

export type SnapshotFact = { text: string; quote?: string; url?: string; title?: string; published?: string; need?: string; reason?: string }
/** Dated company snapshot. A fact stays only with an https source and a quoted line, and every figure in
 *  it must appear in that quote; anything else is a marked hole. Nothing is recalled from model memory. */
export function companySnapshot(o: { company: string; asOf: string; facts: SnapshotFact[] }): { md: string; holes: string[]; blocked: string[]; cited: number } {
  const blocked: string[] = [], holes: string[] = []
  let cited = 0
  const rows = o.facts.map((f, i) => {
    if (!f.url || !/^https:\/\//.test(f.url) || !f.quote) {
      const h = `[ ___ confirm before the call: ${f.need || f.text} (${f.reason || "no public source found"}) ]`
      holes.push(h); return `- ${h}`
    }
    const g = gateFigures(f.text, [f.quote])
    blocked.push(...g.blocked); holes.push(...holesIn(g.text))
    cited++
    return `- ${g.text} [S${i + 1}]\n  > "${f.quote}"\n  > Source S${i + 1}: ${f.title || f.url}${f.published ? ", " + f.published : ""} (${f.url})`
  })
  return { md: `### Company snapshot: ${o.company} (as of ${o.asOf}, public sources only)\n\n${rows.join("\n")}\n`, holes, blocked, cited }
}

export type RiskRow = { technical: string; risk: string; say: string; source: string }
/** Technical-to-risk table: every cell is gated against the row's own source text. */
export function riskTranslations(rows: RiskRow[], sources: Array<string | undefined>): { md: string; blocked: string[] } {
  const blocked: string[] = []
  const cell = (t: string, src: string) => { const g = gateFigures(t, [src, ...sources]); blocked.push(...g.blocked); return g.text.replace(/\|/g, "/") }
  const body = rows.map((r) => `| ${cell(r.technical, r.source)} | ${cell(r.risk, r.source)} | ${cell(r.say, r.source)} |`)
  return { md: ["| Technical thing | What it means as risk | How I would say it |", "| --- | --- | --- |", ...body].join("\n") + "\n", blocked }
}

export function skeletonCheck(md: string, items: DossierItem[], opts: { full?: boolean } = {}): { ok: boolean; missing: string[]; itemsWithoutAngles: number; itemsWithoutLadder: number; banned: string[]; logistics: string[] } {
  const missing = [...CORE_SECTIONS, ...(opts.full ? CORE_SECTIONS_EXTRA : [])].filter(([, re]) => !re.test(md)).map(([n]) => n)
  const itemsWithoutAngles = items.filter((i) => !i.angles).length
  const itemsWithoutLadder = items.filter((i) => !i.ladder || i.ladder.length < 3).length
  const banned = bannedFigures(md)
  const logistics = bannedLogistics(md)
  return { ok: !missing.length && !itemsWithoutAngles && !itemsWithoutLadder && !banned.length && !logistics.length, missing, itemsWithoutAngles, itemsWithoutLadder, banned, logistics }
}
