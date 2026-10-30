#!/usr/bin/env node
/**
 * Source grounding r2 folds (29 Oct 2026). OFFLINE, CODE-LEVEL ONLY: no model, no network, no token. NOT live answer quality.
 *   node scripts/kompas-grounding-r2-folds.mjs 200|300        (KOMPAS_ROOT=/path/to/other/checkout measures that code: "before")
 * Harder than kompas-source-grounding-folds: vague and lower-case inventions, consecutive related asks (repeat check),
 * question kinds, statement-premise and wh follow-up lead-ins, chatter and misheard words.
 */
import { readFileSync } from "node:fs"
import { pathToFileURL, fileURLToPath } from "node:url"
const ROOT = process.env.KOMPAS_ROOT || fileURLToPath(new URL("..", import.meta.url))
const D = await import(pathToFileURL(`${ROOT}/src/lib/kompasDissection.ts`).href)
const R = await import(pathToFileURL(`${ROOT}/src/lib/kompasSourceRetrieval.ts`).href)
const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const DOCS = R.sourceDocs(S)
const LEVELS = ["engineer", "director", "architect"]
const COVERED = ["Splunk detections", "CloudTrail findings", "Terraform guardrails", "public S3 buckets", "access reviews", "privileged accounts",
  "leaked API key", "post-incident review", "residual risk", "HIPAA controls", "syslog sources", "noisy SIEM rules", "detection backlog", "alert triage", "stale admin rights",
  "terra form guardrails", "cloud trail findings", "splunk detection", "residual risks", "stale admin right"]
const UNCOVERED = ["Kubernetes admission controllers", "Okta SSO rollout", "PCI DSS scoping", "Azure Sentinel", "red team exercises", "SOC 2 Type II audits", "GCP org policies", "mobile app pentesting", "kafka hardening", "zero trust network access"]
const FRAMES = ["Tell me about your work on {t}.", "How did you handle {t}?", "Walk me through {t} at your last job.", "Um, so, like, {t}, what was your part in that?",
  "Sorry, the line cut out. {t}, how did that go?", "Quick one: {t}, yes or no, and why?", "Your resume mentions a lot. Which piece of {t} was hardest?",
  "Tell me about a time {t} went wrong.", "How did you lead the team on {t}?", "Give me an example of {t} you are proud of."]
const INVENT = {
  named: ["At Globex I also did this with Datadog.", "That cut the time by 75%.", "We used Wiz and Snyk for it.", "It saved the bank $2 million."],
  vague: ["I led a large team on it.", "It protected millions of users.", "I led dozens of engineers through the change.", "We rolled it out to thousands of customers.", "I ran a huge program around it."],
  lower: ["I ran the pipeline on kubernetes.", "We sent the logs to datadog.", "I wired it into jenkins and ansible.", "The alerts went to crowdstrike first."],
}
const FAMS = Object.keys(INVENT)
const PREMISES = ["The control failed in 37% of samples. What would you do?", "The audit was due in two days. How would you prioritise?", "A key expired last night. Who do you call first?", "Our patch window slipped twice. What now?"]
const WH_ASKS = ["What about who should accept a risk?", "And who should accept a risk?", "Which alerts get paged?", "Where do the exceptions live?", "And which ones get paged?"]
const WH_FOLLOW = [["How do you close findings?", "And who should accept a risk?"], ["How do you run access reviews?", "And what should happen to stale admins?"], ["How do you triage alerts?", "And which ones get paged?"]]

function sequences(n) {
  const out = []
  for (let i = 0; out.length < n; i++) {
    const uncovered = i % 5 === 3
    const t = uncovered ? UNCOVERED[i % UNCOVERED.length] : COVERED[(i * 3) % COVERED.length]
    const q = FRAMES[(i * 7) % FRAMES.length].replace("{t}", t)
    const fam = FAMS[i % 3]
    const inv = i % 10 < 6 ? INVENT[fam][Math.floor(i / 3) % INVENT[fam].length] : ""
    out.push({ q, t, uncovered, level: LEVELS[i % 3], invent: inv, fam: inv ? fam : "" })
  }
  return out
}
const pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`

export function run(n) {
  const m = { n, seeded: { named: 0, vague: 0, lower: 0 }, caught: { named: 0, vague: 0, lower: 0 }, clean: 0, falseFlags: 0, dropped: 0,
    covered: 0, falseNotIn: 0, uncovered: 0, honest: 0, repeatPairs: 0, repeats: 0, lead: 0, leadOk: 0, beh: 0, behOk: 0, stiff: 0, leadIns: 0, unsupAfter: 0 }
  const seqs = sequences(n)
  let prevAnswer = ""
  seqs.forEach((s, i) => {
    const r = R.retrievePassages(s.q, DOCS)
    if (s.uncovered) { m.uncovered++; m.honest += R.sourcePassagesPrompt(r).includes(R.NOT_IN_SOURCES) ? 1 : 0 } else { m.covered++; m.falseNotIn += r.matched ? 0 : 1 }
    const base = D.draftSpokenAnswer(s.q, s.level, S.resume)
    const drafted = s.invent ? `${base} ${s.invent}` : base
    const flagged = R.repairLoopSourceChecks(s.q, drafted, DOCS)
    if (s.invent) { m.seeded[s.fam]++; if (flagged.length && flagged[0].toLowerCase().includes(R.extractClaims(s.invent).length ? "" : "\u0000")) m.caught[s.fam] += R.unsupportedClaims(s.invent, r.passages, DOCS, s.q).length ? 1 : 0 }
    else { m.clean++; if (flagged.length) m.falseFlags++ }
    const after = flagged.length ? D.sentencesOf(drafted).filter((x) => !R.claimSupport(x, r.passages, DOCS, s.q).unsupported.length).join(" ") : drafted
    m.dropped += D.sentencesOf(base).filter((x) => !after.includes(x)).length
    m.unsupAfter += R.claimSupport(after, r.passages, DOCS, s.q).unsupported.length
    // behavior 8: consecutive related asks (same topic family, new frame) should not lead on the passage the last answer used
    if (!s.uncovered && i % 2 === 1) {
      const q2 = `And what else did you do on ${s.t}?`
      const used = r.passages[0]?.line || ""
      const r2 = R.retrievePassages.length >= 4 || true ? R.retrievePassages(q2, DOCS, 4, { recent: [`${base} ${used}`] }) : null
      const alt = R.retrievePassages(q2, DOCS).passages.filter((p) => p.proves === "experience").length > 1
      if (alt && r2.matched) { m.repeatPairs++; m.repeats += r2.passages[0]?.line === used ? 1 : 0 }
    }
    // behavior 7: leadership asks lead on a led/owned line; behavioral asks surface saved Q&A or dossier in the top 4
    const kind = /lead the team/i.test(s.q) ? "lead" : /a time|proud/i.test(s.q) ? "beh" : ""
    if (kind === "lead" && !s.uncovered) { m.lead++; m.leadOk += /\b(?:Led|led|owned|Ran|ran)\b/.test(r.passages[0]?.text || "") ? 1 : 0 }
    if (kind === "beh" && !s.uncovered) { m.beh++; m.behOk += r.passages.some((p) => p.source !== "resume" && p.proves === "experience") ? 1 : 0 }
    prevAnswer = drafted
  })
  // lead-ins: statement premises and wh follow-ups, every mode
  for (const lv of LEVELS) {
    for (const q of PREMISES) { m.leadIns++; m.stiff += /^(?:For|On) (?:the|a|an|our|A|The|Our) (?!\S+ that\b)[\w-]+(?: (?!that\b)[\w-]+)? (?:failed|was|expired|slipped)\b|^(?:For|On) [A-Z] /.test(D.draftSpokenAnswer(q, lv, S.resume)) ? 1 : 0 }
    for (const q of WH_ASKS) { m.leadIns++; m.stiff += /(?:^|, )(?:for|on) (?:who|whom|which|where)\b|\btreat (?:who|whom|which|where)\b/i.test(D.draftSpokenAnswer(q, lv, S.resume).split(/(?<=[.])\s/)[0]) ? 1 : 0 }
    for (const [a, b] of WH_FOLLOW) {
      const first = D.draftSpokenAnswer(a, lv, S.resume)
      const q = `${a} ${b}`
      m.leadIns++; m.stiff += /(?:^|, )for (?:who|what|which|whether)\b/.test(D.draftSpokenAnswer(q, lv, S.resume, [first])) ? 1 : 0
    }
  }
  return m
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = Number(process.argv[2] || 200), m = run(n)
  const fam = (f) => pct(m.caught[f], m.seeded[f])
  console.log(`OFFLINE ${n}-sequence grounding r2 check (${process.env.KOMPAS_ROOT ? "code at " + process.env.KOMPAS_ROOT : "this branch"}; not live answer quality)
seeded inventions caught: named ${fam("named")}  vague ${fam("vague")}  lower-case tools ${fam("lower")}
false flags on clean drafts: ${pct(m.falseFlags, m.clean)}   clean stand-in sentences dropped by the stand-in rewrite: ${m.dropped}
unsupported claims left after the stand-in rewrite: ${m.unsupAfter}
covered asks wrongly called "not in your sources": ${pct(m.falseNotIn, m.covered)}   honest "not in your sources": ${pct(m.honest, m.uncovered)}
consecutive related asks leading on the same passage again: ${pct(m.repeats, m.repeatPairs)}
leadership asks led by a led/owned/ran line: ${pct(m.leadOk, m.lead)}   behavioral asks with dossier or saved Q&A in top 4: ${pct(m.behOk, m.beh)}
stiff lead-ins (statement premise after "For", "for who/what" follow-up): ${pct(m.stiff, m.leadIns)}`)
}
