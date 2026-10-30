#!/usr/bin/env node
/**
 * Source grounding r5 folds (29 Oct 2026). OFFLINE, CODE-LEVEL ONLY: no model, no network, no token. NOT live answer quality.
 *   node scripts/kompas-grounding-r5-folds.mjs 200|500     (KOMPAS_ROOT=/other/checkout measures that code as "before")
 * New failure types: back-to-back asks on different topics with similar words, ESL phrasing and filler words, long
 * multi-sentence asks whose real ask is the last sentence, asks naming the interviewer's company or a job title, and
 * false interviewer premises ("since you led a team of 50…"). The heard text goes through questionForAnswer; the
 * "answer" is the stand-in draft (draftSpokenAnswer) plus seeded inventions and premise echoes.
 */
import { readFileSync } from "node:fs"
import { pathToFileURL, fileURLToPath } from "node:url"
const ROOT = process.env.KOMPAS_ROOT || fileURLToPath(new URL("..", import.meta.url))
const D = await import(pathToFileURL(`${ROOT}/src/lib/kompasDissection.ts`).href)
const R = await import(pathToFileURL(`${ROOT}/src/lib/kompasSourceRetrieval.ts`).href)
const A = await import(pathToFileURL(`${ROOT}/src/lib/kompasAnswer.ts`).href)
const S = JSON.parse(readFileSync(new URL("../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const LEVELS = ["engineer", "director", "architect"]
// [topic, a word only its passage has]: pairs share words ("access reviews" / "access keys" style) but need different passages
const SIMILAR = [["Splunk detections", "Splunk"], ["noisy SIEM rules", "tuned"], ["access reviews", "stale"], ["leaked API key", "rotated"],
  ["Terraform guardrails", "Terraform"], ["post-incident review", "post-incident"], ["HIPAA controls", "HIPAA"], ["residual risk", "residual"]]
const COVERED = ["Splunk detections", "Terraform guardrails", "access reviews", "privileged accounts", "leaked API key", "post-incident review", "residual risk", "HIPAA controls", "syslog sources", "noisy SIEM rules", "public S3 buckets", "alert triage"]
const ESL = ["Um, so, like, how you are doing the {t} in your last company?", "Uh can you tell about {t}, how you handle it, basically?", "So, you know, the {t} — what you did there, actually?",
  "Okay so um what is your experience for {t}?", "Please explain me how you did {t}, like, step by step?",
  "Uh, the {t}, how you are making it, I mean in your current, uh, job?", "Sorry, my English — the {t}, you did this one before, yes? How?"]
const LONG = ["We are a mid-size bank and our team grew a lot this year. We had a rough audit and a couple of incidents, and leadership is asking questions. Anyway, what I really want to know is how you handled {t}?",
  "Let me give you some context. Our stack is mostly AWS with some on-prem, and the security team is small. People wear many hats here. So my question is, walk me through {t}.",
  "I was reading your resume earlier and talking to the hiring manager. We care about pragmatism more than perfection. Tell me about {t}.",
  // harder: an earlier sentence names a different covered topic; the ask is only the last sentence
  "Last quarter our biggest pain was {d}, and the board noticed. That is mostly solved now. What I actually want to hear is how you handled {t}?",
  "You will see {d} come up a lot here, but set that aside for a second. Tell me about {t}."]
const COMPANY = ["At Fabrikam, as our Staff Security Engineer, how would you approach {t}?", "Here at Contoso Pharma the Senior Detection Engineer owns {t}; how did you do it?",
  "For the Principal Engineer role at Tailspin, tell me about {t}."]
const PREMISE = [["Since you led a team of 50 engineers, how did you handle {t}?", "50"], ["Given your time as CISO at Globex, walk me through {t}.", "CISO"],
  ["As you ran a $10 million budget, how did you approach {t}?", "10 million"], ["I see you managed 200 analysts. How did you handle {t}?", "200"]]
const PREMISE_ECHO = { "50": "With my team of 50 engineers I split the work.", CISO: "As CISO I set the direction.", "10 million": "With my 10 million budget I funded it.", "200": "I had 200 analysts on it." }
const INVENT = ["At Globex I also did this with Datadog.", "That cut the time by 75%.", "I led a large team on it.", "It protected millions of users."]
const ERRORS = ["Error: 429 Too Many Requests", "{\"error\":{\"type\":\"overloaded_error\",\"message\":\"Overloaded\"}}", "Provider returned error", "upstream connect error or disconnect/reset before headers"]
const HONEST = /does not show this exact work|have not done this|not something I have run/i
const DBG = process.env.R5_DEBUG ? (...a) => console.error(...a) : () => {}
const pct = (a, b) => `${a}/${b} (${b ? Math.round(100 * a / b) : 0}%)`
const lower = (s) => String(s).toLowerCase()
const first = (t) => lower(D.sentencesOf(t)[0] || "")
const stop = ["about", "your", "work", "tell", "handle", "walk", "through", "give", "example", "proud", "lead", "team", "approach", "what", "with"]
const keyWords = (t) => lower(t).split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !stop.includes(w))
const opensOn = (topic, ans) => keyWords(topic).some((w) => first(ans).includes(w.replace(/s$/, "")))

export function run(n) {
  const m = { n, answers: 0, openOk: 0, similar: 0, similarRight: 0, esl: 0, eslRight: 0, long: 0, longRight: 0, company: 0, companyFalseFlag: 0, companyClaimed: 0,
    premise: 0, premiseCaught: 0, premisePrompt: 0, premiseShipped: 0, premiseDraft: 0, uncovered: 0, honest: 0,
    claims: 0, supported: 0, seeded: 0, shipped: 0, pairs: 0, dupes: 0, third: 0, errs: 0, errShown: 0, modeSets: 0, modeOk: 0 }
  const resume = S.resume
  const docs = R.sourceDocs(S)
  let lastQ = "", lastA = ""
  for (let i = 0; i < n; i++) {
    const kind = i % 6
    const t = COVERED[(i * 5 + Math.floor(i / 6)) % COVERED.length]
    let heard, topic = t, seeded = ""
    let premiseClaim = ""
    if (kind === 0) { const pair = SIMILAR[i % SIMILAR.length]; topic = pair[0]; heard = `How did you handle ${topic}?` }
    else if (kind === 1) heard = ESL[i % ESL.length].replace("{t}", t)
    else if (kind === 2) heard = LONG[i % LONG.length].replace("{t}", t).replace("{d}", COVERED[(i * 5 + Math.floor(i / 6) + 4) % COVERED.length])
    else if (kind === 3) heard = COMPANY[i % COMPANY.length].replace("{t}", t)
    else if (kind === 4) { const p = PREMISE[i % PREMISE.length]; heard = p[0].replace("{t}", t); premiseClaim = p[1] }
    else { topic = ["Kubernetes admission controllers", "Okta SSO rollout", "PCI DSS scoping", "red team exercises"][i % 4]; heard = `Tell me about your work on ${topic}.` }
    const q = A.questionForAnswer(heard, "", false, false, [])
    const r = R.retrievePassages(q, docs)
    const prev = lastA ? [lastA] : []
    const drafts = LEVELS.map((lv) => D.draftSpokenAnswer(q, lv, resume, prev))
    const want = keyWords(topic)
    const rightFirst = want.some((w) => lower(r.passages[0]?.text || "").includes(w.replace(/s$/, "")))
    if (kind === 0) { m.similar++; const tag = SIMILAR[i % SIMILAR.length][1]; const ok = lower(r.passages[0]?.text || "").includes(lower(tag)); m.similarRight += ok ? 1 : 0; if (!ok) DBG("SIMILAR", q, r.passages[0]?.text) }
    if (kind === 1) { m.esl++; m.eslRight += rightFirst && opensOn(topic, drafts[0]) ? 1 : 0; if (!(rightFirst && opensOn(topic, drafts[0]))) DBG("ESL", heard, "=>", q, "|", drafts[0].slice(0, 90)) }
    if (kind === 2) { m.long++; const ok = rightFirst && opensOn(topic, drafts[0]); m.longRight += ok ? 1 : 0; if (!ok) DBG("LONG", q, "|", drafts[0].slice(0, 90)) }
    if (kind === 3) {
      m.company++
      const flagged = R.unsupportedClaims("At Fabrikam I would start from what I built before.", r.passages, docs, q).filter((c) => /Fabrikam/.test(c)).length && /Fabrikam/.test(q)
      m.companyFalseFlag += flagged ? 1 : 0
      const claimed = drafts.some((d) => /\b(?:at|for) (?:Fabrikam|Contoso Pharma|Tailspin),? I (?:led|built|ran|wrote)\b/i.test(d)); m.companyClaimed += claimed ? 1 : 0; if (claimed) DBG("COMPANY", q, drafts[0])
    }
    if (kind === 4) {
      m.premise++
      const caught = typeof R.falsePremises === "function" && R.falsePremises(q, docs).some((c) => lower(c) === lower(premiseClaim)); m.premiseCaught += caught ? 1 : 0
      const prompted = typeof R.premisePrompt === "function" && /INTERVIEWER PREMISE/.test(R.premisePrompt(q, docs)); m.premisePrompt += prompted ? 1 : 0
      m.premiseDraft += drafts.some((d) => lower(d).includes(lower(premiseClaim))) ? 1 : 0
      seeded = PREMISE_ECHO[premiseClaim]
      if (!caught) DBG("PREMISE", q, R.falsePremises?.(q, docs))
    }
    if (kind === 5) { m.uncovered++; const ok = R.sourcePassagesPrompt(r).includes(R.NOT_IN_SOURCES) && drafts.every((d) => HONEST.test(d) || /closest real example/i.test(d)); m.honest += ok ? 1 : 0 }
    const wc = drafts.map((d) => d.split(/\s+/).filter(Boolean).length)
    m.modeSets++; const gap = wc[1] >= wc[0] * 1.5 && wc[2] >= wc[1] * 1.5; m.modeOk += gap ? 1 : 0; if (!gap) DBG("MODE", q, wc)
    drafts.forEach((d, j) => {
      m.answers++
      const kw = D.questionKeywords(q).flatMap((k) => lower(k).split(/\s+/)).filter((w) => w.length >= 4)
      const open = !kw.length || kw.some((k) => first(d).includes(k.replace(/s$/, ""))); m.openOk += open ? 1 : 0; if (!open) DBG("OPEN", q, "|", d.slice(0, 80))
      if (/\bRiley\b|\b(?:she|he) (?:led|built|ran|wrote)\b|\bthe candidate\b/i.test(d)) { m.third++; DBG("THIRD", d) }
      const inv = seeded || ((i + j) % 3 === 0 ? INVENT[(i + j) % INVENT.length] : "")
      const drafted = inv ? `${d} ${inv}` : d
      const flagged = R.repairLoopSourceChecks(q, drafted, docs)
      const after = flagged.length ? D.sentencesOf(drafted).filter((x) => !R.claimSupport(x, r.passages, docs, q).unsupported.length).join(" ") : drafted
      const cs = R.claimSupport(after, r.passages, docs, q)
      m.claims += cs.total; m.supported += cs.supported
      if (inv) {
        m.seeded++; const left = after.includes(inv); m.shipped += left ? 1 : 0
        if (seeded) m.premiseShipped += left ? 1 : 0
        if (left) DBG("SHIPPED", q, "|", inv)
      }
    })
    const e = ERRORS[i % ERRORS.length]; m.errs++; m.errShown += D.isProviderErrorAnswer(e) ? 0 : 1
    if (lastA && lower(lastQ) !== lower(q)) { m.pairs++; const dup = D.sameAnswerRatio(lastA, drafts[i % 3]) >= 0.8; m.dupes += dup ? 1 : 0; if (dup) DBG("DUPE", lastQ, "|", q) }
    lastQ = q; lastA = drafts[i % 3]
  }
  return m
}
export function report(m) {
  return `OFFLINE ${m.n}-sequence grounding r5 check (${process.env.KOMPAS_ROOT ? "code at " + process.env.KOMPAS_ROOT : "this branch"}; stand-in drafts, not live answer quality)
opens on an asked keyword: ${pct(m.openOk, m.answers)}
similar-word asks on different topics led by their own passage: ${pct(m.similarRight, m.similar)}
ESL / filler voice asks: right passage first and opens on the topic ${pct(m.eslRight, m.esl)}
long asks (real ask in the last sentence): right passage first and opens on it ${pct(m.longRight, m.long)}
asks naming the interviewer's company/title: company wrongly flagged as an invented claim ${pct(m.companyFalseFlag, m.company)}, draft claims work at that company ${pct(m.companyClaimed, m.company)}
false interviewer premise: caught ${pct(m.premiseCaught, m.premise)}, named in the prompt ${pct(m.premisePrompt, m.premise)}, stand-in draft repeats it ${pct(m.premiseDraft, m.premise)}, seeded echo of it shipped ${pct(m.premiseShipped, m.premise * 3)}
honest "not in your sources" on uncovered asks (prompt and all three drafts): ${pct(m.honest, m.uncovered)}
supported-claims share after the stand-in rewrite: ${pct(m.supported, m.claims)}   invented claims still shipped: ${pct(m.shipped, m.seeded)}
near-duplicate answers for different back-to-back questions: ${pct(m.dupes, m.pairs)}
third-person slips: ${pct(m.third, m.answers)}   provider-error text passed as an answer: ${pct(m.errShown, m.errs)}
mode sets with each step at least 1.5x longer: ${pct(m.modeOk, m.modeSets)}`
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(report(run(Number(process.argv[2] || 200))))
