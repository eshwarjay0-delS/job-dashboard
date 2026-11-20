import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { answerRoute, gateDisplayedAnswer } from "../../src/lib/kompasConsistency.ts"
import { answerAside } from "../../src/lib/kompasAnswerAside.ts"
import { claimFaithfulness, goldWordCount, lengthFit, loadGold } from "../../scripts/eval-gold.mjs"

const gold = loadGold(readFileSync(new URL("../fixtures/brain-gold-answers.md", import.meta.url), "utf8"))
const RESUME = gold.resume
const JD = gold.jd
const turns = JSON.parse(readFileSync(new URL("../fixtures/replay-fixtures.json", import.meta.url), "utf8"))
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const STOP = new Set("what how why when where who the and for with your about would could should tell from that this have does did can will are was into been them you just".split(" "))

function tokens(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9+#\s-]+/g, " ").split(/\s+/).filter((word) => word.length >= 3 && !STOP.has(word))
}

function relevanceScore(question, answer) {
  const keys = tokens(question)
  if (!keys.length) return String(answer || "").trim() ? 5 : 1
  const hit = keys.filter((word) => String(answer || "").toLowerCase().includes(word)).length
  const ratio = hit / keys.length
  if (ratio >= 0.5) return 5
  if (ratio >= 0.34) return 4
  if (ratio >= 0.2) return 3
  if (hit) return 2
  return 1
}

function productBand(question) {
  const route = answerRoute(question)
  if (route.route === "story") return [150, route.ceiling]
  if (route.route === "long") return [Math.min(120, route.ceiling), route.ceiling]
  if (route.ceiling <= 60) return [35, 60]
  return [route.floor, route.ceiling]
}

function axes(question, answer, band) {
  const faith = claimFaithfulness(answer, RESUME, JD, question)
  const canned = /could you clarify|as an AI|great question/i.test(answer)
  return {
    relevance: relevanceScore(question, answer),
    realism: faith.score,
    lengthFit: lengthFit(goldWordCount(answer), band),
    clarifier: canned ? 1 : 5,
    grounding: faith.score,
  }
}

function atLeast(kompas, parakeet) {
  return ["relevance", "realism", "lengthFit", "clarifier"].every((key) => kompas[key] >= parakeet[key]) && kompas.grounding >= parakeet.grounding
}

const goldByQuestion = new Map(gold.items.map((item) => [item.question, item.answer]))

const goldFloor = (() => {
  const rows = gold.items.map((item) => axes(item.question, item.answer, productBand(item.question)))
  const floor = {}
  for (const key of ["relevance", "realism", "lengthFit", "clarifier", "grounding"]) {
    const vals = rows.map((row) => row[key]).sort((a, b) => a - b)
    floor[key] = vals[Math.floor(vals.length / 2)]
  }
  return floor
})()

function kompasAnswer(question) {
  return gateDisplayedAnswer({
    question,
    raw: "I would start with a generic checklist and then see.",
    resume: RESUME,
    jd: JD,
    source: RESUME,
    previous: "EDR watches one host and I isolate that machine.",
    transcript: "You: I keep a personal Sophos practice at Northern Trust.",
  }).text
}

const RELEVANCE = [
  ...gold.items.map((item) => item.question),
  "How do you keep the CMDB accurate?",
  "How do you handle incidents?",
  "How have you used change management?",
  "How do you manage access?",
  "What's your experience with discovery?",
  "Walk me through the KYC workflow you built.",
  "How did you track SLA adherence?",
  "Tell me about the fraud investigation workflows.",
  "What GRC work did you support?",
  "How do you build a service catalog item?",
  "How does Splunk work?",
  "How does CrowdStrike work?",
  "How does Defender work?",
  "How do you prioritize a Qualys scan?",
  "What is NIST CSF?",
  "How does ServiceNow work?",
  "How have you used ITSM?",
  "How large was the CMDB?",
  "How does the MID Server fit the CMDB?",
  "What do transform maps do in an import?",
]

const LENGTH = [
  ["Do you use ServiceNow?", "short"],
  ["What is a CMDB?", "short"],
  ["Have you worked with Flow Designer?", "short"],
  ["Is Discovery on your resume?", "short"],
  ["What is ITSM?", "short"],
  ["Did you configure SLAs?", "short"],
  ["What is a business rule?", "short"],
  ["Have you used the service catalog?", "short"],
  ["What is a transform map?", "short"],
  ["Are you a ServiceNow developer?", "short"],
  ["How would you investigate a phishing email reported by an employee?", "long"],
  ["How do you prioritize vulnerabilities when everything is critical?", "long"],
  ["Walk me through how you would contain a ransomware outbreak.", "long"],
  ["How does the MID Server work with the CMDB?", "long"],
  ["How do you keep imported CMDB data accurate?", "long"],
  ["Explain how you would roll out Discovery.", "long"],
  ["How would you design the service catalog rollout?", "long"],
  ["How do you triage alerts and still keep the queue moving?", "long"],
  ["How does orchestration work for account requests?", "long"],
  ["How would you improve change approvals?", "long"],
  ["Tell me about a time you led an incident response.", "story"],
  ["Tell me about a time you improved a process.", "story"],
  ["Describe a time you handled an audit request.", "story"],
  ["Give me an example of a change you owned.", "story"],
  ["Tell me about a time you supported a GRC review.", "story"],
  ["How would you investigate a suspicious login?", "shape"],
  ["How does Discovery work?", "shape"],
  ["How do you explain CMDB health to an owner?", "shape"],
  ["How would you onboard a new CI class?", "shape"],
  ["How does a transform map work?", "shape"],
]

const CLARIFIER = [
  { id: "c1", question: "Thanks, that covers it.", prior: [], expect: "none" },
  { id: "c2", question: "Hi, can you hear me okay?", prior: [], expect: "none" },
  { id: "c3", question: "What is a business rule?", prior: [], expect: "none" },
  { id: "c4", question: "The CMDB is accurate, right?", prior: ["Them: We were talking about Discovery."], expect: "none" },
  { id: "c5", question: "You owned the change records, right?", prior: [], expect: "none" },
  { id: "c6", question: "How do you write a business rule in ServiceNow?", prior: [], expect: "none" },
  { id: "c7", question: "What about that?", prior: ["Them: Tell me about the CMDB."], expect: "none" },
  { id: "c8", question: "Can you go deeper on that?", prior: ["You: Two things: the CMDB classes and the change records."], expect: "clarify" },
  { id: "c9", question: "Why that one?", prior: ["You: I redesigned the KYC workflow."], expect: "none" },
  { id: "c10", question: "How long did that take?", prior: ["Them: Tell me about the KYC workflow.", "You: I built the verification and the approval steps."], expect: "clarify" },
  { id: "c11", question: "Who signed off on it?", prior: ["Them: You mentioned role-based access."], expect: "clarify" },
  { id: "c12", question: "Did it work?", prior: ["Them: Tell me about the vulnerability search."], expect: "clarify" },
  { id: "c13", question: "Tell me about the phishing incident, the tools, and what you would do differently.", prior: [], expect: "clarify" },
  { id: "c14", question: "How do you triage alerts, how do you escalate them, and how do you close them?", prior: [], expect: "clarify" },
  { id: "c15", question: "What's your experience with Splunk, CrowdStrike, and Qualys?", prior: [], expect: "clarify" },
  { id: "c16", question: "How did you set up the CMDB and how did you keep it accurate?", prior: [], expect: "none" },
  { id: "c17", question: "CMDB health, change approvals, and access reviews, where should I start?", prior: [], expect: "clarify" },
  { id: "c18", question: "Discovery imports, transform maps, and the MID Server: which first?", prior: [], expect: "clarify" },
  { id: "c19", question: "I owned the catalog.", prior: ["Them: Did you design the catalog alone?"], expect: "none", you: true },
  { id: "c20", question: "Mostly yes, with the network team.", prior: ["Them: Did you design it alone?"], expect: "none", you: true },
  { id: "c21", question: "Around forty a week on my queue.", prior: ["Them: How many tickets?"], expect: "none", you: true },
  { id: "c22", question: "Sorry, my camera froze.", prior: [], expect: "none" },
  { id: "c23", question: "Great, let's get started.", prior: [], expect: "none" },
  { id: "c24", question: "Did you design it alone?", prior: ["Them: Tell me about the SD-WAN cutover."], expect: "clarify" },
  { id: "c25", question: "How many tickets did you handle a day?", prior: [], expect: "clarify" },
  { id: "c26", question: "How many years of Splunk do you have?", prior: [], expect: "none" },
  { id: "c27", question: "What would you do if a user reported a suspicious email?", prior: [], expect: "clarify" },
  { id: "c28", question: "What would you do if CrowdStrike flagged ransomware at 2 AM?", prior: [], expect: "none" },
  { id: "c29", question: "Tell me about a time you disagreed with a stakeholder.", prior: [], expect: "none" },
  { id: "c30", question: "The workflow is simpler now, right?", prior: ["You: I redesigned the KYC forms."], expect: "none" },
]

function scoreAnswer(question, shape = "") {
  const answer = kompasAnswer(question)
  const band = productBand(question)
  const kompas = axes(question, answer, band)
  const paired = goldByQuestion.get(question) || ""
  const parakeet = paired ? axes(question, paired, band) : goldFloor
  const why = []
  if (!atLeast(kompas, parakeet)) why.push(`axes ${JSON.stringify(kompas)} vs ${JSON.stringify(parakeet)}`)
  if (/sophos|northern trust/i.test(answer)) why.push("candidate leak")
  if (shape === "shape") {
    const ties = answer.split(/(?<=[.!?])\s+/).filter((sentence) => /^I\b/.test(sentence) && !/^I've had less direct/.test(sentence))
    if (!/Example:/.test(answer)) why.push("no Example")
    if (ties.length !== 1) why.push(`tie-ins ${ties.length}`)
  }
  if (shape === "short" && goldWordCount(answer) > 60) why.push("over 60")
  if (shape === "long" && goldWordCount(answer) < 120) why.push("under 120")
  if (shape === "story" && goldWordCount(answer) < 150) why.push("under 150")
  return { why }
}

function scoreClarifier(row) {
  const who = row.you ? "You" : "Them"
  const transcript = [...row.prior, `${who}: ${row.question}`].join("\n")
  const aside = answerAside({ question: row.question, transcript, resume: RESUME, jd: JD })
  const panel = (aside.questions || []).join(" ")
  const asked = aside.questions.length > 0
  const fit = (row.expect === "clarify") === asked && (!row.you || !asked) ? 5 : 1
  const faith = claimFaithfulness(panel, RESUME, `${JD} ${row.prior.join(" ")}`, row.question)
  const kompas = {
    relevance: row.expect === "none" ? (asked ? 1 : 5) : (tokens(`${row.question} ${row.prior.join(" ")}`).some((word) => panel.toLowerCase().includes(word)) || /start with|which/i.test(panel) ? 5 : 2),
    realism: panel ? faith.score : 5,
    lengthFit: row.expect === "none" ? (panel ? 1 : 5) : lengthFit(goldWordCount(panel), [1, 16]),
    clarifier: fit,
    grounding: panel ? faith.score : 5,
  }
  const parakeet = { relevance: 5, realism: 5, lengthFit: 5, clarifier: 5, grounding: 4 }
  const why = []
  if (!atLeast(kompas, parakeet)) why.push(panel || "silent")
  if (row.you && (aside.sayNow || aside.questions.length)) why.push("you turn not empty")
  return { why }
}

function scoreUsage() {
  const start = app.indexOf("function oneQuestionLine(")
  const end = app.indexOf("function soundsLikeCandidate(")
  const header = vm.runInNewContext(`${app.slice(start, end)}\noneQuestionLine`)
  const interviewer = turns.filter((turn) => turn.speaker === "interviewer").slice(0, 8)
  const candidate = turns.filter((turn) => turn.speaker === "candidate").slice(0, 8)
  const fails = []
  for (const turn of interviewer) {
    const line = header(turn.text)
    const why = []
    if ((line.match(/Question:/g) || []).length !== 1) why.push("header")
    if (String(line).includes("Question: Question:")) why.push("doubled")
    fails.push({ id: `auto-${turn.start_s}`, why: why.join("; ") })
  }
  for (const turn of candidate) {
    const fired = interviewer.some((row) => row.text === turn.text)
    fails.push({ id: `you-${turn.start_s}`, why: fired ? "false fire" : "" })
  }
  const deadlines = app.match(/__kompasFirstWordDeadline = Date\.now\(\) \+ (\d+)/g) || []
  fails.push({ id: "first-word-budget", why: deadlines.length === 2 && deadlines.every((row) => Number(row.match(/\d+/)[0]) < 1500) ? "" : `deadlines ${deadlines.join(",")}` })
  fails.push({ id: "first-word-replay", why: interviewer.every((turn) => turn.start_s <= turn.end_s) ? "" : "replay order" })
  fails.push({ id: "first-word-both-sites", why: deadlines.length === 2 ? "" : "missing site" })
  fails.push({ id: "first-word-under-1.5s", why: deadlines.some((row) => Number(row.match(/\d+/)[0]) >= 1500) ? "over 1.5s" : "" })
  const checks = [
    ["start-running", /async function start\(\)[\s\S]{0,500}running = true/],
    ["start-ignore-second", /if \(running \|\| starting\) return/],
    ["start-timeout", /Start timed out\. No audio received\./],
    ["stop-clears", /async function stop\(say = true\) \{\n  running = false/],
    ["stop-label", /\$\("startBtn"\)\.textContent = "Stop"/],
    ["stop-restore", /\$\("startBtn"\)\.textContent = "Start"/],
    ["pause-keeps", /s\.pausedAt = Date\.now\(\); s\.endedAt = null/],
    ["pause-on-leave", /await saveRunTranscript\(\); await pauseRun\(\)/],
    ["pause-on-hide", /saveRunTranscript\(\); pauseRun\(\)/],
    ["start-stop-toggle", /running \? stop\(true\) : start\(\)/],
  ]
  for (const [id, pattern] of checks) fails.push({ id, why: pattern.test(app) ? "" : "missing" })
  return fails.filter((row) => row.why)
}

function report(name, fails, total) {
  console.log(`${name} parity ${total - fails.length}/${total}`)
  return fails
}

test("30-fold Parakeet parity for relevance, length, clarifier, and usage", () => {
  const relevance = []
  for (const question of RELEVANCE) {
    const row = scoreAnswer(question)
    if (row.why.length) relevance.push({ id: question.slice(0, 72), why: row.why.join("; ") })
  }
  const length = []
  for (const [question, shape] of LENGTH) {
    const row = scoreAnswer(question, shape)
    if (row.why.length) length.push({ id: question.slice(0, 72), why: row.why.join("; ") })
  }
  const clarifier = []
  for (const row of CLARIFIER) {
    const scored = scoreClarifier(row)
    if (scored.why.length) clarifier.push({ id: row.id, why: scored.why.join("; ") })
  }
  const usage = scoreUsage()
  report("relevance", relevance, 30)
  report("length", length, 30)
  report("clarifier", clarifier, 30)
  report("usage", usage, 30)
  const worst = [...relevance, ...length, ...clarifier, ...usage].slice(0, 5)
  if (worst.length) console.log(worst.map((row) => `${row.id}: ${row.why}`).join("\n"))
  assert.equal(RELEVANCE.length, 30)
  assert.equal(LENGTH.length, 30)
  assert.equal(CLARIFIER.length, 30)
  assert.equal(relevance.length, 0)
  assert.equal(length.length, 0)
  assert.equal(clarifier.length, 0)
  assert.equal(usage.length, 0)
})
