// Consistency gate. Each pattern runs 20 times on the same input.
// The gate is local, so a pass is the same answer every time. No model call.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { cacheMayServe, clarifyingFromQuestion, gateDisplayedAnswer, HONEST_LINE, sameQuestion, speakableLines } from "../../src/lib/kompasConsistency.ts"
import { judgeRewrite } from "../../src/lib/kompasRepair.ts"
import { presentSpokenAnswer, withoutInventedNumbers } from "../../src/lib/kompasAnswerPresentation.ts"
import { enforceResumeState, NO_RESUME_REFUSAL } from "../../src/lib/kompasAnswerContract.ts"
import { visibleLengthBand } from "../../src/lib/kompasDissection.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
const asideJs = readFileSync(new URL("../../public/kompas/answer-aside.js", import.meta.url), "utf8")

const SOC = [
  "Senior SOC Analyst — First National Bank | 2021 – Present",
  "Led the response to a critical ransomware incident across 40 endpoints and contained it in 6 hours.",
  "Investigated phishing email reports from employees and traced each sender through the mail gateway.",
  "Used CrowdStrike to isolate a host and Splunk to search the related alerts for the same campaign.",
  "Prioritized Qualys findings by exploitability, closing 12 internet-facing critical items in one week.",
  "Contained a ransomware outbreak by isolating the affected segment before it reached the other endpoints.",
].join("\n")

const SOC_QUESTIONS = [
  {
    type: "story",
    question: "Tell me about a time you led the response to a critical security incident.",
    answer: [
      "I led the response when ransomware hit a file server at First National Bank.",
      "I opened the bridge, confirmed the host in CrowdStrike, and had the network team cut that segment off.",
      "I pulled the related alerts in Splunk and matched them to the phishing mail that started the chain.",
      "We isolated 40 endpoints and kept the rest of the floor online.",
      "I then walked the desk through what was encrypted and what was still clean.",
      "The containment finished in 6 hours, and the 12 Qualys findings tied to that path were closed the same week.",
      "I stayed on the bridge until the owner signed the all-clear.",
      "The result was a contained incident, a written timeline, and no second wave that night.",
    ].join(" "),
  },
  {
    type: "howto",
    question: "How would you investigate a phishing email reported by an employee?",
    answer: [
      "I start with the message the employee forwarded and I do not click anything in it.",
      "I read the sender, the reply-to, and the link host, then I search Splunk for the same subject across the mail gateway.",
      "If a host opened it, I check CrowdStrike for the process that ran and I isolate that one machine.",
      "I tell the employee what I found and what I need them to watch for next.",
      "I close the loop by blocking the sender and noting the 6 related alerts I actually saw.",
    ].join(" "),
  },
  {
    type: "comparison",
    question: "Explain the difference between EDR and SIEM, and when you would use each.",
    answer: [
      "I use EDR when I need the host: CrowdStrike shows me the process, the file, and whether that machine should be isolated.",
      "I use the SIEM when I need the trail across systems: Splunk shows me the mail, the login, and the other alerts from the same hour.",
      "On the ransomware incident I used both, because the host told me what ran and the SIEM told me how far the mail had spread.",
      "I do not pick one and ignore the other when the question is an active incident.",
      "EDR is the isolation decision. The SIEM is the search that tells me who else got the same mail.",
    ].join(" "),
  },
  {
    type: "howto",
    question: "Walk me through how you would contain a ransomware outbreak across 200 endpoints.",
    answer: [
      "I would treat the 200 endpoints as the scope the question named, and I would not claim I had already done that exact count.",
      "I start by isolating the hosts that CrowdStrike shows as encrypting, then I cut the segment those hosts share.",
      "I search Splunk for the same hash and the same user so I know which of the 200 are actually in the blast radius.",
      "I leave the clean machines online and I tell the owner which segment is down.",
      "On the bank incident I contained 40 endpoints in 6 hours by doing that isolation first.",
    ].join(" "),
  },
  {
    type: "howto",
    question: "How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?",
    answer: [
      "I do not treat every Qualys critical as the same kind of work.",
      "I put the internet-facing findings first, then the ones with a known exploit, then the ones on a host that CrowdStrike already shows as noisy.",
      "At the bank I closed 12 of those internet-facing items in one week and left the internal-only ones in the queue.",
      "I tell the owner the 12 I am fixing now and the reason the rest can wait a cycle.",
      "The scan stays the source. I do not invent a second scanner to make the list look shorter.",
    ].join(" "),
  },
]

function fold(name, run) {
  test(`${name} is the same on all 20 folds`, () => {
    const first = run()
    const words = []
    for (let i = 0; i < 20; i++) {
      const next = run()
      assert.deepEqual(next, first, `${name} fold ${i + 1}`)
      if (next && typeof next.words === "number") words.push(next.words)
    }
    if (words.length) assert.equal(new Set(words).size, 1)
  })
}

fold("stale book does not beat the live question", () => {
  const stale = cacheMayServe({
    liveQuestion: "Walk me through MITRE ATT&CK for this detection.",
    cachedQuestion: "Explain the difference between EDR and SIEM.",
    liveEpoch: 4,
    cacheEpoch: 1,
    liveSession: "soc",
    cacheSession: "soc",
  })
  const exact = cacheMayServe({
    liveQuestion: "Explain the difference between EDR and SIEM, and when you would use each.",
    cachedQuestion: "Explain the difference between EDR and SIEM, and when you would use each.",
    liveEpoch: 4,
    cacheEpoch: 4,
    liveSession: "soc",
    cacheSession: "soc",
  })
  const otherSession = cacheMayServe({
    liveQuestion: "How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?",
    cachedQuestion: "How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?",
    liveEpoch: 2,
    cacheEpoch: 2,
    liveSession: "live",
    cacheSession: "earlier",
  })
  assert.equal(stale, false)
  assert.equal(exact, true)
  assert.equal(otherSession, false)
  assert.equal(sameQuestion("Explain the difference between EDR and SIEM.", "What is MITRE ATT&CK?"), false)
  return { stale, exact, otherSession }
})

fold("the confirm stub never stays on the card", () => {
  const gated = gateDisplayedAnswer({
    question: "Tell me about a time you led the response to a critical security incident.",
    raw: "I would want to confirm that.",
    source: SOC,
  })
  assert.equal(gated.text, HONEST_LINE)
  assert.equal(gated.ok, true)
  assert.doesNotMatch(gated.text, /I would want to confirm that/)
  return gated.text
})

fold("an invented tool is not shown, and a grounded sentence stays", () => {
  const invented = gateDisplayedAnswer({
    question: "Tell me about a time you led the response to a critical security incident.",
    raw: "I deployed SentinelOne and IBM QRadar across the estate.",
    source: SOC,
  })
  assert.equal(invented.text, HONEST_LINE)
  assert.doesNotMatch(invented.text, /SentinelOne|QRadar/)
  const kept = judgeRewrite(["missing example"], [], ["missing example"], ["advisory note"], true)
  const dropped = judgeRewrite(["missing example"], ["missing example", "new problem"], [], [], false)
  assert.equal(kept, 1)
  assert.equal(dropped, 0)
  return { invented: invented.text, kept, dropped }
})

fold("display keeps more than two sentences inside the ceiling", () => {
  const question = "Explain the difference between EDR and SIEM, and when you would use each."
  const raw = SOC_QUESTIONS[2].answer
  const shown = presentSpokenAnswer(question, raw, SOC)
  const sentences = shown.split(/(?<=[.!?])\s+/).filter(Boolean)
  assert.ok(sentences.length > 2, shown)
  const band = visibleLengthBand(question)
  const gated = gateDisplayedAnswer({ question, raw, source: SOC })
  assert.ok(gated.words <= band.ceiling)
  assert.ok(gated.words >= band.floor, `${gated.words} under ${band.floor}`)
  assert.equal(gated.reasons.includes("under-floor"), false)
  return { sentences: sentences.length, words: gated.words, type: gated.type }
})

fold("left answer drops connector prefixes, generic lines, headings, and repeats", () => {
  const question = "How would you investigate a phishing email reported by an employee?"
  const raw = [
    "**Claim**",
    "- First, - I start with the message the employee forwarded.",
    "In general, teams start by opening the attachment.",
    "I start with the message the employee forwarded.",
    "I search Splunk for the same subject and I check CrowdStrike if a host opened it.",
    "Next they build a playbook no one asked for.",
  ].join("\n")
  const shown = presentSpokenAnswer(question, raw, SOC)
  assert.doesNotMatch(shown, /First, -|\*\*Claim\*\*|In general, teams|they build/i)
  assert.equal((shown.match(/I start with the message/gi) || []).length, 1)
  assert.match(shown, /I search Splunk/)
  return shown
})

fold("the right panel is a say-now line or a question the ask itself opened", () => {
  const alone = "Did you design it alone?"
  const clarify = clarifyingFromQuestion(alone)
  assert.match(clarify.join(" "), /overall design|failover/)
  assert.equal(clarifyingFromQuestion("How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?").length, 0)
  const lines = speakableLines("How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?", SOC)
  assert.ok(lines.length >= 1)
  assert.match(lines.join(" "), /\bI\b/)
  assert.match(lines.join(" "), /\byou\b/)
  assert.doesNotMatch(lines.join(" "), /what part of this do you want first|want me to keep this short/i)
  assert.doesNotMatch(lines.join(" "), /jayeshwar44|eshwarjay05/)
  return { clarify: clarify[0], line: lines[0] }
})

fold("the pre-display gate does not return a raw dump", () => {
  const raw = "**Claim**\nI would want to confirm that.\nIn general, teams deploy SentinelOne.\n**Result**\nI led the response."
  const gated = gateDisplayedAnswer({
    question: "Tell me about a time you led the response to a critical security incident.",
    raw,
    source: SOC,
  })
  assert.notEqual(gated.text, raw)
  assert.doesNotMatch(gated.text, /I would want to confirm that|\*\*Claim\*\*|In general, teams|SentinelOne/)
  assert.equal(gated.ok, true)
  return gated.text
})

test("SOC questions stay in band across 20 folds", () => {
  const report = []
  for (const row of SOC_QUESTIONS) {
    let seen = null
    for (let fold = 0; fold < 20; fold++) {
      const gated = gateDisplayedAnswer({ question: row.question, raw: row.answer, source: SOC })
      assert.equal(gated.ok, true, `${row.question} ${gated.reasons.join(",")}`)
      assert.equal(gated.type, visibleLengthBand(row.question).type)
      assert.ok(gated.words >= gated.floor && gated.words <= gated.ceiling, `${row.type} ${gated.words} outside ${gated.floor}-${gated.ceiling}`)
      assert.doesNotMatch(gated.text, /I would want to confirm that|SentinelOne|QRadar|In general, teams/)
      if (row.question.startsWith("Have you done") || gated.type === "experience") {
        assert.equal(gated.reasons.includes("thin-example"), false)
      }
      if (!seen) seen = gated
      else {
        assert.equal(gated.text, seen.text)
        assert.equal(gated.words, seen.words)
      }
    }
    report.push({ type: seen.type, words: seen.words, floor: seen.floor, aim: seen.aim, ceiling: seen.ceiling, question: row.question.slice(0, 48) })
  }
  const byType = {}
  for (const row of report) byType[row.type] = row
  assert.equal(byType.story.aim, 120)
  assert.equal(byType.comparison.aim, 100)
  assert.ok(report.every((row) => row.words >= row.floor && row.words <= row.ceiling))
  assert.equal(visibleLengthBand("Have you done Qualys work at the bank?").aim, 85)
  assert.equal(visibleLengthBand("Tell me about yourself.").aim, 120)
  assert.equal(visibleLengthBand("How did you verify that?").aim, 70)
  assert.equal(visibleLengthBand("What is a SIEM?").aim, 35)
  assert.equal(visibleLengthBand("What is EDR and how would you use it?").type, "definition-application")
  console.log("SOC 20-fold word counts " + JSON.stringify(report))
})

test("a missing resume does not become a made-up career, and labels keep their digits", () => {
  const qa = "I am a Senior QA Automation Engineer with extensive experience building test frameworks. My first engineering project was building an automated test framework for a legacy banking application."
  const gated = enforceResumeState(qa, "personal-no-resume")
  assert.equal(gated.text, NO_RESUME_REFUSAL)
  assert.doesNotMatch(gated.text, /QA Automation|legacy banking|test framework/)
  const labels = withoutInventedNumbers("At L1 they pull logs, at L2 they hunt, and at L3 they decide. Routers and layer-3 switches forward packets.", "Senior SOC Analyst")
  assert.match(labels, /L1/)
  assert.match(labels, /L2/)
  assert.match(labels, /L3/)
  assert.match(labels, /layer-3/)
  const second = presentSpokenAnswer("What reports do you prepare as SOC L1?", "As an L1 you primarily monitor every alert. I document the indicators and escalate the ones that need a person.", "SOC L1 alerts")
  assert.doesNotMatch(second, /As an L1 you/)
  assert.match(second, /I document/)
  const qualys = presentSpokenAnswer("How do you prioritize vulnerabilities from a Qualys scan when everything is marked critical?", "First, I map each finding. Next, I check the exposure. Finally, I rank what is left. This approach lets teams focus remediation effort where it reduces risk most effectively.", "Qualys")
  assert.doesNotMatch(qualys, /lets teams focus|First,|Next,|Finally,/)
})

test("the page and the service no longer prefer the stale paths", () => {
  assert.doesNotMatch(app, /bestScore >= 0\.75/)
  assert.doesNotMatch(app, /ordered\.slice\(0, 2\)/)
  assert.match(app, /sameAsk\(q, it\.q\)/)
  assert.match(app, /loadedAnchor/)
  assert.match(app, /running \? stop\(true\) : start\(\)/)
  assert.match(app, /function questionEnded/)
  assert.match(service, /confirmSurface: false/)
  assert.match(service, /prep\.identity = ""/)
  assert.doesNotMatch(asideJs, /What part of this do you want first/)
  assert.match(asideJs, /Say this/)
  assert.match(asideJs, /No resume is stored on this device/)
})
