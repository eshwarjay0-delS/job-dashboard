#!/usr/bin/env node
/**
 * Guards r9 simulator (29 Oct 2026; copy of the speed r6 simulator plus clean-halt counting). OFFLINE ONLY: no model, no network, no token. NOT live timing or live answer quality.
 *   node scripts/kompas-speed-r6-sim.mjs 200|500 [--long]
 * Prep time is REAL CPU time of this branch's code on this machine (before = per-question rebuild + scan retrieval,
 * after = session cache + indexed retrieval). Model time is a VIRTUAL clock with stated assumptions (first token
 * 500 ms, 50 tokens/s, 1.35 tokens per word, a repair call = 600 ms + regenerating the answer). Answers are the
 * stand-in drafts (draftSpokenAnswer) with seeded inventions at the start, middle or end of a third of them.
 */
import { readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"
import { performance } from "node:perf_hooks"
const ROOT = new URL("..", import.meta.url).pathname
const imp = (f) => import(pathToFileURL(`${ROOT}/src/lib/${f}.ts`).href)
const D = await imp("kompasDissection"), R = await imp("kompasSourceRetrieval"), A = await imp("kompasAnswer")
const Gd = await imp("kompasGuards"), Rs = await imp("kompasResume"), C = await imp("kompasSessionCache")
const G = await imp("kompasSentenceGate"), P = await imp("kompasStreamIntegrity"), Rp = await imp("kompasRepair")
const Rel = await imp("kompasRelevance"), Pr = await imp("kompasInterviewPrecision")
const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const { ODD } = await import(pathToFileURL(`${ROOT}/scripts/kompas-grounding-r4-folds.mjs`).href)
const LONG = process.argv.includes("--long")
const T0 = 500, TPS = 50, TPW = 1.35, REPAIR_OVERHEAD = 600
const gen = (words) => (words * TPW / TPS) * 1000
const LEVELS = ["engineer", "architect", "director"]
const COVERED = ["Splunk detections", "Terraform guardrails", "access reviews", "privileged accounts", "leaked API key", "post-incident review", "residual risk", "HIPAA controls", "syslog sources", "noisy SIEM rules", "public S3 buckets", "alert triage"]
const UNCOVERED = ["Kubernetes admission controllers", "Okta SSO rollout", "PCI DSS scoping", "Azure Sentinel", "red team exercises", "SOC 2 Type II audits", "GCP org policies", "zero trust network access"]
const FRAMES = ["Tell me about a time you worked on {t}.", "How did you handle {t}?", "Walk me through {t}.", "What did you personally achieve on {t}?", "How did you lead the team on {t}?", "What is the hardest part of {t}?", "How would you design {t} for a new bank?", "Explain {t} to a new analyst."]
const INVENT = [["At Globex I also did this with Datadog.", /globex|datadog/i], ["That cut the time by 75%.", /75%/], ["I led a large team on it.", /large team/i], ["We sent the logs to datadog.", /datadog/i], ["It protected millions of users.", /millions of users/i], ["It saved the bank $2 million.", /\$2 million/i], ["I personally cut costs by 63% in 4 weeks.", /63%|4 weeks/i]]
// r9: inventions that reuse a number the sources hold, on another noun (the bare-number hole). SIM_R9_INVENT=1 adds them.
if (process.env.SIM_R9_INVENT) INVENT.push(["I rolled it out to 1,200 regions.", /1,200 regions/i], ["That took 1,200 hours.", /1,200 hours/i], ["I did it in 2021 weeks.", /2021 weeks/i])
const q50 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const q95 = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(s.length * 0.95))] : 0 }
const r0 = (x) => Math.round(x)
const r2 = (x) => Math.round(x * 100) / 100
function checks(q, text, tier, level, shape, docs) {
  const structure = A.missingStructure(text, { level, register: "practice", shape, tier })
  const named = Rel.missingNamedQuestionTerms(q, text).map((t) => `the interviewer explicitly named ${t}; explain its relevance`)
  const parts = Pr.questionParts(q).length >= 2 ? Pr.missingQuestionParts(q, text).map((p) => `the interviewer explicitly asked about ${p}`) : []
  const tangents = Rel.tangentSignals(q, text).map((t) => `remove the unasked technical tangent ${t} and keep the direct answer`)
  const src = R.repairLoopSourceChecks(q, text, docs)
  return { core: [...structure, ...named, ...src], all: [...named, ...structure, ...src, ...parts, ...tangents] }
}
function chunks(text) { const w = text.split(/(\s+)/); const out = []; for (let i = 0; i < w.length; i += 3) out.push(w.slice(i, i + 3).join("")); return out }

export function run(n) {
  const m = { n, answers: 0, personal: 0, seeded: 0, shownSeeded: 0, shippedSeeded: 0, gateHalts: 0, clean: 0, cleanChanged: 0, cleanHalts: 0, cleanPersonal: 0, released0: 0, uncovered: 0, honestIdx: 0, promptSame: 0, retrEq: 0, retrN: 0,
    prepB: [], prepA: [], ttfsB: [], ttfsA: [], ttfsOp: [], finB: [], finA: [], repairB: 0, repairA: 0, opener: 0, modes: { engineer: 0, architect: 0, director: 0 } }
  const layouts = Object.keys(ODD)
  C.clearSessionCache(); R.clearSourceIndexCache()
  let prev = []
  for (let i = 0; i < n; i++) {
    const base = ODD[layouts[Math.floor(i / 25) % layouts.length]]
    const resume = LONG ? Array.from({ length: 40 }, (_, k) => base.replace(/Riley Moss/g, `Riley Moss ${String.fromCharCode(65 + (k % 26))}${k >= 26 ? "x" : ""}`)).join("\n").slice(0, 60000) : base
    const docsSrc = S.documents || ""
    const uncovered = i % 5 === 3
    const topic = uncovered ? UNCOVERED[i % UNCOVERED.length] : COVERED[(i * 7) % COVERED.length]
    const q = FRAMES[(i * 3 + Math.floor(i / 8)) % FRAMES.length].replace("{t}", topic)
    const docs = R.sourceDocs({ resume, jd: S.jd, documents: docsSrc, savedQA: S.savedQA })
    // ---- prep, before: everything rebuilt per question, scan retrieval
    let t = performance.now()
    Rs.resumeRoles(resume); Gd.speakFacts({ resume, jd: "", documents: docsSrc, heard: "", identity: "", projects: "" }); Gd.allowedNumbers(resume, docsSrc)
    Rs.resumeDigest(resume, q, 4600, "focused")
    const scan = R.retrievePassages(q, docs, 4, { recent: prev, index: false })
    m.prepB.push(performance.now() - t)
    // ---- prep, after: session cache + index (first question per resume pays the build, counted here)
    t = performance.now()
    const sf = C.sessionFacts(resume, docsSrc); C.cachedDigest(resume, q, 4600, "focused")
    const idx = R.retrievePassages(q, docs, 4, { recent: prev })
    m.prepA.push(performance.now() - t)
    m.retrN++; if (JSON.stringify(idx) === JSON.stringify(scan)) m.retrEq++
    if (uncovered) { m.uncovered++; const pr = R.sourcePassagesPrompt(idx); if (pr.includes(R.NOT_IN_SOURCES)) m.honestIdx++; if (pr === R.sourcePassagesPrompt(scan)) m.promptSame++ }
    const { tier } = A.classify(q)
    const personal = P.answerStreamPolicy(tier, q, { sentenceStream: false }) === "guarded-final"
    const shape = A.pickShape(q, tier) || ""
    LEVELS.forEach((level, j) => {
      m.answers++; m.modes[level]++
      const d = D.draftSpokenAnswer(q, level, resume, prev)
      const sent = D.sentencesOf(d)
      const inv = (i + j) % 3 === 0 ? INVENT[(i + j) % INVENT.length] : null
      const pos = Math.floor((i + j) / 3) % 3
      const at = pos === 0 ? 0 : pos === 1 ? Math.floor(sent.length / 2) : sent.length
      const draft = inv ? [...sent.slice(0, at), inv[0], ...sent.slice(at)].join(" ") : d
      const words = draft.split(/\s+/).filter(Boolean).length
      const ck = checks(q, draft, tier, level, shape, docs)
      const repairCost = REPAIR_OVERHEAD + gen(words)
      const genEnd = T0 + gen(words)
      const finB = genEnd + (ck.all.length ? repairCost : 0)
      const finA = genEnd + (Rp.repairNeedsModel(ck) ? repairCost : 0)
      if (ck.all.length) m.repairB++
      if (Rp.repairNeedsModel(ck)) m.repairA++
      // ---- the shown text, after: sentence gate (personal) — what reaches the screen before the final replace
      let shown = []
      let firstAt = 0
      let opFirst = 0
      if (personal) {
        m.personal++
        const ck0 = G.sentenceCheck({ facts: sf.guardFacts, allowed: sf.allowed, asked: Gd.questionFigures(q), docs, question: q, passages: idx.passages })
        const mk = (opener) => G.createSentenceGate({ check: G.sentenceCheck({ facts: sf.guardFacts, allowed: sf.allowed, asked: Gd.questionFigures(q), docs, question: q, passages: idx.passages }), opener, sourcePassages: G.splitOpenerPassages(docs) })
        const g = mk(null)
        let said = 0
        for (const c of chunks(draft)) { said += c.split(/\s+/).filter(Boolean).length; const rel = g.push(c); if (rel.length && !firstAt) firstAt = T0 + gen(said); shown.push(...rel) }
        const tail = g.finish(); if (tail.length && !firstAt) firstAt = genEnd; shown.push(...tail)
        if (g.halted()) { m.gateHalts++; if (!inv) { m.cleanHalts++; if (process.env.SIM_DEBUG) { const bad = D.sentencesOf(draft).find((x) => !ck0(x)); console.error("HALT", JSON.stringify(bad), R.unsupportedClaims(bad, idx.passages, docs, q), Gd.applyGuards(bad, sf.guardFacts, sf.allowed, Gd.questionFigures(q)).text !== bad) } } }
        if (!inv) m.cleanPersonal++
        if (!shown.length) m.released0++
        // hypothetical Lens opener: the top covering experience passage, verbatim (Lens is not built; shape per its plan)
        const top = idx.matched ? idx.passages.find((p) => p.proves === "experience") : null
        const g2 = mk(top ? { text: top.line, sourceId: top.id, category: "sim", verbatim: true } : null)
        if (g2.start().length) { m.opener++; opFirst = 1 }
      }
      // ---- the final text: full-answer guards + the r4 stand-in source rewrite (same as the existing path)
      const guarded = Gd.applyGuards(draft, sf.guardFacts, sf.allowed, Gd.questionFigures(q)).text
      const flagged = R.repairLoopSourceChecks(q, guarded, docs)
      const final = flagged.length ? D.sentencesOf(guarded).filter((x) => !R.claimSupport(x, idx.passages, docs, q).unsupported.length).join(" ") : guarded
      if (!inv) { m.clean++; if (final.trim() !== draft.trim()) { m.cleanChanged++; if (process.env.SIM_DEBUG) console.error("CHANGED", JSON.stringify(draft), "=>", JSON.stringify(final)) } }
      if (inv) {
        m.seeded++
        if (inv[1].test(shown.join(" "))) m.shownSeeded++
        if (inv[1].test(final)) { m.shippedSeeded++; if (process.env.SIM_DEBUG) console.error("SHIP", inv[0], "=>", (final.match(new RegExp(".{0,60}" + inv[1].source + ".{0,20}", "i")) || [""])[0]) }
      }
      const prepB = m.prepB[m.prepB.length - 1], prepA = m.prepA[m.prepA.length - 1]
      // time to first sentence: before = guarded-final waits for finish; progressive shows the first sentence as it streams
      const firstSentWords = (sent[0] || draft).split(/\s+/).length
      const ttfsB = prepB + (personal ? finB : T0 + gen(firstSentWords))
      const ttfsA = prepA + (personal ? (firstAt || finA) : T0 + gen(firstSentWords))
      m.ttfsB.push(ttfsB); m.ttfsA.push(ttfsA); m.ttfsOp.push(personal && opFirst ? prepA + 1 : ttfsA)
      m.finB.push(prepB + finB); m.finA.push(prepA + finA)
    })
    prev = [D.draftSpokenAnswer(q, "engineer", resume, prev)]
  }
  return m
}
export function report(m) {
  const pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`
  return `OFFLINE guards r9 simulator (speed r6 base), ${m.n} sequences x 3 modes${LONG ? ", ~60k-char resume" : ""} (prep = real CPU on this box; model time = virtual clock: first token ${T0} ms, ${TPS} tok/s). NOT live.
answers: ${m.answers} (engineer ${m.modes.engineer}, architect ${m.modes.architect}, director ${m.modes.director}); personal-history (held) answers: ${m.personal}
prep per question ms p50/p95: before ${r2(q50(m.prepB))}/${r2(q95(m.prepB))}  after ${r2(q50(m.prepA))}/${r2(q95(m.prepA))}
indexed retrieval identical to the scan: ${pct(m.retrEq, m.retrN)}   honest "not in your sources" on uncovered asks: ${pct(m.honestIdx, m.uncovered)} (prompt identical to before: ${pct(m.promptSame, m.uncovered)})
time to first sentence ms p50/p95: before ${r0(q50(m.ttfsB))}/${r0(q95(m.ttfsB))}  after ${r0(q50(m.ttfsA))}/${r0(q95(m.ttfsA))}  after+hypothetical Lens opener ${r0(q50(m.ttfsOp))}/${r0(q95(m.ttfsOp))} (opener approved on ${m.opener}/${m.personal} personal answers)
time to finish ms p50/p95: before ${r0(q50(m.finB))}/${r0(q95(m.finB))}  after ${r0(q50(m.finA))}/${r0(q95(m.finA))}
blocking repair model calls: before ${m.repairB}/${m.answers}  after ${m.repairA}/${m.answers}
personal answers where the gate stopped release at a failing sentence: ${pct(m.gateHalts, m.personal)}; released nothing before the final replace: ${pct(m.released0, m.personal)}
CLEAN (unseeded) personal answers stopped early: ${pct(m.cleanHalts, m.cleanPersonal)}
CLEAN answers whose final text was changed by guards/source filter (false flags): ${pct(m.cleanChanged, m.clean)}
seeded inventions shown on screen before the final replace: ${pct(m.shownSeeded, m.seeded)}   seeded inventions in the final answer: ${pct(m.shippedSeeded, m.seeded)}`
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(report(run(Number(process.argv[2] || 200))))
