#!/usr/bin/env node
/**
 * Offline Kompas stress rounds (29 Oct 2026). CODE-LEVEL ONLY: no model, no network, no token. The answers here come from
 * draftSpokenAnswer (the offline stand-in) and the real server code that every live answer passes through (question
 * intake, dissection, settle, number guard, provider-error refusal). Passing here is NOT live answer quality.
 *
 *   node scripts/kompas-stress-rounds.mjs            all rounds
 *   node scripts/kompas-stress-rounds.mjs 2          one round
 *
 * Each round adds harder adversarial families. One case is one check; an answer case is judged at all three modes.
 */
import { readFileSync } from "node:fs"
import {
  draftSpokenAnswer, dissectQuestion, evaluateLiveAnswers, settleSpokenAnswer, sameAnswerRatio, sentencesOf,
  isProviderErrorAnswer, questionKeywords, wordCount,
} from "../src/lib/kompasDissection.ts"
import { deriveByCode, questionForAnswer } from "../src/lib/kompasAnswer.ts"
import { applyGuards } from "../src/lib/kompasGuards.ts"

export const RESUME = readFileSync(new URL("../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const LEVELS = ["engineer", "director", "architect"]
const HITACHI = JSON.parse(readFileSync(new URL("./fixtures/kompas-evaluation/interview-50.json", import.meta.url), "utf8"))
  .filter((x) => x.chain === "hitachi-grc").sort((a, b) => a.step - b.step).map((x) => x.question)

const A = (family, q, extra = {}) => ({ kind: "answer", family, q, ...extra })

// ------------------------------------------------------------------ round 1: the ordinary interview
const R1 = [
  ...["What is residual risk?", "Define least privilege.", "What does a compensating control mean?", "What is a policy exception?",
    "What is root cause analysis?", "What does privileged access mean?", "What is business impact?", "What is an access review?"].map((q) => A("definition", q, { shapes: ["definition"] })),
  ...["What is the difference between a policy deviation and a policy exception?", "Compare residual risk and inherent risk.",
    "Access review versus access recertification: which do you run first?", "How do preventive and detective controls differ?",
    "What is the difference between a finding and an exception?", "Compare remediation and risk acceptance."].map((q) => A("comparison", q, { shapes: ["comparison"] })),
  ...["Tell me about a time you challenged a weak remediation plan.", "Tell me about a time you sent evidence back to an owner.",
    "Give me an example of when you questioned an exception request.", "Describe a situation where a fix did not hold.",
    "Tell me about a time you explained risk to the business.", "Have you ever trained a new analyst?"].map((q) => A("behavioral", q, { shapes: ["personal-experience"] })),
  ...["How do you assess business impact and residual risk?", "Explain how a finding moves from open to closed.",
    "How do you validate that a fix is still in place?", "Walk me through how you map controls to an audit checklist.",
    "How does an access review work step by step?", "Explain how you confirm evidence matches the live setting."].map((q) => A("process", q)),
  ...["Are you able to work on site three days a week?", "Are you open to hybrid work?", "When can you start?",
    "Do you need visa sponsorship?", "Are you willing to travel?", "Where are you based?"].map((q) => A("logistics", q, { shapes: ["logistics"] })),
  A("intro", "Tell me about yourself.", { shapes: ["intro"] }), A("intro", "Give me a brief overview of your background.", { shapes: ["intro"] }),
  A("value", "Why are you interested in this role?", { shapes: ["value"] }), A("value", "What would you bring to this team?", { shapes: ["value"] }),
  A("closing", "Do you have any questions for us?", { shapes: ["closing"] }), A("closing", "What questions do you have for me?", { shapes: ["closing"] }),
  { kind: "nearDup", family: "near-duplicate", a: "What is residual risk?", b: "How do you report residual risk to the business?" },
  { kind: "nearDup", family: "near-duplicate", a: "What is a policy exception?", b: "When would you reject a policy exception?" },
  { kind: "nearDup", family: "near-duplicate", a: "How do you track open findings?", b: "How do you close open findings?" },
  ...HITACHI.map((q, i) => A("hitachi-grc", q, { history: HITACHI.slice(0, i) })),
  A("code", "Write a Python function that returns the findings still open after 30 days.", { code: true }),
  A("code", "Write a SQL query that lists findings with no owner.", { code: true }),
  A("multi-part", "How do you assess business impact, who owns the decision, and what do you track afterwards?"),
  A("multi-part", "Explain residual risk, compensating controls and exception expiry."),
]

// ------------------------------------------------------------------ round 2: tricks, small talk, jargon bait, garbled speech
const SMALL_TALK = ["yeah that's a tough one", "makes sense", "great, thanks", "let's dive in", "that's interesting",
  "hmm, fair enough", "good, good", "I see what you mean", "alright, let me pull up my notes", "nice, I like that answer",
  "perfect, that's helpful", "give me one second", "interesting point", "sorry, my dog is barking", "the weather has been crazy here lately"]
const R2 = [
  ...["What is your biggest weakness?", "Why should we not hire you?", "Is one hundred percent security possible?",
    "What did you dislike about your last manager?", "Why do you want to leave your current job?", "What is your salary expectation?",
    "Since you led the SOC at a large bank, how big was your team?", "Would you bypass a control if the CEO asked you to?"].map((q) => A("trick", q)),
  ...SMALL_TALK.map((heard) => ({ kind: "smalltalk", family: "small-talk (idea E)", heard })),
  ...["How do you keep user accounts safe?", "How do you stop attackers moving around the network?", "How do you check who has admin rights?",
    "How do you make sure logs are useful?", "How do you protect passwords?", "How do you handle a suspicious login?"].map((q) => A("jargon-bait", q)),
  ...[["um so like what's the uh resid jewel risk thing", "definition"], ["uh what is uh least privilege", "definition"],
    ["so um can you tell me about a time you you challenged a weak remediation plan", "personal-experience"],
    ["what's the difference between a policy deviation and and a policy exception you know", "comparison"],
    ["what's residual risk mean to you", "definition"], ["define compensating uh control", "definition"],
    ["how do you assess business in pact", null], ["tell me about uh yourself", "intro"],
    ["are you able to work on site like three days a week", "logistics"], ["um", null]].map(([q, shape]) => A("garbled", q, { shapes: shape ? [shape] : null, garbled: true })),
  ...["Hi, can you hear me okay?", "How are you doing today?", "Thanks for joining, shall we get started?"].map((q) => A("greeting", q, { shapes: ["logistics", "acknowledgement"] })),
]

// ------------------------------------------------------------------ round 3: very short, very long, follow-ups, provider errors, numbers
const LONG = "So we have a pretty big environment, lots of business units, some of them still on old systems, and the audit team keeps coming back with findings that were supposedly closed months ago, and honestly the owners are tired, they feel like security keeps moving the goalposts, and leadership wants a clean report before the next board meeting, so with all of that in mind, how would you decide which findings to reopen first and how would you explain that decision to the owners without losing them?"
const R3 = [
  ...["SOC 2?", "IAM?", "Residual risk?", "Why?", "Exceptions?", "Least privilege."].map((q) => A("very-short", q)),
  A("very-long", LONG), A("very-long", `${LONG} Also, what would you track to show it worked?`),
  A("very-long", "Okay so before we move on I want to understand your approach, because we had a contractor last year who closed everything on paper and nothing was actually fixed, the evidence was screenshots from months earlier, nobody checked the live setting, and when the auditors came back it was a mess, so tell me about a time you compared the evidence in a ticket with the live setting before you signed off."),
  ...[["Write a Python function that returns the findings still open after 30 days.", "Can you also add unit tests?", "tests"],
    ["Design multi-cloud controls mapped to NIST 800-53.", "What would you monitor?", "monitor"],
    ["Tell me about a time you challenged a weak remediation plan.", "What would you do differently?", "differently"],
    ["Write a SQL query that lists findings with no owner.", "Could you add an index for it?", "index"],
    ["How do you assess business impact and residual risk?", "How would you test that?", "test"],
    ["Explain how a finding moves from open to closed.", "And what about exceptions?", "exceptions"]].map(([first, follow, keyword]) => ({ kind: "followup", family: "follow-up (idea D)", first, follow, keyword })),
  ...["openrouter 429 try again in 2000ms", "Error: Request failed with status code 429", "upstream connect error or disconnect/reset before headers",
    "502 Bad Gateway", "Rate limit exceeded for model openai/gpt-5. Please retry later.", "{\"error\":{\"message\":\"Insufficient credits\",\"code\":402}}",
    "The model is currently overloaded with other requests.", "Internal Server Error", "This model's maximum context length is 128000 tokens.",
    "I'm sorry, but I can't help with that request."].map((raw) => ({ kind: "provider", family: "provider-error", raw })),
  ...["I would add rate limiting to the login API so a burst of failures is slowed down.",
    "If the upstream service returns an error, I fail closed and alert the owner.",
    "Service availability matters, so I schedule the change outside business hours."].map((raw) => ({ kind: "notProvider", family: "provider-error (legit)", raw })),
  ...[["I reduced incidents by 40% within a quarter.", true], ["I cut review time by 50% per audit cycle.", true],
    ["I handled over 200 findings every quarter.", true], ["I closed 95 percent of findings at least a month early.", true],
    ["I led a team of 12 analysts.", true], ["I improved patch compliance to 98%.", true],
    ["I would alert when failures exceed 5 per minute.", false], ["I set the threshold at 3 failed logins.", false],
    ["Hypothesis 1 held, so step 2 ran first.", false]].map(([sentence, invented]) => ({ kind: "numbers", family: "invented-number", sentence, invented })),
]

// ------------------------------------------------------------------ round 4: harder mixes and live-output settling
const R4 = [
  { kind: "nearDup", family: "near-duplicate (negation)", a: "When would you accept residual risk?", b: "When would you not accept residual risk?" },
  { kind: "nearDup", family: "near-duplicate (audience)", a: "Explain residual risk to an engineer.", b: "Explain residual risk to a director." },
  { kind: "nearDup", family: "near-duplicate (verb)", a: "How do you open a finding?", b: "How do you close a finding?" },
  { kind: "nearDup", family: "near-duplicate (no resume match)", a: "How do you secure Kubernetes clusters?", b: "How do you secure a CI pipeline?" },
  { kind: "nearDup", family: "near-duplicate (no resume match)", a: "What is zero trust?", b: "What is SASE?" },
  { kind: "nearDup", family: "near-duplicate (no resume match)", a: "How many years of experience do you have?", b: "Why do you want to leave your current job?" },
  ...["um so explain residual risk, compensating controls and uh exception expiry", "what's the difference between like inherent and residual risk and which one do you report",
    "tell me about a time you you challenged a remediation plan and what happened after"].map((q) => A("garbled multi-part", q, { garbled: true })),
  ...[["What does residual risk mean?", "## Answer\nResidual risk is the risk left after the planned control is in place."],
    ["What does residual risk mean?", "**Residual risk** is the risk left after the control is in place. I tracked it on open findings."],
    ["What does residual risk mean?", "Jordan tracked residual risk on open findings. He told the business what remained."],
    ["What does residual risk mean?", "Answer: Residual risk is what remains after the control is in place."]].map(([q, raw]) => ({ kind: "settle", family: "live-output speakable", q, raw })),
  ...[["How do you report residual risk to the business?", "I tracked residual risk on open findings and told the business what remained after the planned control was in place. I wrote the weekly risk summary in plain language."],
    ["When would you reject a policy exception?", "I questioned exception requests that had no end date and sent them back for an expiry. I compared the evidence with the live setting."]].map(([q, raw]) => ({ kind: "repeat", family: "repeat of previous answer", q, raw, previous: raw })),
  ...["What is residual risk?", "Tell me about a time you challenged a weak remediation plan.", "How do you assess business impact and residual risk?",
    "Explain how a finding moves from open to closed.", "Compare remediation and risk acceptance.", "What would you bring to this team?",
    "Tell me about yourself.", "Do you have any questions for us?", "Go deeper on that.", "Why is that important?"].map((q) => A("mode separation", q)),
  ...["What is zero trust?", "How do you secure Kubernetes clusters?", "Explain OAuth to a recruiter.", "What is SASE?", "How would you run a phishing simulation?",
    "How do you handle a ransomware incident?", "What is a SIEM?", "What's your experience with cloud security?", "How do you prioritize vulnerabilities?",
    "What is threat modeling?", "Explain encryption at rest.", "How would you build a security awareness program?"].map((q) => A("off-resume", q)),
]
export const ROUNDS = [R1, R2, R3, R4]

// ------------------------------------------------------------------ checks
const FILLER = /\b(?:um+|uh+|erm|you know)\b/i
const resumeNumbers = new Set((RESUME.match(/\d+/g) || []))
function speakable(text) {
  const out = []
  if (/^#|\*\*|^\s*[-*•]\s|\[[^\]]*\]|https?:|[{}<>|]/m.test(text)) out.push("markup a person would not say")
  if (sentencesOf(text).some((s) => wordCount(s) > 40)) out.push("sentence over 40 words")
  return out
}
function firstPersonIssues(text, q) {
  const out = []
  if (!/\b(?:I|my|me|I'm|I've|I'd)\b/.test(text)) out.push("not first person")
  if (/\b(?:your|yourself)\b/i.test(text) && !/\byou\b/i.test("")) out.push("addresses the candidate as 'you/your'")
  if (/\bJordan\b|\b(?:he|she) (?:tracked|reviewed|told|sent)\b/.test(text)) out.push("third person")
  if (/\bI (?:how|what|why|where|when|who|um|uh|hi|hello|your|you|can your|residual|least|SQL|SOC|IAM|yourself)\b/i.test(text) || /\bI can your\b/i.test(text)) out.push("broken grammar around the question words")
  if (FILLER.test(text)) out.push("echoes speech filler")
  return out
}
function invented(text, q) {
  const asked = new Set(String(q).match(/\d+/g) || [])
  return (text.match(/\b\d+\b/g) || []).filter((n) => !asked.has(n) && !resumeNumbers.has(n))
}

function judgeAnswerCase(c) {
  const fails = []
  const q = c.q
  const rows = LEVELS.map((level) => ({ question: q, level, text: draftSpokenAnswer(q, level, RESUME) }))
  const cut = dissectQuestion(q, RESUME)
  if (c.shapes && !c.shapes.includes(cut.shape)) fails.push(`shape ${cut.shape}, expected ${c.shapes.join("/")}`)
  if (c.garbled && cut.keywords.some((k) => FILLER.test(k) || /^(?:like|thing|kind|sort)$/i.test(k))) fails.push(`filler in keywords: ${cut.keywords.join("|")}`)
  for (const row of rows) {
    if (c.code) continue
    for (const issue of [...speakable(row.text), ...firstPersonIssues(row.text, q)]) fails.push(`${row.level}: ${issue}`)
    const nums = invented(row.text, q)
    if (nums.length) fails.push(`${row.level}: invented numbers ${nums.join(",")}`)
    const said = sentencesOf(row.text).map((s) => s.toLowerCase())
    if (new Set(said).size !== said.length) fails.push(`${row.level}: repeats a sentence`)
  }
  if (!c.code) {
    const judged = evaluateLiveAnswers(rows, RESUME)
    for (const f of judged.failures) fails.push(f.replace(/: .*$/, ""))
  }
  return { fails, rows }
}

export function judgeCase(c) {
  if (c.kind === "answer") return judgeAnswerCase(c).fails
  if (c.kind === "nearDup") {
    const fails = []
    for (const level of LEVELS) {
      const a = draftSpokenAnswer(c.a, level, RESUME)
      const b = draftSpokenAnswer(c.b, level, RESUME)
      const r = sameAnswerRatio(a, b)
      if (r >= 0.7) fails.push(`${level}: same answer (Jaccard ${r.toFixed(2)})`)
    }
    return fails
  }
  if (c.kind === "smalltalk") {
    const fails = []
    for (const heard of [`Them: ${c.heard}`, c.heard]) {
      const d = deriveByCode(heard, [])
      if (d) fails.push(`derive turned "${heard}" into a question: "${d}"`)
    }
    const q = questionForAnswer(c.heard, "", false, false, [])
    if (q) fails.push(`answer request would answer "${q}"`)
    return fails
  }
  if (c.kind === "followup") {
    const fails = []
    const history = [{ q: c.first, a: draftSpokenAnswer(c.first, "engineer", RESUME) }]
    const formed = questionForAnswer(c.follow, "", false, false, history)
    const tied = formed.includes(c.first.replace(/[?.!\s]+$/, ""))
    if (!tied) fails.push(`follow-up not tied to the previous question: "${formed}"`)
    for (const level of LEVELS) {
      const first = draftSpokenAnswer(c.first, level, RESUME)
      const next = draftSpokenAnswer(formed, level, RESUME)
      const r = sameAnswerRatio(first, next)
      if (r >= 0.5) fails.push(`${level}: follow-up repeats the first answer (Jaccard ${r.toFixed(2)})`)
      if (!next.toLowerCase().includes(c.keyword)) fails.push(`${level}: follow-up answer lacks "${c.keyword}"`)
      for (const issue of firstPersonIssues(next, formed)) fails.push(`${level}: ${issue}`)
      if (/following up on/i.test(next)) fails.push(`${level}: says the internal "following up on" tag aloud`)
    }
    const kw = questionKeywords(formed)
    if (!kw.some((k) => k.toLowerCase().includes(c.keyword.slice(0, 4)))) fails.push(`keywords miss the follow-up's word: ${kw.join("|")}`)
    return fails
  }
  if (c.kind === "provider") {
    const fails = []
    if (!isProviderErrorAnswer(c.raw)) fails.push("not recognised as a provider error")
    for (const level of LEVELS) if (settleSpokenAnswer("What is residual risk?", c.raw, level, RESUME).text) fails.push(`${level}: shown as an answer`)
    return fails
  }
  if (c.kind === "notProvider") return isProviderErrorAnswer(c.raw) ? ["a real answer is refused as a provider error"] : []
  if (c.kind === "numbers") {
    const out = applyGuards(c.sentence, null, new Set(), new Set()).text
    const kept = (c.sentence.match(/\d+/g) || []).filter((n) => out.includes(n))
    if (c.invented && kept.length) return [`invented figure kept: "${out}"`]
    if (!c.invented && out !== c.sentence) return [`structural figure rewritten: "${out}"`]
    return []
  }
  if (c.kind === "settle") {
    const fails = []
    for (const level of LEVELS) {
      const s = settleSpokenAnswer(c.q, c.raw, level, RESUME)
      for (const issue of [...speakable(s.text), ...firstPersonIssues(s.text, c.q).filter((i) => i !== "not first person")]) fails.push(`${level}: ${issue}`)
      if (/^(?:answer|short answer)\b/i.test(s.text)) fails.push(`${level}: reads out an "Answer" label`)
    }
    return fails
  }
  if (c.kind === "repeat") {
    const s = settleSpokenAnswer(c.q, c.raw, "director", RESUME, c.previous)
    return s.text && sameAnswerRatio(s.text, c.previous) >= 0.7 ? ["the previous answer is shown again"] : []
  }
  return [`unknown case kind ${c.kind}`]
}

export function runRound(index) {
  const cases = ROUNDS[index]
  const failures = []
  for (const c of cases) {
    const fails = judgeCase(c)
    if (fails.length) failures.push({ round: index + 1, family: c.family, ask: c.q || c.a || c.heard || c.follow || c.raw || c.sentence, fails: [...new Set(fails)] })
  }
  return { round: index + 1, checks: cases.length, answers: cases.filter((c) => c.kind === "answer").length * 3, failures }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] ? [Number(process.argv[2]) - 1] : ROUNDS.map((_, i) => i)
  let total = 0, failed = 0
  for (const i of only) {
    const r = runRound(i)
    total += r.checks
    failed += r.failures.length
    console.log(`\n=== round ${r.round}: ${r.checks} checks, ${r.failures.length} failing`)
    for (const f of r.failures) console.log(`- [${f.family}] ${String(f.ask).slice(0, 90)}\n    ${f.fails.join("\n    ")}`)
  }
  console.log(`\nTOTAL ${total} checks, ${failed} failing (offline, code-level only; not live answer quality)`)
  process.exitCode = failed ? 1 : 0
}
