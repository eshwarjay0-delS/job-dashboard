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
export type BlueprintPart = (typeof BLUEPRINT_PARTS)[number]

export const BLUEPRINT_GUIDE: Record<BlueprintPart, string> = {
  evidence: "Cover and evidence base: role, company, round, working model. List every source given and what each can prove. Then a two-source table: | Claim | Supported by | Status | — status is 'resume', 'JD (emphasis only, not experience)', or 'illustrative: rehearse as I would'. End with: a proposed answer is a rehearsal draft, not proof an incident happened.",
  oneminute: "The interview in one minute: what the manager actually needs (numbered), what the role is not, and a one-sentence first-person positioning line. Only from the JD, expectations and notes given.",
  signals: "Signals: 4-8 short phrases quoted exactly from the JD, expectations or notes, each as: > \"quote\" then 'What it changes:' one line about how answers should shift. Never paraphrase inside the quote marks.",
  fixfirst: "Fix before the call: contradictions between what was said in earlier sessions and the resume (employers, dates, titles, tools), plus facts learned about the team. Blunt, one line each. If nothing conflicts, say so.",
  ladder: "Follow-up ladders: for the questions already asked or most likely, the 2nd, 3rd and 4th question an interviewer asks next, each with a one-line note on what it tests.",
  jargon: "Jargon sheet: the JD's terms, each defined in one plain line, then why it matters here. No numbers that are not in the sources.",
}

export const BLUEPRINT_RULES = [
  "First person, speakable. Past tense only where the resume supports it; otherwise 'I would'.",
  "Never invent numbers, incidents, employers, dates or tools. A figure not in the sources is written exactly as " + HOLE + ".",
  "An unknown fact (name, date, tool, outcome) is written as [ ___ confirm before the call: what ] — never guessed.",
  "Never change or repeat the resume name, contact details or dates beyond what the sources show.",
].join("\n")

// AD079 names these Kompas answers as invented. They never come back, whatever digits the sources hold.
const BANNED: RegExp[] = [
  /\b\d[\d,]*[\s-]*point\s+risk\s+(?:tolerance|threshold)\b/gi,
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
  let t = String(text || "")
  for (const re of CONTACT) t = t.replace(re, "[contact left out]")
  return t
}

const FIGURE_RE = /\b\d[\d,.]*\+?(?:\s*(?:%|x\b|years?|yrs?|months?|k\b|M\b))?/g

/** Every figure the sources do not state becomes HOLE. Returns the gated text and what was blocked. */
export function gateFigures(text: string, sources: Array<string | undefined>): { text: string; blocked: string[] } {
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

export function skeletonCheck(md: string, items: DossierItem[]): { ok: boolean; missing: string[]; itemsWithoutAngles: number; itemsWithoutLadder: number; banned: string[] } {
  const missing = CORE_SECTIONS.filter(([, re]) => !re.test(md)).map(([n]) => n)
  const itemsWithoutAngles = items.filter((i) => !i.angles).length
  const itemsWithoutLadder = items.filter((i) => !i.ladder || i.ladder.length < 3).length
  const banned = bannedFigures(md)
  return { ok: !missing.length && !itemsWithoutAngles && !itemsWithoutLadder && !banned.length, missing, itemsWithoutAngles, itemsWithoutLadder, banned }
}
