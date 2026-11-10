// The question on the card is the question in the prompt. Offline. No model key
// is required: this asserts the real assembly path, not a generated paragraph.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { questionForAnswer, canonicalQuestion, classify, matchBank } from "../../src/lib/kompasAnswer.ts"
import { sheetTopicMatch, interviewSignOff, ANSWER_SHAPE, SIGN_OFF_LINE } from "../../src/lib/kompasSheetMatch.ts"
import vm from "node:vm"
import { interviewIntent } from "../../src/lib/kompasRelevance.ts"
import { rediscoverRelevance } from "../../src/lib/kompasRelevanceRecovery.ts"
import { questionKernel } from "../../src/lib/kompasIntentKernel.ts"
import { routeAnswer } from "../../src/lib/kompasJevRoute.ts"
import { retrievePassages, sourceDocs, sourcePassagesPrompt } from "../../src/lib/kompasSourceRetrieval.ts"

const RESUME = `
IAM and GRC analyst. CyberArk privileged access and secure remote access.
One-time passwords for vault users. SailPoint joiner mover leaver.
Splunk SIEM. Onboarded syslog and API log sources. SAST with Fortify and DAST with Burp.
Qualys vulnerability management. TPRM vendor questionnaires.
NIST CSF and ISO 27001. Incident response for phishing.
`
const DOCS = sourceDocs({ resume: RESUME, jd: "SOC analyst. IAM, SIEM, vulnerability management, TPRM, NIST.", documents: "" })
const STALE = "Them: What is a one-time password?\nYou: I would use a one-time password for vault users.\n"

const QUESTIONS = [
  "What is a log aggregator or syslog relay and when would you use one?",
  "Can you walk me through how you configured the syslog relay to the SIEM?",
  "What is the difference between SAST and DAST?",
  "How does the IAM lifecycle work for a joiner, mover, and leaver?",
  "When would you use MFA instead of a one-time password?",
  "Walk me through your incident response steps after a phishing email.",
  "How do you run vulnerability management from scan to exception?",
  "What is third-party risk management and how do you assess a vendor?",
  "How do you map a control to NIST CSF and ISO 27001?",
  "Tell me about yourself.",
  "Why do you want this role?",
  "Tell me about a time you handled a difficult stakeholder.",
  "What is least privilege?",
  "How would you investigate a failed privileged session in CyberArk?",
  "Explain zero trust in one minute.",
  "What logs would you check first for an impossible-travel alert?",
  "How do you tune a noisy SIEM rule without hiding a real attack?",
  "What is the difference between a vulnerability and a threat?",
  "How do you write a risk acceptance?",
  "Can you explain your experience with SAST and DAST?",
  "What is a SOC and what does an analyst do on shift?",
  "How do you onboard a new log source?",
  "What is privileged access management?",
  "How would you respond if ransomware encrypted a file share?",
  "What is a compensating control?",
  "How do you evidence a control for an auditor?",
  "Tell me about a time something went wrong and what you did.",
  "What questions do you have for us?",
  "How do you separate duties in an IAM tool?",
  "What is syslog?",
  "Can you explain the difference between authentication, authorization, and access control?",
  "How would you test whether authorization is enforced consistently across both UI and API layers?",
  "How would you implement security controls in a CI/CD pipeline without allowing developers to bypass them?",
  "How would you handle a manual security scanner outage without unnecessarily stopping every software deployment?",
  "How would you identify malicious or compromised third-party packages entering the CI pipeline?",
  "How would you monitor suspicious package activity and coordinate incident response?",
  "Let's say a critical vulnerability is reported in a shared Java library and that library is used by 150 applications. How would you determine which applications are affected and prioritize remediation?",
  "Security identifies a critical vulnerability, but the development team disputes the finding. How would you organize the technical review so that both teams can agree on the outcome?",
]

const YT = JSON.parse(readFileSync(new URL("./fixtures/kompas-yt-interview.json", import.meta.url), "utf8"))
for (const row of YT.questions) QUESTIONS.push(row.q)

const LPL_CLOSE = "That is going to be it for the questions. I appreciate our conversation. Thank you for taking the time out of your day to speak to me. I will speak to your editor and we will get back to you regarding the next steps."

const SHEET = [
  { q: "Tell me about yourself.", a: "I am an IAM and GRC analyst.", projectId: "p1" },
  { q: "Why are you leaving your current role?", a: "I want to go deeper on detection.", projectId: "p1" },
  { q: "What is your greatest strength?", a: "I connect identity work to audit evidence.", projectId: "p1" },
  { q: "How do you secure remote access for privileged users?", a: "CyberArk privileged access and one-time passwords for vault users.", projectId: "p-cyberark" },
  { q: "Tell me about a time you rolled out one-time passwords.", a: "One-time passwords for vault users in CyberArk.", projectId: "p-cyberark" },
  { q: "Walk me through SailPoint joiner mover leaver.", a: "SailPoint identity lifecycle, joiner mover leaver, access reviews.", projectId: "p-sail" },
  { q: "How did you onboard log sources into Splunk?", a: "Onboarded syslog and API log sources into the SIEM.", projectId: "p-siem" },
  { q: "Tell me about a phishing incident you handled.", a: "Incident response for a phishing campaign.", projectId: "p-ir" },
  { q: "How do you map controls to NIST and ISO?", a: "NIST CSF and ISO 27001 control mapping.", projectId: "p-grc" },
  { q: "What is your experience with Qualys?", a: "Vulnerability management with Qualys.", projectId: "p-vm" },
  { q: "How do you run a vendor questionnaire?", a: "TPRM questionnaires for vendors.", projectId: "p-tprm" },
  { q: "Have you used SAST and DAST tools?", a: "SAST with Fortify and DAST with Burp.", projectId: "p-appsec" },
]

function looseBank(q, questions) {
  const words = (s) => new Set((String(s).toLowerCase().match(/[a-z0-9]{3,}/g) || []))
  const qt = words(q)
  let best = null, bestScore = 0
  for (const item of questions) {
    let ov = 0
    for (const t of words(item.q)) if (qt.has(t)) ov++
    if (ov > bestScore) { bestScore = ov; best = item }
  }
  return bestScore >= 2 ? best : null
}

function sentQuestion(question) {
  const resolved = questionForAnswer(question, question, true, false, [{ q: "What is a one-time password?", a: "I would use a one-time password." }])
  const rediscovered = rediscoverRelevance(resolved, STALE)
  const { tier } = classify(rediscovered.currentAsk || resolved)
  return canonicalQuestion(rediscovered.currentAsk || resolved, tier)
}

function promptFor(question) {
  const sent = sentQuestion(question)
  const recovery = rediscoverRelevance(sent, STALE)
  const lane = routeAnswer({
    question: sent,
    questionClass: interviewIntent(sent),
    retrieval: retrievePassages(sent, DOCS, 4),
    confirmSurface: false,
    outOfLane: false,
    audience: "engineer",
  })
  const passages = sourcePassagesPrompt(retrievePassages(sent, DOCS, 4))
  const primary = `ANSWER ONLY THIS:\n${sent}\n\n${ANSWER_SHAPE}\n\n${recovery.currentAsk ? "Current ask: " + recovery.currentAsk + "\n" : ""}${passages}\n\nANSWER ONLY THIS, and nothing beside it: "${sent}"`
  return { sent, lane, primary }
}

test("the ask kernel keeps the subject of a compound question", () => {
  const ask = questionKernel("What is a log aggregator or syslog relay and when would you use one?").ask
  assert.match(ask, /log aggregator/)
  assert.match(ask, /syslog/)
  assert.match(ask, /when would you use one/)
})

test("impossible-travel is not classified as personal travel logistics", () => {
  assert.notEqual(interviewIntent("What logs would you check first for an impossible-travel alert?"), "logistics")
})

for (const question of QUESTIONS) {
  test("prompt keeps this question: " + question.slice(0, 64), () => {
    const { sent, lane, primary } = promptFor(question)
    assert.equal(sent.replace(/\s+/g, " ").trim(), question)
    assert.equal(lane.action, "go")
    assert.equal(lane.callModel, true)
    assert.match(primary, /ANSWER ONLY THIS:\n/)
    assert.ok(primary.includes(question), "primary instruction lost the question")
    assert.equal(primary.split(question).length - 1 >= 2, true)
    assert.doesNotMatch(primary, /I would want to confirm that/)
    assert.doesNotMatch(primary, /What is a one-time password\?/)
  })
}

test("the live route does not turn a middling experience score into the spoken blank", () => {
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(service, /confirmSurface: false/)
  assert.match(service, /canonicalQuestion\(rediscovered\.currentAsk \|\| question, tier\)/)
  assert.match(service, /ANSWER_SHAPE/)
  assert.match(service, /VOICE_RULES/)
  assert.match(service, /if \(interviewSignOff\(question\)\) return signOffResponse/)
})

test("a prepared sheet entry is used only when it is the same question", () => {
  const asked = QUESTIONS.filter((q) => q !== LPL_CLOSE)
  let beforeWrong = 0, afterWrong = 0, covered = 0
  for (const q of asked) {
    const loose = looseBank(q, SHEET)
    const strict = matchBank(q, SHEET)
    const truly = SHEET.some((item) => sheetTopicMatch(q, item.q))
    if (truly) covered++
    if (loose && !sheetTopicMatch(q, loose.q)) beforeWrong++
    if (strict && !sheetTopicMatch(q, strict.q)) afterWrong++
    if (!sheetTopicMatch(q, "Tell me about a time you rolled out one-time passwords.")) {
      assert.notEqual(strict && strict.q, "Tell me about a time you rolled out one-time passwords.")
    }
  }
  assert.equal(afterWrong, 0)
  assert.ok(beforeWrong > covered, `loose sheet match was wrong on ${beforeWrong} of ${asked.length}; strict coverage ${covered}`)
  assert.ok(beforeWrong / asked.length >= 0.5)
})

test("LPL closing pleasantry is a short thank-you, not a technical answer", () => {
  assert.equal(sentQuestion(LPL_CLOSE), LPL_CLOSE)
  assert.equal(interviewSignOff(LPL_CLOSE), true)
  assert.equal(interviewSignOff(QUESTIONS[0]), false)
  assert.match(SIGN_OFF_LINE, /Thank you/)
  assert.doesNotMatch(SIGN_OFF_LINE, /CyberArk|Citi|syslog|SIEM|Alex/)
  const words = SIGN_OFF_LINE.split(/\s+/).length
  assert.ok(words >= 20 && words <= 60)
})

test("the page uses the same sheet topic rule as the server", () => {
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const start = app.indexOf("const SHEET_INTRO")
  const end = app.indexOf("function bookMatch(")
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(app.slice(start, end) + "\nthis.m = sheetTopicMatch;", ctx)
  for (const q of QUESTIONS) {
    for (const item of SHEET) assert.equal(ctx.m(q, item.q), sheetTopicMatch(q, item.q), q + " vs " + item.q)
  }
  assert.equal(ctx.m(LPL_CLOSE, SHEET[3].q), false)
})
