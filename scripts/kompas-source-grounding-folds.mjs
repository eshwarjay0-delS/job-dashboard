#!/usr/bin/env node
/**
 * Source-grounding before/after folds (29 Oct 2026). OFFLINE, CODE-LEVEL ONLY: no model, no network, no token.
 * Answers are the offline stand-in (draftSpokenAnswer) plus seeded model-style invented claims; this measures the
 * retrieval and the claim check, NOT live answer quality.
 *   node scripts/kompas-source-grounding-folds.mjs 50|200
 */
import { readFileSync } from "node:fs"
import { draftSpokenAnswer, questionKeywords, sentencesOf } from "../src/lib/kompasDissection.ts"
import { resumeDigest } from "../src/lib/kompasResume.ts"
import { sourceDocs, retrievePassages, sourcePassagesPrompt, claimSupport, repairLoopSourceChecks, extractClaims, NOT_IN_SOURCES } from "../src/lib/kompasSourceRetrieval.ts"

const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = sourceDocs(S)
const LEVELS = ["engineer", "director", "architect"]
const MISHEARD = ["cloud trail findings", "splunk detection", "stale admin right", "terra form guardrails", "residual risks"]
const COVERED = ["Splunk detections", "CloudTrail findings", "Terraform guardrails", "public S3 buckets", "access reviews", "privileged accounts",
  "leaked API key", "post-incident review", "residual risk", "HIPAA controls", "syslog sources", "noisy SIEM rules", "detection backlog", "alert triage", "stale admin rights"]
const UNCOVERED = ["Kubernetes admission controllers", "Okta SSO rollout", "PCI DSS scoping", "Azure Sentinel", "red team exercises", "SOC 2 Type II audits", "GCP org policies", "mobile app pentesting"]
const FRAMES = ["Tell me about your work on {t}.", "How did you handle {t}?", "Walk me through {t} at your last job.", "What did you change about {t}?", "Have you done {t}?"]
const HARD = ["Um, so, like, {t}, what was your part in that?", "Going back to {t}, what would you do differently?", "Sorry, the line cut out. {t}, how did that go?", "Quick one: {t}, yes or no, and why?", "Your resume mentions a lot. Which piece of {t} was hardest?"]
const INVENT = ["At Globex I also did this with Datadog.", "That cut the time by 75%.", "I led a team of 14 engineers on it.", "We used Wiz and Snyk for it.", "It saved the bank $2 million."]

function sequences(n) {
  const out = []
  const frames = n > 50 ? [...FRAMES, ...HARD] : FRAMES
  for (let i = 0; out.length < n; i++) {
    const uncovered = i % 4 === 3
    const pool = n > 50 && i % 4 === 1 ? MISHEARD : COVERED
    const t = uncovered ? UNCOVERED[i % UNCOVERED.length] : pool[i % pool.length]
    const q = frames[(i * 7) % frames.length].replace("{t}", t)
    out.push({ q, t, uncovered, level: LEVELS[i % 3], invent: i % 5 < 2 ? INVENT[i % INVENT.length] : "" })
  }
  return out
}
const hasKey = (text, q) => questionKeywords(q).some((k) => text.toLowerCase().includes(k.toLowerCase()))
const opensOn = (text, q) => hasKey(sentencesOf(text)[0] || "", q)

export function run(n) {
  const m = { n, evBefore: 0, evAfter: 0, honestBefore: 0, honestAfter: 0, uncovered: 0, openBefore: 0, openAfter: 0,
    claims: 0, unsupBefore: 0, unsupAfter: 0, seeded: 0, caught: 0, falseFlags: 0, falseNotIn: 0, dropped: 0, shareBefore: 0, shareAfter: 0 }
  for (const s of sequences(n)) {
    const r = retrievePassages(s.q, DOCS)
    // evidence: does the first evidence line the model sees hold the asked keyword? before = today's fitted resume digest
    const digest = resumeDigest(S.resume, s.q, 1600).split("\n").map((l) => l.trim()).filter((l) => l.split(/\s+/).length >= 4 && !/^#|^ROLES\b/.test(l))
    if (!s.uncovered) { m.evBefore += hasKey(digest[0] || "", s.q) ? 1 : 0; m.evAfter += hasKey(r.passages[0]?.text || "", s.q) ? 1 : 0 }
    if (!s.uncovered && !r.matched) m.falseNotIn++
    if (s.uncovered) { m.uncovered++; m.honestAfter += sourcePassagesPrompt(r).includes(NOT_IN_SOURCES) ? 1 : 0 }
    // answers: stand-in draft plus a seeded invented claim (what a model can do), then the source check
    const base = draftSpokenAnswer(s.q, s.level, S.resume)
    const drafted = s.invent ? `${base} ${s.invent}` : base
    if (s.invent) m.seeded++
    const before = claimSupport(drafted, r.passages, DOCS, s.q)
    const flagged = repairLoopSourceChecks(s.q, drafted, DOCS)
    // offline stand-in for the rewrite: drop sentences carrying a flagged claim (the live rewrite is a model call)
    const after = flagged.length ? sentencesOf(drafted).filter((x) => !claimSupport(x, r.passages, DOCS, s.q).unsupported.length).join(" ") : drafted
    m.dropped += sentencesOf(drafted).length - sentencesOf(after).length
    if (process.env.DEBUG_DROPS) for (const x of sentencesOf(drafted)) if (!after.includes(x) && x !== s.invent) console.log("DROP", JSON.stringify(x), "::", s.q)
    const aft = claimSupport(after, r.passages, DOCS, s.q)
    if (s.invent && flagged.length) m.caught++
    if (!s.invent && flagged.length) m.falseFlags++
    m.claims += before.total; m.unsupBefore += before.unsupported.length; m.unsupAfter += aft.unsupported.length
    m.shareBefore += before.share === 1 ? 1 : 0; m.shareAfter += aft.share === 1 ? 1 : 0
    m.openBefore += opensOn(drafted, s.q) ? 1 : 0; m.openAfter += opensOn(after, s.q) ? 1 : 0
  }
  return m
}
const n = Number(process.argv[2] || 50)
if (import.meta.url === `file://${process.argv[1]}`) {
  const m = run(n), pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`
  const cov = n - m.uncovered
  console.log(`OFFLINE ${n}-sequence source-grounding check (not live answer quality)
evidence line holds the asked keyword (covered asks): before ${pct(m.evBefore, cov)}  after ${pct(m.evAfter, cov)}
honest "not in your sources" on uncovered asks:       before ${pct(m.honestBefore, m.uncovered)}  after ${pct(m.honestAfter, m.uncovered)}
answers with every claim supported:                     before ${pct(m.shareBefore, n)}  after ${pct(m.shareAfter, n)}
unsupported claims shipped:                             before ${m.unsupBefore}  after ${m.unsupAfter}  (of ${m.claims} claims)
seeded inventions caught: ${pct(m.caught, m.seeded)}   false flags on clean drafts: ${pct(m.falseFlags, n - m.seeded)}
covered asks wrongly called "not in your sources": ${pct(m.falseNotIn, cov)}   sentences dropped by the stand-in rewrite: ${m.dropped}
answers opening on the asked keyword:                   before ${pct(m.openBefore, n)}  after ${pct(m.openAfter, n)}`)
}
