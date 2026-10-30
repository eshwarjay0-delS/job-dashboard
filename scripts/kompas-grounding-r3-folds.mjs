#!/usr/bin/env node
/**
 * Source grounding r3 folds (29 Oct 2026). OFFLINE, CODE-LEVEL ONLY: no model, no network, no token. NOT live answer quality.
 *   node scripts/kompas-grounding-r3-folds.mjs 200|500     (KOMPAS_ROOT=/other/checkout measures that code as "before")
 * New failure types: partly covered asks, similar-but-different asks in a row, follow-ups ("what else", "going back to",
 * pushback + new question), misheard voice transcripts, four resume layouts, and the 1.5x mode gap, all three modes.
 * The "answer" is the code-level stand-in draft (draftSpokenAnswer) plus seeded inventions; no model writes anything.
 */
import { readFileSync } from "node:fs"
import { pathToFileURL, fileURLToPath } from "node:url"
const ROOT = process.env.KOMPAS_ROOT || fileURLToPath(new URL("..", import.meta.url))
const D = await import(pathToFileURL(`${ROOT}/src/lib/kompasDissection.ts`).href)
const R = await import(pathToFileURL(`${ROOT}/src/lib/kompasSourceRetrieval.ts`).href)
const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const LEVELS = ["engineer", "director", "architect"]
const ROLES = [
  ["Senior Cloud Security Engineer", "Northwind Bank", "2021 to present", [
    "Built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%.",
    "Wrote Terraform guardrails that block public S3 buckets before deployment.",
    "Ran quarterly access reviews for 1,200 privileged accounts and removed stale admin rights.",
    "Led incident response for a leaked API key: rotated the key in KMS, scoped the blast radius and wrote the post-incident review."]],
  ["Security Analyst", "Contoso Health", "2017 to 2021", [
    "Tracked residual risk on open audit findings and reported it to the business owner each week.",
    "Mapped HIPAA controls to the audit checklist so each finding named the control it failed.",
    "Onboarded syslog and API log sources into the SIEM and tuned noisy rules."]],
]
export const LAYOUTS = {
  subheadings: S.resume,
  flat: `Riley Moss, cloud security engineer, Denver. ${ROLES.map(([r, e, y, b]) => `${r} at ${e} (${y}). ${b.join(" ")}`).join(" ")} CISSP.`,
  bullets: `Riley Moss\nCloud security engineer\n${ROLES.map(([r, e, y, b]) => `${r} | ${e} | ${y}\n${b.map((x) => `• ${x}`).join("\n")}`).join("\n")}\n`,
  table: `Riley Moss\n| Role | Employer | Years | Work |\n|---|---|---|---|\n${ROLES.flatMap(([r, e, y, b]) => b.map((x) => `| ${r} | ${e} | ${y} | ${x} |`)).join("\n")}\n`,
}
const COVERED = ["Splunk detections", "CloudTrail findings", "Terraform guardrails", "public S3 buckets", "access reviews", "privileged accounts",
  "leaked API key", "post-incident review", "residual risk", "HIPAA controls", "syslog sources", "noisy SIEM rules", "alert triage", "stale admin rights"]
const UNCOVERED = ["Kubernetes admission controllers", "Okta SSO rollout", "PCI DSS scoping", "Azure Sentinel", "red team exercises", "SOC 2 Type II audits", "GCP org policies", "mobile app pentesting"]
// Misheard voice transcripts of covered topics
export const MISHEARD = [["spunk detections", "Splunk"], ["cloud trail findings", "CloudTrail"], ["terra form guard rails", "Terraform"], ["axis reviews", "access reviews"],
  ["privilege accounts", "privileged"], ["leaked a p i key", "API key"], ["post incident review", "post-incident"], ["hippa controls", "HIPAA"], ["sis log sources", "syslog"], ["residue risk", "residual risk"]]
const FRAMES = ["Tell me about your work on {t}.", "How did you handle {t}?", "Walk me through {t}.", "Um so like {t}, what was your part in that?",
  "Tell me about a time {t} went wrong.", "How did you lead the team on {t}?", "Give me an example of {t} you are proud of."]
const INVENT = ["At Globex I also did this with Datadog.", "That cut the time by 75%.", "I led a large team on it.", "We sent the logs to datadog.", "It protected millions of users.", "It saved the bank $2 million."]
const ERRORS = ["Error: 429 Too Many Requests", "{\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}", "upstream connect error or disconnect/reset before headers"]
const DBG = process.env.R3_DEBUG ? (...a) => console.error(...a) : () => {}
// Second real lines on the same topics, so "what else" has somewhere new to go (fictional, like the fixture)
const SECOND = ["At Contoso Health I also tuned Splunk detections for failed logins on the patient portal.",
  "I reviewed CloudTrail findings with the platform team every Monday and closed the stale ones.",
  "I added Terraform guardrails for unencrypted volumes after an audit finding.", "I ran access reviews for the Contoso Health admin group before each audit.",
  "I wrote the residual risk summary for the HIPAA audit and got the owner to sign it.", "I cut noisy SIEM rules by retiring the ones nobody acted on."].join("\n")
const pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`
const firstSentence = (t) => D.sentencesOf(t)[0] || ""
const lower = (s) => String(s).toLowerCase()

function opensOnKeyword(q, ans) {
  const keys = D.questionKeywords(q).flatMap((k) => lower(k).split(/\s+/)).filter((w) => w.length >= 4)
  const first = lower(firstSentence(ans))
  return !keys.length || keys.some((k) => first.includes(k.replace(/s$/, "")))
}

export function run(n) {
  const m = { n, open: 0, openOk: 0, covered: 0, falseNotIn: 0, uncovered: 0, honest: 0, partial: 0, partialNamed: 0, misheard: 0, misheardOk: 0,
    claims: 0, supported: 0, seeded: 0, shipped: 0, pairs: 0, dupes: 0, third: 0, answers: 0, errShown: 0, errs: 0, modeSets: 0, modeOk: 0,
    follow: 0, followNew: 0, pairCovered: 0, single: 0, falsePartial: 0, back: 0, backSame: 0, layouts: {} }
  const names = Object.keys(LAYOUTS)
  for (let i = 0; i < n; i++) {
    const layout = names[(i + Math.floor(i / 6)) % names.length]
    const resume = LAYOUTS[layout]
    const docs = R.sourceDocs({ ...S, resume })
    const L = (m.layouts[layout] ||= { covered: 0, falseNotIn: 0 })
    const kind = i % 6 // 0,1 covered; 2 uncovered; 3 partial; 4 misheard; 5 follow-up chain
    const frame = FRAMES[(i * 5) % FRAMES.length]
    let q, t
    if (kind === 2) { t = UNCOVERED[i % UNCOVERED.length]; q = frame.replace("{t}", t) }
    else if (kind === 3) { t = `${COVERED[i % COVERED.length]} and ${UNCOVERED[(i * 3) % UNCOVERED.length]}`; q = `How did you approach ${t}?` }
    else if (kind === 4) { const [h, want] = MISHEARD[i % MISHEARD.length]; t = h; q = frame.replace("{t}", h); m.want = want }
    else { t = COVERED[(i * 5 + Math.floor(i / 6)) % COVERED.length]; q = frame.replace("{t}", t) }
    const r = R.retrievePassages(q, docs)
    if (kind === 2) { m.uncovered++; m.honest += R.sourcePassagesPrompt(r).includes(R.NOT_IN_SOURCES) ? 1 : 0 }
    else if (kind === 4) { m.misheard++; const ok = r.matched && lower(r.passages[0]?.text || "").includes(lower(m.want)); m.misheardOk += ok ? 1 : 0; if (!ok) DBG("MISHEARD", layout, q) }
    else if (kind === 3) {
      m.partial++
      const un = UNCOVERED[(i * 3) % UNCOVERED.length]
      // a fully covered pair must not be called partly missing
      const both = R.retrievePassages(`How did you approach ${COVERED[i % COVERED.length]} and ${COVERED[(i * 5 + 2) % COVERED.length]}?`, docs)
      m.pairCovered++; if ((both.missing || []).length || !both.matched) { m.falsePartial++; DBG("FALSEPARTIAL", layout, COVERED[i % COVERED.length], "|", COVERED[(i * 5 + 2) % COVERED.length], both.missing) }
      m.partialNamed += r.matched && lower(R.sourcePassagesPrompt(r)).includes(lower(un)) && /not in your sources/i.test(R.sourcePassagesPrompt(r)) ? 1 : 0
    } else { m.covered++; L.covered++; if (!r.matched) { m.falseNotIn++; L.falseNotIn++ } }
    // three modes, each a stand-in draft; mode gap 1.5x per step
    const drafts = LEVELS.map((lv) => D.draftSpokenAnswer(q, lv, resume))
    const wc = drafts.map((d) => d.split(/\s+/).filter(Boolean).length)
    m.modeSets++; const ok = wc[1] >= wc[0] * 1.5 && wc[2] >= wc[1] * 1.5; m.modeOk += ok ? 1 : 0; if (!ok) DBG("MODE", layout, q, wc)
    drafts.forEach((d, j) => {
      m.answers++
      m.open++; m.openOk += opensOnKeyword(q, d) ? 1 : 0
      if (/\bRiley\b|\b(?:she|he) (?:led|built|ran|wrote)\b|\bthe candidate\b/i.test(d)) { m.third++; DBG("THIRD", layout, LEVELS[j], q, "=>", d) }
      const inv = (i + j) % 3 === 0 ? INVENT[(i + j) % INVENT.length] : ""
      const drafted = inv ? `${d} ${inv}` : d
      const flagged = R.repairLoopSourceChecks(q, drafted, docs)
      const after = flagged.length ? D.sentencesOf(drafted).filter((x) => !R.claimSupport(x, r.passages, docs, q).unsupported.length).join(" ") : drafted
      const cs = R.claimSupport(after, r.passages, docs, q)
      m.claims += cs.total; m.supported += cs.supported
      if (inv) { m.seeded++; m.shipped += R.claimSupport(after, r.passages, docs, q).unsupported.length ? 1 : 0 }
    })
    // provider error never shown as an answer
    const e = ERRORS[i % ERRORS.length]; m.errs++; m.errShown += D.isProviderErrorAnswer(e) ? 0 : 1
    // similar but different question next: answer must not be a near-duplicate
    if (kind === 0 || kind === 1) {
      const t2 = COVERED[(i * 5 + Math.floor(i / 6) + 1) % COVERED.length]
      const q2 = frame.replace("{t}", t2)
      const a1 = drafts[i % 3], a2 = D.draftSpokenAnswer(q2, LEVELS[i % 3], resume, [a1])
      m.pairs++; const dup = D.sameAnswerRatio(a1, a2) >= 0.8; m.dupes += dup ? 1 : 0; if (dup) DBG("DUPE", layout, q, "|", q2, "=>", a2)
    }
    // follow-up chain: what else (new passage), going back to (same passage), pushback + new question (new topic answered)
    if (kind === 5 || kind === 1) {
      const fdocs = R.sourceDocs({ ...S, resume, dossier: SECOND })
      const fr = R.retrievePassages(q, fdocs)
      const used = fr.passages[0]
      const others = R.retrievePassages(`what else did you do on ${t}?`, fdocs).passages.filter((p) => p.proves === "experience")
      // only judged when a second passage really covers the same topic; a single covering passage stays on it by design
      const words = lower(t).split(/\s+/).filter((w) => w.length >= 4).map((w) => w.replace(/s$/, ""))
      const saidBefore = lower(drafts[0])
      const covering = others.filter((p) => p.line !== used?.line && !saidBefore.includes(lower(p.line).slice(0, 40)) && words.every((w) => lower(p.text).includes(w)))
      if (used && others.length > 1 && !covering.length) m.single++
      if (used && covering.length) {
        const rElse = R.retrievePassages(`What else did you do on ${t}?`, fdocs, 4, { recent: [drafts[0] + " " + used.line] })
        m.follow++; const okNew = covering.some((p) => p.line === rElse.passages[0]?.line); m.followNew += okNew ? 1 : 0; if (!okNew) DBG("ELSE", layout, t, "|", used.line, "| others:", others.map((p) => p.line.slice(0, 40)).join(" / "))
      }
      if (used) {
        const rBack = R.retrievePassages(`Going back to ${t}, what was the hardest part?`, fdocs, 4, { recent: [drafts[0] + " " + used.line] })
        m.back++; m.backSame += rBack.passages.some((p) => p.line === used.line) ? 1 : 0
      }
      const push = `I'm not sure that's right. But how did you handle ${COVERED[(i * 11 + 3) % COVERED.length]}?`
      const rp = R.retrievePassages(push, docs)
      m.covered++; L.covered++; if (!rp.matched) { m.falseNotIn++; L.falseNotIn++ }
    }
  }
  return m
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const n = Number(process.argv[2] || 200), m = run(n)
  console.log(`OFFLINE ${n}-sequence grounding r3 check (${process.env.KOMPAS_ROOT ? "code at " + process.env.KOMPAS_ROOT : "this branch"}; stand-in drafts, not live answer quality)
opens on an asked keyword: ${pct(m.openOk, m.open)}
covered asks wrongly called "not in your sources": ${pct(m.falseNotIn, m.covered)}  by layout: ${Object.entries(m.layouts).map(([k, v]) => `${k} ${pct(v.falseNotIn, v.covered)}`).join(", ")}
honest "not in your sources" on uncovered asks: ${pct(m.honest, m.uncovered)}
partly covered asks where the missing part is named as not in sources: ${pct(m.partialNamed, m.partial)}   fully covered pairs wrongly called partly missing: ${pct(m.falsePartial, m.pairCovered)}
misheard voice questions still matched to the right source: ${pct(m.misheardOk, m.misheard)}
supported-claims share after the stand-in rewrite: ${pct(m.supported, m.claims)}   seeded inventions still shipped: ${pct(m.shipped, m.seeded)}
near-duplicate answers for different back-to-back questions: ${pct(m.dupes, m.pairs)}
third-person slips: ${pct(m.third, m.answers)}   provider-error text passed as an answer: ${pct(m.errShown, m.errs)}
mode sets with each step at least 1.5x longer: ${pct(m.modeOk, m.modeSets)}
"what else" leading on an unsaid passage that covers the topic (when one exists): ${pct(m.followNew, m.follow)}   "what else" with no unsaid covering passage (stays on topic, by design): ${m.single}   "going back to" keeping the earlier passage: ${pct(m.backSame, m.back)}`)
}
