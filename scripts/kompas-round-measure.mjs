// Local scoreboard for Kompas rounds 36-55. No model, no network.
import { readFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { draftSpokenAnswer, sameAnswerRatio, wordCount, dissectQuestion } from "../src/lib/kompasDissection.ts"
import { scoreSpokenAnswer } from "../src/lib/kompasAnswerQuality.ts"
import { answerAside, asideModeFromTranscript } from "../src/lib/kompasAnswerAside.ts"
import { presentSpokenAnswer, sectionOrder } from "../src/lib/kompasAnswerPresentation.ts"
import { selectAnswerContext } from "../src/lib/kompasLongContext.ts"
import { utteranceTag } from "../src/lib/kompasUtterance.ts"
import { defensibilityReport } from "../src/lib/kompasDefensibility.ts"
import { contentRelevance } from "../src/lib/kompasAnswerQuality.ts"
import { captureEarly } from "../src/lib/kompasLongContext.ts"
import { replayBrain } from "../src/lib/kompasBrain.ts"

const RESUME = readFileSync(new URL("../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const CASES = JSON.parse(readFileSync(new URL("./fixtures/kompas-evaluation/interview-50.json", import.meta.url), "utf8"))
const LEVELS = ["engineer", "director", "architect"]

function draftsFor(question) {
  const out = {}
  for (const level of LEVELS) out[level] = draftSpokenAnswer(question, level, RESUME)
  return out
}

const rows = CASES.map((item) => ({ q: item.question, kind: item.kind, ...draftsFor(item.question) }))
let pairs = 0
let under = 0
let high = 0
let maxJ = 0
let over = 0
let archDesign = 0
let archTangent = 0
let dirN = 0
let dirTrade = 0
let starWords = []
let defWords = []
let keepGoing = 0
let starN = 0
let hrWords = []
let hrJargon = 0
let hrN = 0
const JARGON = /\b(?:NIST|OAuth|SAML|Kerberos|OIDC|JWT|SIEM|Kubernetes)\b/g

for (const row of rows) {
  const cut = dissectQuestion(row.q, RESUME)
  for (let i = 0; i < LEVELS.length; i++) {
    for (let j = i + 1; j < LEVELS.length; j++) {
      pairs++
      const gap = 1 - sameAnswerRatio(row[LEVELS[i]], row[LEVELS[j]])
      if (gap < 0.5) under++
      const jac = sameAnswerRatio(row[LEVELS[i]], row[LEVELS[j]])
      if (jac >= 0.7) high++
      if (jac > maxJ) maxJ = jac
    }
    for (const level of LEVELS) {
      const words = wordCount(row[level].replace(/```[\s\S]*?```/g, " "))
      if (words > cut.modes[level].maxWords) over++
    }
  }
  if (/\bdesign\b/i.test(row.q)) {
    archDesign++
    if (/\btangent\b|\bout of scope\b/i.test(row.architect)) archTangent++
  }
  dirN++
  if (/\brather\b|\btrade-?off\b/i.test(row.director)) dirTrade++
  const shape = cut.shape
  if (shape === "personal-experience" || row.kind === "business-followup") {
    starN++
    starWords.push(wordCount(row.engineer))
    if (/keep going/i.test(row.engineer)) keepGoing++
  }
  if (shape === "definition" || row.kind === "definition") defWords.push(wordCount(row.engineer))
  if (/technical HR/i.test(row.q)) {
    hrN++
    hrWords.push(wordCount(row.engineer))
    hrJargon += (row.engineer.match(JARGON) || []).length
  }
}

function median(list) {
  if (!list.length) return 0
  const s = [...list].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]
}

const keywordOnly = [
  ["Tell me about a time you challenged a weak remediation plan.", "remediation plan challenged weak."],
  ["Design a rate limiter for the public API.", "rate limiter public API design."],
  ["How does the access review check fail closed?", "access review check fail closed."],
]
let keywordFours = 0
for (const [q, text] of keywordOnly) {
  if (contentRelevance(q, text) === 4) keywordFours++
}

const complexQ = "Design a rate limiter for the public API."
const simpleQ = "What is least privilege?"
const complexCard = presentSpokenAnswer(complexQ, draftsFor(complexQ).architect, RESUME)
const simpleCard = presentSpokenAnswer(simpleQ, draftsFor(simpleQ).engineer, RESUME)

const yes = draftsFor("Have you worked with Splunk?")
const design = draftsFor("Design a rate limiter for the public API.")

const partial = "how would you design the"
const early = /^(?:what|how|why|when|where|who|which|tell me|describe|walk me|design)\b/i.test(partial)

const lines = []
for (let n = 0; n < 620; n++) {
  lines.push({ who: "Them", text: `The batch finished pass ${n} and the owner kept the old path in place for the review.`, at: n })
}
lines.push({ who: "Them", text: "What was the state of the system when you joined and what were your specific contributions?", at: 9999 })
const t0 = performance.now()
const picked = selectAnswerContext(lines)
const ms = performance.now() - t0

const PASSAGES = [
  { text: "So the way we handle handoffs is the control owner signs the exception before the release.", expect: "boosters" },
  { text: "Have you worked with the nightly batch?", expect: "questions" },
  { text: "Any questions before we wrap up?", expect: "questions" },
  { text: "The audit evidence disagrees with the live setting, and that is the part I want to explain.", expect: "boosters" },
  { text: "Walk me through a time the rollback failed.", expect: "questions" },
  { text: "What constraint should we treat as fixed on the cache?", expect: "questions" },
]
let modeOk = 0
let brief = 0
let natural = 0
let relevant = 0
let linesN = 0
for (const row of PASSAGES) {
  const aside = answerAside({ question: row.text, transcript: `Them: ${row.text}`, resume: RESUME })
  if (asideModeFromTranscript(`Them: ${row.text}`, row.text) === row.expect) modeOk++
  const pool = row.expect === "questions" ? aside.questions : aside.boosters
  for (const line of pool) {
    linesN++
    const words = line.split(/\s+/).length
    if (words <= 18) brief++
    if (!/\b(?:delve|tapestry|leverage|great question)\b/i.test(line) && words >= 3) natural++
    const bag = row.text.toLowerCase()
    const hit = line.toLowerCase().split(/\s+/).some((w) => w.length >= 5 && bag.includes(w))
    if (hit || (row.expect === "questions" && /\?$/.test(line))) relevant++
  }
}

const LONG = "So the control owner signs the exception before the release and the audit pack has to match the live setting or the release waits and the owner hears what is still open before anyone calls it done today."
const replay = replayBrain([
  { who: "Them", text: "So the control owners are spread across three teams and the handoff is where it stalls.", action: "booster" },
  { who: "You", text: "I'm available in the Pittsburgh area, on site.", action: "hold" },
  { who: "Them", text: "So you would only work remote, right?", action: "flag-contradiction" },
  { who: "Them", text: LONG, action: "summarize" },
  { who: "Them", text: "Have you worked with Flow Designer?", action: "short-answer" },
  { who: "Them", text: "How would you design the", action: "prewarm" },
  { who: "Them", text: "Any questions before we wrap up?", action: "clarify" },
  { who: "Them", text: "What is Flow Designer?", action: "clarify" },
], RESUME)

const report = defensibilityReport(
  "In an emergency change during a freeze, what do you do first, who has the authority, and how do you confirm it worked?",
  "I draft the ticket. The tool flagged it.",
)

const board = {
  pairs,
  under050: under,
  jaccardAtLeast07: high,
  maxJaccard: +maxJ.toFixed(3),
  overCeiling: over,
  keywordOnlyRelevance4: keywordFours,
  architectTangent: `${archTangent}/${archDesign}`,
  directorTradeoff: `${dirTrade}/${dirN}`,
  starMedianEngineer: median(starWords),
  definitionMedianEngineer: median(defWords),
  starKeepGoing: `${keepGoing}/${starN}`,
  technicalHrMedian: median(hrWords),
  technicalHrJargonHits: hrJargon,
  technicalHrN: hrN,
  complexHasHeadings: sectionOrder(complexCard).join(">"),
  simpleIsPlain: !/\*\*/.test(simpleCard),
  yesNoWords: wordCount(yes.engineer),
  designArchitectWords: wordCount(design.architect),
  earlyPartialDetected: early,
  longContextMs: +ms.toFixed(2),
  longContextQuestionOk: picked.question.startsWith("What was the state"),
  asideMode: `${modeOk}/${PASSAGES.length}`,
  asideBrief: `${brief}/${linesN}`,
  asideNatural: `${natural}/${linesN}`,
  asideRelevant: `${relevant}/${linesN}`,
  thinAnswerPassesDefensibility: report.pass,
  thinHardFlags: report.hardFlags.length,
  earlyCapture: captureEarly("how would you design the"),
  brainAccuracy: replay.accuracy,
  brainMeanMs: +replay.meanMs.toFixed(3),
  brainMaxMs: +replay.maxMs.toFixed(3),
  brainContradictionRate: replay.contradictionRate,
}
console.log(JSON.stringify(board, null, 2))
