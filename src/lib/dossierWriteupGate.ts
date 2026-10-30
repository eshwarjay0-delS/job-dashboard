// Offline gate for PR #126 write-ups (notebook, dossier, synthesis manuscripts). Runs our number check,
// layout check and print-HTML builder over a finished write-up. NOT imported by any route: the live answer
// path and #126's intelligence route are unchanged. maybeGateWriteup is the only hook, and it is a no-op
// unless KOMPAS_DOSSIER_WRITEUP_GATE=1 (off by default).
import { gateFigures, holesIn, bannedFigures, CORE_SECTIONS, CORE_SECTIONS_EXTRA, stripContact, stripLogistics, bannedLogistics } from "./dossierBlueprint.ts"
import { dossierHtml } from "./dossierPdf.ts"
import { dossierCitationWarnings, type DossierSource, type DossierStage } from "./kompas-dossier-bots.ts"

/** Section lists copied from #126's OUTPUT MARKDOWN SECTIONS lines (kompas-dossier-bots.ts @ cd13e73c). */
export const WRITEUP_SECTIONS: Record<DossierStage, string[]> = {
  notebook: ["Source map", "Concept explanations", "Six audience lenses", "Two-voice teaching conversation", "Architecture and failure modes", "Disagreements and corrections", "Hard follow-up tree", "Open evidence questions"],
  dossier: ["Candidate truth ledger", "JD coverage matrix", "Career narrative", "Employer/project evidence cards", "Technical foundations", "Architecture and data flow", "Troubleshooting scenarios", "Human decisions and constraints", "Engineer/architect/director question trees", "Spoken answers", "Contradictions and hot blanks", "Verification and metrics ledger", "Mock panel", "Revision checklist"],
  synthesis: ["Evidence hierarchy", "Master technical and business dossier", "Teaching conversation and conceptual map", "Career-wide intro", "Source-grounded scenario bank", "Question/answer trees by audience", "Critical follow-up challenges", "Evidence gaps and candidate questions", "Consistency and quality audit"],
}

export type WriteupShape = "pr126" | "blueprint" | "old-object" | "empty" | "unknown"
export type WriteupReport = {
  stage: DossierStage; shape: WriteupShape; ok: boolean
  missingSections: string[]; blocked: string[]; banned: string[]; holes: string[]
  citationWarnings: string[]; contactRemoved: number; logistics: string[]; markdown: string; html: string
}

const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim()
function headings(md: string): string[] {
  return [...md.matchAll(/^#{1,4}\s+(?:\d+[.)]\s*)?(.+?)\s*#*$/gm)].map((m) => norm(m[1]))
}
function missingFor(stage: DossierStage, md: string): string[] {
  const hs = headings(md)
  return WRITEUP_SECTIONS[stage].filter((s) => !hs.some((h) => h.startsWith(norm(s))))
}

// [S:resume-1] citations are ids, not figures: hide them from the number check, restore afterwards.
const CITE_RE = /\[S:[A-Za-z0-9_.:-]+\]/g
function maskCites(md: string): { text: string; cites: string[] } {
  const cites: string[] = []
  return { text: md.replace(CITE_RE, (c) => `\u0001${String.fromCharCode(0xE000 + cites.push(c) - 1)}\u0001`), cites }
}
const unmask = (t: string, cites: string[]) => t.replace(/\u0001(.)\u0001/g, (_, ch: string) => cites[ch.charCodeAt(0) - 0xE000] ?? "")

/** Accepts a markdown string (any shape) or an old-shape object; never throws on bad input. */
export function gateWriteup(input: unknown, opts: { stage: DossierStage; sources: DossierSource[]; title?: string }): WriteupReport {
  let md = "", shape: WriteupShape = "unknown"
  if (typeof input === "string") md = input
  else if (input && typeof input === "object" && typeof (input as { markdown?: unknown }).markdown === "string") md = (input as { markdown: string }).markdown
  else if (input && typeof input === "object" && Array.isArray((input as { items?: unknown }).items)) {
    // Old-shape dossier object: render each item's question and answer text so it still gets gated.
    shape = "old-object"
    md = ((input as { items: Array<{ q?: unknown; a?: unknown }> }).items).map((i) =>
      `### ${String(i?.q ?? "")}\n\n${Array.isArray(i?.a) ? i.a.join(" ") : String(i?.a ?? "")}`).join("\n\n")
  }
  if (!md.trim()) shape = "empty"
  const srcText = opts.sources.map((s) => s.text)
  const logistics = bannedLogistics(md)
  const stripped = stripLogistics(stripContact(md))
  const contactRemoved = (stripped.match(/\[contact left out\]/g) || []).length - (md.match(/\[contact left out\]/g) || []).length
  const { text: masked, cites } = maskCites(stripped)
  const g = gateFigures(masked, srcText)
  const gated = unmask(g.text, cites)
  const missingSections = shape === "empty" ? [...WRITEUP_SECTIONS[opts.stage]] : missingFor(opts.stage, gated)
  if (shape === "unknown") {
    if (missingSections.length < WRITEUP_SECTIONS[opts.stage].length) shape = "pr126"
    else if ([...CORE_SECTIONS, ...CORE_SECTIONS_EXTRA].some(([, re]) => re.test(gated))) shape = "blueprint"
  }
  const citationWarnings = shape === "empty" ? ["empty-writeup"] : dossierCitationWarnings(gated, opts.sources)
  // The print builder gates again; already-gated text is a fixed point, so nothing new is blocked here.
  const built = dossierHtml({ title: opts.title || `Kompas ${opts.stage} write-up (gated)`, md: maskCites(gated).text, sources: srcText })
  const html = unmask(built.html, maskCites(gated).cites)
  const banned = bannedFigures(md)
  return {
    stage: opts.stage, shape, markdown: gated, html, blocked: g.blocked, banned, holes: holesIn(gated),
    missingSections, citationWarnings, contactRemoved, logistics,
    ok: shape !== "empty" && shape !== "old-object" && !missingSections.length && !g.blocked.length && !banned.length && !logistics.length && !citationWarnings.length,
  }
}

/** The only hook. Off by default: returns the write-up untouched unless KOMPAS_DOSSIER_WRITEUP_GATE is "1". */
export function writeupGateEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.KOMPAS_DOSSIER_WRITEUP_GATE === "1"
}
export function maybeGateWriteup(md: string, opts: { stage: DossierStage; sources: DossierSource[] }, env: Record<string, string | undefined> = process.env): { markdown: string; report: WriteupReport | null } {
  if (!writeupGateEnabled(env)) return { markdown: md, report: null }
  const report = gateWriteup(md, opts)
  return { markdown: report.markdown, report }
}
