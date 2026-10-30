// Lens r7 full-matrix regression (29 Oct 2026). OFFLINE: real prompt builders + the deterministic stand-in composer; no model.
// Per fold i (200): 9 audiences x 3 depths x 1 question category (rotates over 6) x 3 prompt paths (web, desktop switch off,
// desktop switch on) + the levels-core lens label, + T1-T5 on the composer, + opener / lead-in / blank checks.
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { assembled, contradictions, CHECK_AUDIENCES } from "./kompas-lens-prompt-check.mjs"
import { S, variant } from "./kompas-lens-folds.mjs"
import { depthFor, lensBlock, composeLensAnswer, realismMarkers, speakableBlanks, spokenDossierFigure } from "../src/lib/kompasAudience.ts"
import { explainModesAsked } from "../src/lib/kompasDesktopResponse.ts"
import { buildOpenerTable, pickOpener, displayOpener, isSafeDisplay, LEAD_INS, OPENER_SHARE, openerCategory } from "../src/lib/kompasOpener.ts"
import { modeBand } from "../src/lib/kompasDissection.ts"
import { extractClaims } from "../src/lib/kompasSourceRetrieval.ts"
import { allowedNumbers } from "../src/lib/kompasGuards.ts"

vm.runInThisContext(readFileSync(new URL("../public/kompas/levels-core.js", import.meta.url), "utf8"))
const K = globalThis.KompasLevels
const BULLETS = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-lens-r5-bullets.json", import.meta.url), "utf8")).map((b) => b.text)
const SOURCES = [S.resume, S.jd, S.documents]
const ALLOWED = allowedNumbers(...SOURCES)
const AD079 = [/\b800[- ]point\b/i, /\b30[- ]day SLA\b/i, /closure[- ]rate[^.]*\d+%/i]
const FIG = /\$?\b\d[\d,.]*%?/g
const unsourced = (t) => (t.match(FIG) || []).map((f) => f.replace(/[.,]$/, "").replace(/\+/g, "").toLowerCase()).filter((f) => !ALLOWED.has(f) && !ALLOWED.has(f.replace(/%$/, "")))
const words = (s) => s.split(/\s+/).filter(Boolean).length
const syl = (w) => { w = w.toLowerCase().replace(/[^a-z]/g, ""); if (!w) return 0; if (w.length <= 3) return 1; w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, ""); return Math.max(1, (w.match(/[aeiouy]{1,2}/g) || []).length) }
const grade = (t) => { const s = t.split(/[.!?]+/).filter((x) => x.trim()).length || 1; const ws = t.match(/[A-Za-z']+/g) || []; return 0.39 * (ws.length / s) + 11.8 * (ws.reduce((a, w) => a + syl(w), 0) / (ws.length || 1)) - 15.59 }
const COMPOSER = { hr: "hr", technical_hr: "hr", engineer: "practitioner", analyst: "practitioner", architect: "practitioner", developer: "practitioner", director: "director", lead: "director", hiring_manager: "hiring_manager" }
const LEVEL = (a) => /^(?:architect|developer)$/.test(a) ? "architect" : /^(?:director|lead|hiring_manager)$/.test(a) ? "director" : "engineer"
const DEPTH_Q = { simple: (q) => `${q.replace(/[.?]$/, "")}, explained simply?`, standard: (q) => q, deep: (q) => `${q.replace(/[.?]$/, "")}? Go deeper.` }
const CATS = [
  ["definition", (c) => `What is ${c.term}?`], ["comparison", (c) => `What's the difference between ${c.term} and a VPN?`],
  ["scenario", (c) => `How would you roll out ${c.term} next quarter?`], ["experience-story", (c) => `Tell me about a time you used ${c.term}.`],
  ["introduction", () => "Introduce yourself."], ["general", (c) => `Why does ${c.term} matter?`],
]
const SHAPE = { definition: "definition", comparison: "comparison", scenario: "scenario", "experience-story": "personal-experience", introduction: "intro", general: "direct" }

export function runMatrix(N = 200) {
  const c = { prompts: 0, contra: 0, lensOk: 0, depthOk: 0, explainOk: 0, explainN: 0, openerPromptOk: 0, openerPromptN: 0, levelsOk: 0, levelsN: 0,
    T1: 0, T1n: 0, T2v: 0, T2n: 0, T3: 0, T3n: 0, T4: 0, T4n: 0, T5: 0, T5n: 0, T5dated: 0, T5tic: 0,
    opener: 0, openerN: 0, byKind: {}, seen: {}, notCovered: 0, notCoveredN: 0, properKept: 0, properN: 0, leadIn: 0, leadInN: 0, blank: 0, blankN: 0, empty: 0, emptyN: 0, bad: [] }
  const bad = (k, x) => { c.byKind[k] = (c.byKind[k] || 0) + 1; if ((c.seen[k] = (c.seen[k] || 0) + 1) <= 4) c.bad.push(`${k}: ${x}`) }
  for (let i = 0; i < N; i++) {
    const v = variant(i); const [cat, mk] = CATS[i % CATS.length]
    const bullet = BULLETS[i % BULLETS.length]
    const src = { resume: bullet }
    const { table } = buildOpenerTable([{ id: `b:${i}`, sourceDoc: "resume", category: cat in { "experience-story": 1, introduction: 1 } ? cat : "experience-story", text: bullet, status: "sourced" }], src)
    for (const depth of ["simple", "standard", "deep"]) {
      const q = DEPTH_Q[depth](mk(v.concept))
      const claimSets = []
      for (const a of CHECK_AUDIENCES) {
        const ceiling = modeBand(SHAPE[cat], LEVEL(a)).targetWords
        const op = pickOpener(table, q, { passages: [{ id: `b:${i}` }] }, ceiling, (o) => o.text === bullet) // r7: matched + guard-approved
        c.notCoveredN++; if (pickOpener(table, q, null, ceiling) === null && pickOpener(table, q, { passages: [{ id: `b:${i}` }] }, ceiling, () => false) === null) c.notCovered++
        for (const path of ["web", "desktop", "desktop+lens"]) {
          const t = assembled(a, q, path, op === null && openerCategory(q) !== "experience-story" && openerCategory(q) !== "introduction" ? undefined : op)
          c.prompts++
          const cs = contradictions(t); if (cs.length) { c.contra++; bad("contra", `${path}|${a}|${q}|${cs[0].id}`) }
          const lens = (t.match(/\bLENS [A-Z]/g) || []).length, real = (t.match(/\bREALISM\b/g) || []).length
          const lensWant = path === "desktop" ? 0 : 1
          if (lens === lensWant && (path === "desktop" ? real === 0 : real >= 1)) c.lensOk++; else bad("lens", `${path}|${a}|${q}|lens=${lens} realism=${real}`)
          if (path !== "desktop") { if (t.includes(`DEPTH ${depthFor(q)}`)) c.depthOk++; else bad("depth", `${path}|${a}|${q}|${depthFor(q)}`) } else c.depthOk++
          if (path !== "web") { c.explainN++; if (/EXPLAIN MODES/.test(t) === explainModesAsked(q)) c.explainOk++; else bad("explain", `${path}|${a}|${q}`) }
          if (op) { c.openerPromptN++; if (t.includes(`OPENER ALREADY SPOKEN: "${displayOpener(op)}"`)) c.openerPromptOk++; else bad("openerPrompt", `${path}|${a}|${q}`) }
        }
        // levels-core (browser) shows the same lens the prompt uses
        c.levelsN++; const L = K.lensFor(a), lb = lensBlock(a, q)
        if (lb.startsWith(`LENS ${L.label.split(" / ")[0]}`) && lb.includes(`open with ${L.opens}`)) c.levelsOk++; else bad("levels-core", `${a}: ${L.label} vs ${lb.slice(0, 40)}`)
        // T1-T5 on the stand-in composer
        const lensId = depth === "simple" ? "simple" : COMPOSER[a]
        const ans = composeLensAnswer({ question: q, lens: lensId, depth, concept: v.concept, facts: v.facts, sources: SOURCES })
        claimSets.push([...new Set(extractClaims(ans).map((x) => x.toLowerCase()))].sort().join("|"))
        c.T2n++; if (unsourced(ans).length || AD079.some((r) => r.test(ans))) { c.T2v++; bad("T2", `${a}|${q}|${unsourced(ans)}`) }
        if (depth === "simple") { c.T3n++; const named = ans.toLowerCase().split(v.concept.term.toLowerCase()).length - 1; if (grade(ans) <= 8 && named >= 1) c.T3++ }
        if (explainModesAsked(q)) { c.T4n++; const m = realismMarkers(ans); if (m.challenge && m.resolve) c.T4++ }
        if (depth !== "simple") { c.T5n++; const m = realismMarkers(ans, SOURCES); if (m.tradeoff + m.ownership >= 1) c.T5++; c.T5dated += m.unsourcedDated; if (m.tics > 1) c.T5tic++ }
        // opener and lead-in
        if (op) {
          c.openerN++
          const okShare = words(displayOpener(op)) <= Math.floor(ceiling * OPENER_SHARE)
          if (okShare && op.text === bullet && isSafeDisplay(op, displayOpener(op))) c.opener++; else bad("opener", `${a}|${q}|${displayOpener(op)}`)
          c.properN++; { const f = op.text.split(/\s+/)[0]; const d = displayOpener(op).slice(op.leadIn.length); if (/^[A-Z][A-Z0-9]|^[A-Z][a-z]+[A-Z]/.test(f) ? d.startsWith(f) : true) c.properKept++ }
          c.leadInN++; if (LEAD_INS.concat([""]).includes(op.leadIn) && !/\d/.test(op.leadIn)) c.leadIn++
        }
        c.emptyN++; if (pickOpener(buildOpenerTable([], src).table, q, null, ceiling) === null) c.empty++
      }
      c.T1n++; if (claimSets.every((s) => s === claimSets[0])) c.T1++; else bad("T1", `${q}`)
      // blanks: a dossier hole is never spoken as "[ ___ ]"; a sourced figure is said as is
      c.blankN++
      const spoken = speakableBlanks(`I owned the triage queue. I cut alert triage time by [ ___ confirm: your actual figure ].`)
      if (!/\[\s*_/.test(spoken) && /confirm the exact figure/.test(spoken) && spokenDossierFigure("cut triage time", "35%", ALLOWED).endsWith(ALLOWED.has("35%") || ALLOWED.has("35") ? "by 35%" : "before I quote it")) c.blank++
    }
  }
  return c
}
if (import.meta.url === `file://${process.argv[1]}`) {
  const t0 = Date.now(); const c = runMatrix(Number(process.argv[2] || 200)); const pct = (a, b) => `${a}/${b} (${(100 * a / (b || 1)).toFixed(1)}%)`
  console.log(`OFFLINE full matrix, ${process.argv[2] || 200} folds, ${c.prompts} assembled prompts, ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  console.log(`contradictions: ${c.contra} prompts`); console.log(`lens/realism blocks right: ${pct(c.lensOk, c.prompts)}`); console.log(`depth line right: ${pct(c.depthOk, c.prompts)}`)
  console.log(`explain modes iff asked (desktop paths): ${pct(c.explainOk, c.explainN)}`); console.log(`opener prompt quotes display form: ${pct(c.openerPromptOk, c.openerPromptN)}`)
  console.log(`levels-core lens = prompt lens: ${pct(c.levelsOk, c.levelsN)}`)
  console.log(`T1 same claims across 9 audiences: ${pct(c.T1, c.T1n)}`); console.log(`T2 unsourced/AD079 numbers: ${c.T2v} in ${c.T2n} answers`)
  console.log(`T3 simple grade<=8, term named: ${pct(c.T3, c.T3n)}`); console.log(`T4 challenge+resolve when explain asked: ${pct(c.T4, c.T4n)}`)
  console.log(`T5 tradeoff/ownership: ${pct(c.T5, c.T5n)}; dated ${c.T5dated}; over-tic ${c.T5tic}`)
  console.log(`opener (share, exact text, safe display): ${pct(c.opener, c.openerN)}; lead-in from list: ${pct(c.leadIn, c.leadInN)}; empty table -> none: ${pct(c.empty, c.emptyN)}; not covered/refused -> none: ${pct(c.notCovered, c.notCoveredN)}; acronym first word kept: ${pct(c.properKept, c.properN)}; blanks: ${pct(c.blank, c.blankN)}`)
  console.log("problems by kind:", JSON.stringify(c.byKind)); console.log("first problems:"); c.bad.forEach((b) => console.log("  " + b))
}
