#!/usr/bin/env node
/**
 * r7 folds (29 Oct 2026). OFFLINE, CODE-LEVEL ONLY: no model, no network, no token. NOT live answer quality.
 *   node scripts/kompas-grounding-r7-folds.mjs 200|500     (KOMPAS_ROOT=/other/checkout measures that code as "before")
 * Uses the r7 realism banks (two fictional dossiers: data engineering, backend) as multi-turn sequences with voice noise,
 * follow-ups, pushbacks, wrong-premise asks, coding and design asks. Each heard ask goes through questionForAnswer (the
 * production question step); the "answer" is the stand-in draft (draftSpokenAnswer) at the sequence's mode, judged by the
 * r7 detectors (scripts/kompas-eval-hardening.mjs) and the per-surface rule (#27).
 */
import { pathToFileURL, fileURLToPath } from "node:url"
import { sequences } from "./kompas-realism-banks.mjs"
import * as H from "./kompas-eval-hardening.mjs"
import { normalizeAskText } from "../src/lib/kompasAskText.ts"
import { spokenSurface, surfaceViolations } from "../src/lib/kompasSurfaceRule.ts"
const ROOT = process.env.KOMPAS_ROOT || fileURLToPath(new URL("..", import.meta.url))
const D = await import(pathToFileURL(`${ROOT}/src/lib/kompasDissection.ts`).href)
const A = await import(pathToFileURL(`${ROOT}/src/lib/kompasAnswer.ts`).href)
const Rel = await import(pathToFileURL(`${ROOT}/src/lib/kompasRelevance.ts`).href)
const LEVELS = ["engineer", "director", "architect"]
const DBG = process.env.R7_DEBUG ? (...a) => console.error(...a) : () => {}
const pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`
const NAME = { "data-engineering": "Dana", backend: "Sam" }

export function run(n) {
  const m = { n, turns: 0, answers: 0, blank: 0, failsByKind: {}, detector: {}, coding: 0, codingIntent: 0, codingAck: 0, codingPrompt: 0, noisyCoding: 0, noisyCodingOk: 0,
    spokenChecked: 0, spokenClean: 0, premise: 0, premiseAdopted: 0, pairs: 0, dupes: 0, modeSets: 0, modeOk: 0, push: 0, pushOk: 0, invented: 0 }
  const seqs = sequences(n, 7)
  for (const s of seqs) {
    const history = []
    for (const turn of s.turns) {
      m.turns++
      const q = A.questionForAnswer(turn.q, "", false, false, history.slice(-3))
      const drafts = Object.fromEntries(LEVELS.map((lv) => [lv, D.draftSpokenAnswer(q, lv, s.resume, history.map((h) => h.a))]))
      const text = drafts[s.level]
      m.answers++
      if (!String(text).trim()) m.blank++
      const isCode = turn.kind === "coding"
      if (isCode) {
        m.coding++
        const clean = normalizeAskText(turn.q)
        const intentOk = D.asksForCode(q) && D.asksForCode(turn.q)
        m.codingIntent += intentOk ? 1 : 0; if (!intentOk) DBG("CODEINTENT", JSON.stringify(turn.q), "=>", q)
        const ack = Rel.interviewIntent(turn.q) === "acknowledgement" || Rel.interviewIntent(clean) === "acknowledgement"
        m.codingAck += ack ? 1 : 0; if (ack) DBG("ACK", turn.q)
        m.codingPrompt += /Code first/.test(D.dissectionPrompt(q, s.level, s.resume)) ? 1 : 0
        if (turn.q !== clean) { m.noisyCoding++; m.noisyCodingOk += D.asksForCode(turn.q) === D.asksForCode(clean) ? 1 : 0 }
      }
      // Detectors. A stand-in draft never contains code, so the card fence rule is judged on the prompt (above) for
      // coding asks and on the draft for every other ask.
      const codeAsk = isCode || D.asksForCode(q)
      const fails = H.answerFailures({ question: q, text, sources: s.resume, surface: "card", premise: turn.premise || "", name: NAME[s.role] })
        .filter((f) => !(codeAsk && /surface/.test(f)))
      for (const f of fails) { const k = f.replace(/:.*$/, "").replace(/".*"/, "premise"); m.detector[k] = (m.detector[k] || 0) + 1; (m.failsByKind[turn.kind] ||= 0); m.failsByKind[turn.kind]++; DBG("FAIL", turn.kind, f, "|", turn.q, "|", text) }
      if (fails.some((f) => /numbers not in/.test(f))) m.invented++
      m.spokenChecked++; const said = spokenSurface(text); const sv = surfaceViolations(q, said, "spoken"); m.spokenClean += sv.length ? 0 : 1; if (sv.length) DBG("SPOKEN", sv, said)
      if (turn.premise) { m.premise++; if (fails.some((f) => /premise/.test(f))) m.premiseAdopted++ }
      if (turn.kind === "pushback") { m.push++; const ok = !!text.trim() && !(history.length && D.sameAnswerRatio(history[history.length - 1].a, text) >= 0.8); m.pushOk += ok ? 1 : 0; if (!ok) DBG("PUSH", turn.q, "|", text) }
      if (history.length && normalizeAskText(history[history.length - 1].q).toLowerCase() !== normalizeAskText(q).toLowerCase()) {
        m.pairs++; const dup = D.sameAnswerRatio(history[history.length - 1].a, text) >= 0.8; m.dupes += dup ? 1 : 0; if (dup) DBG("DUPE", history[history.length - 1].q, "|", q)
      }
      const wc = LEVELS.map((lv) => D.wordCount(drafts[lv]))
      m.modeSets++; const gap = wc[1] >= wc[0] * 1.5 && wc[2] >= wc[1] * 1.5; m.modeOk += gap ? 1 : 0; if (!gap) DBG("MODE", q, wc)
      history.push({ q, a: text })
    }
  }
  const v = H.verdict(Array.from({ length: m.answers }, () => ({ text: "" })), [], H.OFFLINE_LABEL)
  m.evidence = v.evidence
  return m
}
export function report(m) {
  return `OFFLINE ${m.n}-sequence r7 realism check (${process.env.KOMPAS_ROOT ? "code at " + process.env.KOMPAS_ROOT : "this branch"}; ${m.turns} turns; stand-in drafts, NOT live answer quality)
blank answers: ${pct(m.blank, m.answers)}
coding asks read as coding (heard and cleaned): ${pct(m.codingIntent, m.coding)}   coding asks read as a greeting/acknowledgement: ${pct(m.codingAck, m.coding)}
coding asks whose draft prompt says code first: ${pct(m.codingPrompt, m.coding)}   noisy coding asks with the same coding intent as the clean ask: ${pct(m.noisyCodingOk, m.noisyCoding)}
spoken surface with no code or symbols: ${pct(m.spokenClean, m.spokenChecked)}
wrong-premise asks where the answer adopted the premise: ${pct(m.premiseAdopted, m.premise)}
pushbacks answered without repeating the previous answer: ${pct(m.pushOk, m.push)}
answers with numbers not in the dossier: ${pct(m.invented, m.answers)}
near-duplicate answers for different back-to-back questions: ${pct(m.dupes, m.pairs)}
mode sets with each step at least 1.5x longer: ${pct(m.modeOk, m.modeSets)}
detector hits: ${JSON.stringify(m.detector)}   by ask kind: ${JSON.stringify(m.failsByKind)}`
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(report(run(Number(process.argv[2] || 200))))
