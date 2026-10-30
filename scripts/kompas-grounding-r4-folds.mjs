#!/usr/bin/env node
/**
 * Source grounding r4 folds (29 Oct 2026). OFFLINE, CODE-LEVEL ONLY: no model, no network, no token. NOT live answer quality.
 *   node scripts/kompas-grounding-r4-folds.mjs 200|500     (KOMPAS_ROOT=/other/checkout measures that code as "before")
 * Fresh failure types: interviewer self-corrections mid-question, very short follow-ups ("why?", "and then?"), three-part
 * asks, topics not on the resume, a question repeated word for word later, resumes with unusual dates and employer names,
 * and a mode sent in the wrong form ("Director", "principal", empty). The heard text goes through questionForAnswer (the
 * production question step); the "answer" is the stand-in draft (draftSpokenAnswer) plus seeded inventions.
 */
import { readFileSync } from "node:fs"
import { pathToFileURL, fileURLToPath } from "node:url"
const ROOT = process.env.KOMPAS_ROOT || fileURLToPath(new URL("..", import.meta.url))
const D = await import(pathToFileURL(`${ROOT}/src/lib/kompasDissection.ts`).href)
const R = await import(pathToFileURL(`${ROOT}/src/lib/kompasSourceRetrieval.ts`).href)
const A = await import(pathToFileURL(`${ROOT}/src/lib/kompasAnswer.ts`).href)
const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const LEVELS = ["engineer", "director", "architect"]
const B1 = ["Built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%.",
  "Wrote Terraform guardrails that block public S3 buckets before deployment.",
  "Ran quarterly access reviews for 1,200 privileged accounts and removed stale admin rights.",
  "Led incident response for a leaked API key: rotated the key in KMS, scoped the blast radius and wrote the post-incident review."]
const B2 = ["Tracked residual risk on open audit findings and reported it to the business owner each week.",
  "Mapped HIPAA controls to the audit checklist so each finding named the control it failed.",
  "Onboarded syslog and API log sources into the SIEM and tuned noisy rules."]
// Resumes with unusual dates and employer names (fictional)
export const ODD = {
  subheadings: S.resume,
  apostropheDates: `Riley Moss\nEXPERIENCE\nSr. Cloud Sec. Eng. — Northwind Bank, N.A. — Jan '21–Present\n${B1.map((b) => `• ${b}`).join("\n")}\nSecurity Analyst · Contoso Health & Partners, LLC · 05/2017 – 12/2020\n${B2.map((b) => `• ${b}`).join("\n")}\n`,
  selfEmployed: `# Riley Moss\n## Experience\n### Independent consultant, Self-employed (2021 - now)\n${B1.map((b) => `- ${b}`).join("\n")}\n### Analyst, Stealth startup (Q3 2018 to Q1 2021)\n${B2.map((b) => `- ${b}`).join("\n")}\n### Career break (2017)\n- Caring for family.\n`,
  initialsEmployer: `Riley Moss | Denver\nWORK\nCloud Security Engineer, J.P.M. & Co. (Summer 2022 – current)\n${B1.map((b) => `* ${b}`).join("\n")}\nSOC Analyst, 3M Health Info Systems (2016–2022, part-time 2019)\n${B2.map((b) => `* ${b}`).join("\n")}\n`,
}
const COVERED = ["Splunk detections", "Terraform guardrails", "access reviews", "privileged accounts", "leaked API key", "post-incident review", "residual risk", "HIPAA controls", "syslog sources", "noisy SIEM rules", "public S3 buckets", "alert triage"]
const UNCOVERED = ["Kubernetes admission controllers", "Okta SSO rollout", "PCI DSS scoping", "Azure Sentinel", "red team exercises", "SOC 2 Type II audits", "GCP org policies", "mobile app pentesting", "zero trust network access", "Wiz cloud posture"]
const FRAMES = ["Tell me about your work on {t}.", "How did you handle {t}?", "Walk me through {t}.", "Give me an example of {t} you are proud of.", "How did you lead the team on {t}?"]
const CORRECT = ["{a}, sorry, actually, how did you handle {b}?", "Tell me about {a}. No wait, scratch that, walk me through {b}.", "So {a} — actually, let me rephrase, how did you approach {b}?", "{a}, I mean, what did you do on {b}?"]
const SHORT = ["why?", "and then?", "how so?", "what happened next?", "Why?", "And?", "why that?"]
const MODE_FORMS = [["Director", "director"], ["ARCHITECT ", "architect"], ["principal", "engineer"], ["", "engineer"], [null, "engineer"], ["engineer", "engineer"], ["director", "director"]]
const INVENT = ["At Globex I also did this with Datadog.", "That cut the time by 75%.", "I led a large team on it.", "We sent the logs to datadog.", "It protected millions of users.", "It saved the bank $2 million."]
const ERRORS = ["Error: 429 Too Many Requests", "{\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}", "upstream connect error or disconnect/reset before headers", "Provider returned error", "The model is currently overloaded. Please try again later."]
const HONEST = /does not show this exact work|have not done this|not something I have run/i
const DBG = process.env.R4_DEBUG ? (...a) => console.error(...a) : () => {}
const pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`
const lower = (s) => String(s).toLowerCase()
const first = (t) => lower(D.sentencesOf(t)[0] || "")
const keyWords = (t) => lower(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !["about", "your", "work", "tell", "handle", "walk", "through", "give", "example", "proud", "lead", "team", "approach", "what", "with"].includes(w))
const onTopic = (topic, ans) => { const k = keyWords(topic); return !k.length || k.some((w) => first(ans).includes(w.replace(/s$/, ""))) }
const named = (topic, ans) => keyWords(topic).some((w) => lower(ans).includes(w.replace(/s$/, "")))

export function run(n) {
  const m = { n, answers: 0, open: 0, openOk: 0, interrupt: 0, interruptOk: 0, interruptStale: 0, short: 0, shortOk: 0, three: 0, threeAll: 0,
    uncovered: 0, honestPrompt: 0, honestDraft: 0, repeat: 0, repeatOk: 0, odd: 0, oddMatched: 0, oddEmployer: 0, modeForm: 0, modeFormOk: 0,
    claims: 0, supported: 0, seeded: 0, shipped: 0, pairs: 0, dupes: 0, third: 0, errs: 0, errShown: 0, modeSets: 0, modeOk: 0, kinds: {} }
  const layouts = Object.keys(ODD)
  let lastQ = "", lastA = ""
  const asked = []
  for (let i = 0; i < n; i++) {
    const layout = layouts[(i + Math.floor(i / 8)) % layouts.length]
    const resume = ODD[layout]
    const docs = R.sourceDocs({ ...S, resume })
    const kind = i % 8
    const t = COVERED[(i * 7 + Math.floor(i / 8)) % COVERED.length]
    const t2 = COVERED[(i * 7 + Math.floor(i / 8) + 3) % COVERED.length]
    const history = lastQ ? [{ q: lastQ, a: lastA }] : []
    let heard, topic = t
    if (kind === 0) { heard = CORRECT[i % CORRECT.length].replace("{a}", t2).replace("{b}", t); heard = heard.charAt(0).toUpperCase() + heard.slice(1) }
    else if (kind === 1) { heard = SHORT[i % SHORT.length]; topic = lastQ ? lastQ : t }
    else if (kind === 2) { const t3 = COVERED[(i * 7 + 5) % COVERED.length]; heard = `How did you handle ${t}, ${t2}, and ${t3}?`; topic = [t, t2, t3] }
    else if (kind === 3) { topic = UNCOVERED[i % UNCOVERED.length]; heard = FRAMES[i % FRAMES.length].replace("{t}", topic) }
    else if (kind === 4 && asked.length > 3) { heard = asked[(i * 3) % asked.length]; topic = heard }
    else heard = FRAMES[(i * 3) % FRAMES.length].replace("{t}", t)
    const q = A.questionForAnswer(heard, "", false, false, kind === 1 ? history : [])
    const r = R.retrievePassages(q, docs)
    const modeIn = MODE_FORMS[i % MODE_FORMS.length]
    const prev = lastA ? [lastA] : []
    const drafts = LEVELS.map((lv) => D.draftSpokenAnswer(q, lv, resume, prev))
    const K = (m.kinds[kind] ||= { n: 0 }); K.n++
    if (kind === 0) {
      m.interrupt++
      const ok = onTopic(t, drafts[0]) && lower(q).includes(lower(t))
      const stale = lower(q).includes(lower(t2)) && !/following up on/.test(q)
      m.interruptOk += ok ? 1 : 0; m.interruptStale += stale ? 1 : 0; if (!ok || stale) DBG("INTERRUPT", heard, "=>", q, "|", drafts[0])
    } else if (kind === 1) {
      if (lastQ) { m.short++; const ok = /following up on/.test(q) && lower(q).includes(lower(lastQ).replace(/[?.]$/, "").slice(0, 20)); m.shortOk += ok ? 1 : 0; if (!ok) DBG("SHORT", heard, "=>", q) }
    } else if (kind === 2) {
      m.three++
      const ok = [drafts[1], drafts[2]].every((d) => topic.every((tp) => named(tp, d)))
      m.threeAll += ok ? 1 : 0; if (!ok) DBG("THREE", layout, q, "|", drafts[1])
    } else if (kind === 3) {
      m.uncovered++
      m.honestPrompt += R.sourcePassagesPrompt(r).includes(R.NOT_IN_SOURCES) ? 1 : 0; if (!R.sourcePassagesPrompt(r).includes(R.NOT_IN_SOURCES)) DBG("HPROMPT", layout, q, r.passages[0]?.text)
      const ok = drafts.every((d) => HONEST.test(d) || /closest real example/i.test(d)); m.honestDraft += ok ? 1 : 0; if (!ok) DBG("HONEST", layout, q, "|", drafts[0])
    } else if (kind === 4 && asked.length > 3) {
      m.repeat++
      const ok = drafts.every((d) => onTopic(heard, d)); m.repeatOk += ok ? 1 : 0; if (!ok) DBG("REPEAT", q, "|", drafts[0])
    }
    if (kind !== 3 && kind !== 1 && layout !== "subheadings" && !UNCOVERED.some((u) => lower(q).includes(lower(u)))) {
      m.odd++; m.oddMatched += r.matched ? 1 : 0; if (!r.matched) DBG("ODD", layout, q)
      const emp = r.passages.find((p) => p.source === "resume")?.text || ""
      const okEmp = !/Northwind|Contoso|J\.P\.M|3M|Self-employed|Stealth/.test(resume) || /Northwind Bank, N\.A\.|Contoso Health & Partners, LLC|Self-employed|Stealth startup|J\.P\.M\. & Co\.|3M Health Info Systems/.test(emp) || !emp
      m.oddEmployer += okEmp ? 1 : 0; if (!okEmp) DBG("EMPLOYER", layout, emp)
    }
    // wrong mode form → the right mode, and the draft for it is that mode's draft
    m.modeForm++; const lv = A.answerLevel(modeIn[0]); m.modeFormOk += lv === modeIn[1] ? 1 : 0; if (lv !== modeIn[1]) DBG("MODEFORM", modeIn, lv)
    const wc = drafts.map((d) => d.split(/\s+/).filter(Boolean).length)
    m.modeSets++; const gap = wc[1] >= wc[0] * 1.5 && wc[2] >= wc[1] * 1.5; m.modeOk += gap ? 1 : 0; if (!gap) DBG("MODE", layout, q, wc, JSON.stringify(prev))
    drafts.forEach((d, j) => {
      m.answers++
      if (kind !== 1 && kind !== 2) { m.open++; const kw = D.questionKeywords(q).flatMap((k) => lower(k).split(/\s+/)).filter((w) => w.length >= 4); const ok = !kw.length || kw.some((k) => first(d).includes(k.replace(/s$/, ""))); m.openOk += ok ? 1 : 0; if (!ok) DBG("OPEN", q, "|", d) }
      if (/\bRiley\b|\b(?:she|he) (?:led|built|ran|wrote)\b|\bthe candidate\b/i.test(d)) { m.third++; DBG("THIRD", layout, d) }
      const inv = (i + j) % 3 === 0 ? INVENT[(i + j) % INVENT.length] : ""
      const drafted = inv ? `${d} ${inv}` : d
      const flagged = R.repairLoopSourceChecks(q, drafted, docs)
      const after = flagged.length ? D.sentencesOf(drafted).filter((x) => !R.claimSupport(x, r.passages, docs, q).unsupported.length).join(" ") : drafted
      const cs = R.claimSupport(after, r.passages, docs, q)
      m.claims += cs.total; m.supported += cs.supported
      if (inv) { m.seeded++; const left = cs.unsupported.length || after.includes(inv); m.shipped += left ? 1 : 0; if (left) DBG("SHIPPED", inv, "|", after) }
    })
    const e = ERRORS[i % ERRORS.length]; m.errs++; m.errShown += D.isProviderErrorAnswer(e) ? 0 : 1; if (!D.isProviderErrorAnswer(e)) DBG("ERR", e)
    // a different question right after must not get a near-duplicate answer (verbatim repeats are the same question)
    if (lastA && lower(lastQ) !== lower(q)) { m.pairs++; const dup = D.sameAnswerRatio(lastA, drafts[i % 3]) >= 0.8; m.dupes += dup ? 1 : 0; if (dup) DBG("DUPE", lastQ, "|", q) }
    lastQ = q; lastA = drafts[i % 3]
    if (kind !== 1) asked.push(heard)
  }
  return m
}
export function report(m) {
  return `OFFLINE ${m.n}-sequence grounding r4 check (${process.env.KOMPAS_ROOT ? "code at " + process.env.KOMPAS_ROOT : "this branch"}; stand-in drafts, not live answer quality)
opens on an asked keyword: ${pct(m.openOk, m.open)}
self-corrected questions answered on the corrected ask: ${pct(m.interruptOk, m.interrupt)}   abandoned topic still in the question: ${pct(m.interruptStale, m.interrupt)}
very short follow-ups ("why?", "and then?") tied to the previous question: ${pct(m.shortOk, m.short)}
three-part asks with all three parts named (Director and Architect): ${pct(m.threeAll, m.three)}
honest "not in your sources" on uncovered asks: prompt ${pct(m.honestPrompt, m.uncovered)}, stand-in draft in all three modes ${pct(m.honestDraft, m.uncovered)}
verbatim repeats answered on the same topic in all three modes: ${pct(m.repeatOk, m.repeat)}
unusual dates/employers: covered asks matched ${pct(m.oddMatched, m.odd)}, employer name kept exactly ${pct(m.oddEmployer, m.odd)}
mode sent in the wrong form mapped to the right mode: ${pct(m.modeFormOk, m.modeForm)}
supported-claims share after the stand-in rewrite: ${pct(m.supported, m.claims)}   seeded inventions still shipped: ${pct(m.shipped, m.seeded)}
near-duplicate answers for different back-to-back questions: ${pct(m.dupes, m.pairs)}
third-person slips: ${pct(m.third, m.answers)}   provider-error text passed as an answer: ${pct(m.errShown, m.errs)}
mode sets with each step at least 1.5x longer: ${pct(m.modeOk, m.modeSets)}`
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(report(run(Number(process.argv[2] || 200))))
