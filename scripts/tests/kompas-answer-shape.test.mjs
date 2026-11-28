import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { answerRoute, extendFromModel, gateDisplayedAnswer, jdGapBridge } from "../../src/lib/kompasConsistency.ts"
import { dropUnknownToolSentences } from "../../src/lib/kompasGuards.ts"
import { goldWordCount, loadGold } from "../../scripts/eval-gold.mjs"

const gold = loadGold(readFileSync(new URL("../fixtures/brain-gold-answers.md", import.meta.url), "utf8"))
const RESUME = [
  "Senior ServiceNow Developer at McKesson.",
  "Assists with ServiceNow platform incident resolution and tracks each ticket from creation to closure.",
  "Closed 12 change requests in one quarter and kept the business updated while the work moved.",
  "Built fraud investigation workflows for evidence, escalation, and audit documentation.",
  "Configured role-based access controls and segregation of duties for finance teams.",
  "Created dashboards for SLA adherence and compliance status across the business applications.",
  "Maintained the CMDB classes and their relationships so discovery imports stayed accurate.",
  "Implemented change workflows with approvals, so each request had an owner and a due date.",
  "Supported GRC and security operations processes, including evidence for audit reviews.",
  "Monitored the open incidents each morning and sent the status to the business owners.",
].join(" ")

function median(nums) {
  const sorted = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

test("a short technical answer is extended and closes on a resume example", () => {
  const gated = gateDisplayedAnswer({
    question: "How would you investigate a phishing email?",
    raw: "I start with the message the employee forwarded.",
    resume: RESUME,
    source: RESUME,
  })
  // Owner, 22 Nov 2026 (no-clubbing rule): the extension only appends facts
  // relevant to the question — it must NOT force the 120-word floor by pasting
  // off-topic resume lines. This fixture has one relevant fact (the fraud
  // investigation workflows line), so the answer is extended with that and
  // stays well under 120 rather than clubbing in ServiceNow/CMDB lines.
  assert.ok(gated.words >= 15, `words ${gated.words}`)
  assert.match(gated.text, /fraud investigation workflows/)
  assert.doesNotMatch(gated.text, /ServiceNow platform|CMDB classes|role-based access controls/)
  // Owner, 22 Nov 2026: a first-person answer keeps its first-person shape — the thesis
  // ("I would answer this directly") must never be prepended. It leaked as the whole Q8
  // answer across three live rounds when the model's first-person body was filtered out.
  assert.doesNotMatch(gated.text, /I would answer this directly/)
  assert.match(gated.text, /^I start with the message the employee forwarded\./)
  assert.doesNotMatch(gated.text, /comes down to one point|what this question is about/)
  assert.doesNotMatch(gated.text, /^Having\b|great question/i)
  if (gated.ceiling >= 120) assert.match(gated.text, /Example:/)
  const bullets = gated.text.split("\n").filter((line) => /^\s*[-•]/.test(line))
  assert.ok(bullets.length <= 8)
})

test("a JD-only tool is a hands-on bridge, not a stub", () => {
  const bridged = gateDisplayedAnswer({
    question: "How do you use Splunk?",
    raw: "That is not on my resume, so I will not invent it.",
    resume: RESUME,
    jd: "Splunk ES, CrowdStrike, Qualys",
    source: RESUME,
  })
  assert.doesNotMatch(bridged.text, /less direct hands-on|transfers because|not on my resume|would want to confirm/)
  const bridge = jdGapBridge("How do you use Splunk?", RESUME, "Splunk ES")
  assert.doesNotMatch(bridge, /less direct hands-on|transfers because|haven't used|don't have my resume/)
  assert.match(bridge, /\bI\b/)
  const kept = dropUnknownToolSentences(`I maintained the CMDB. ${bridge}`, RESUME)
  assert.match(kept, /I maintained the CMDB/)
  assert.doesNotMatch(kept, /less direct hands-on|transfers because/)
})

test("the thesis sentence is never streamed to the screen", () => {
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  // Owner, 22 Nov 2026: the thesis ("I would answer this directly: <question>") must never reach
  // the screen — it leaked as the whole Q8 answer across three live rounds when the final replace
  // did not cleanly overwrite it. The final answer comes from the replace event only.
  assert.ok(!service.includes("technicalThesis(job.question)"))
})

test("a technical answer keeps its first-person shape, one example, and one resume line", () => {
  const gated = gateDisplayedAnswer({
    question: "How would you investigate a phishing email?",
    raw: "I start with the message the employee forwarded and I do not click the link.",
    resume: RESUME,
    source: RESUME,
  })
  const sentences = gated.text.split(/(?<=[.!?])\s+/)
  // Owner, 22 Nov 2026: no thesis opener — the answer starts with the model's own
  // first-person sentence, not "I would answer this directly".
  assert.doesNotMatch(gated.text, /I would answer this directly/)
  assert.match(sentences[0], /^I start with the message the employee forwarded/)
  assert.match(gated.text, /Example:/)
})

test("how a missing tool works stays on that tool and adds the gap bridge", () => {
  const gated = gateDisplayedAnswer({
    question: "How does Splunk work?",
    raw: "EDR watches the host and I isolate the machine. A SIEM searches the mail.",
    previous: "EDR watches the host and I isolate the machine.",
    resume: RESUME,
    jd: "Splunk ES",
    source: RESUME,
  })
  assert.doesNotMatch(gated.text, /less direct hands-on|transfers because|haven't used/)
  assert.match(gated.text, /\bI\b/)
})

test("a candidate's Sophos practice does not enter the answer", () => {
  const gated = gateDisplayedAnswer({
    question: "How do you handle endpoint tools?",
    raw: "I keep a personal Sophos practice at home. I assist with ServiceNow incident resolution at McKesson.",
    resume: RESUME,
    source: RESUME,
    transcript: "You: I keep a personal Sophos practice at home.",
  })
  assert.doesNotMatch(gated.text, /Sophos|personal Sophos practice/i)
  assert.match(gated.text, /ServiceNow|McKesson/)
})

test("a candidate's employer from the transcript never enters the answer", () => {
  const gated = gateDisplayedAnswer({
    question: "Tell me about a time you led an incident.",
    raw: "At Northern Trust I led the fraud program for 40 people. I assist with ServiceNow incident resolution at McKesson and closed 12 change requests.",
    resume: RESUME,
    jd: "SOC analyst",
    source: RESUME,
    transcript: "You: At Northern Trust I led the fraud program.",
  })
  assert.doesNotMatch(gated.text, /Northern Trust/)
  assert.match(gated.text, /ServiceNow|McKesson|12/)
})

test("the model extends only when resume facts still miss the floor", async () => {
  let calls = 0
  const resume = "I tracked incidents at McKesson."
  const held = await extendFromModel("How would you investigate a phishing email?", "word ".repeat(160), resume, "", async () => { calls++; return "extra" })
  assert.equal(calls, 0)
  assert.ok(held.startsWith("word"))
  const grown = await extendFromModel("How would you investigate a phishing email?", "I start with the message.", resume, "", async () => {
    calls++
    return "I tracked incidents at McKesson and kept each ticket moving until it closed."
  })
  assert.equal(calls, 1)
  assert.match(grown, /McKesson/)
  const blocked = await extendFromModel("How would you investigate a phishing email?", "I start with the message.", resume, "", async () => "I deployed NotATool across Northern Trust.")
  assert.doesNotMatch(blocked, /NotATool|Northern Trust/)
})

test("gold replay median is measured after the floor binds", () => {
  const buckets = { short: [], long: [], story: [] }
  for (const item of gold.items) {
    const gated = gateDisplayedAnswer({
      question: item.question,
      raw: item.answer.split(/\s+/).slice(0, 40).join(" "),
      resume: gold.resume,
      jd: gold.jd,
      source: gold.resume,
    })
    buckets[answerRoute(item.question).route].push(gated.words)
  }
  const shorts = median(buckets.short)
  const longs = median(buckets.long)
  const stories = median(buckets.story)
  // Owner, 22 Nov 2026 (no-clubbing rule): a concept or personal question
  // with no resume fact relevant to it ("Tell me about yourself", "Why did
  // you choose cybersecurity", "roles of L1, L2 and L3 in a SOC") stays at
  // the model's length rather than getting an unrelated resume fact pasted on
  // just to reach the floor. So the short median no longer binds to 70 — the
  // model's length is the floor when nothing is relevant — but items WITH a
  // relevant fact must still reach the band.
  assert.ok(shorts >= 40, `short median ${shorts}`)
  // Owner, 22 Nov 2026 (Round 12): the extension now appends first-person
  // facts via asFact, never a raw bullet — so a conceptual question with no
  // relevant resume fact ("What do you know about routing?" — networking is
  // not in the gold resume) stays at the model's length rather than getting a
  // pasted bullet. Only items WITH a relevant fact reach the band, so the
  // in-band count is 1 (the SOC reports question), not 2.
  assert.ok(buckets.short.filter((n) => n >= 70 && n <= 120).length >= 1, `short in-band ${JSON.stringify(buckets.short)}`)
  // Owner, 22 Nov 2026 (no-clubbing rule): the gold resume is a ServiceNow
  // fixture, so security questions (EDR/SIEM, ransomware, Qualys) have no
  // relevant fact in it — they stay at the model's length rather than getting
  // an unrelated ServiceNow fact pasted on. The medians no longer bind to
  // the floor; the invariant is that items WITH a relevant fact extend and
  // nothing gets clubbed.
  assert.ok(longs >= 50, `long median ${longs}`)
  // Owner, 22 Nov 2026 (Round 11): a story answer IS the narrative — the
  // shared tail no longer appends an Example or extends a story question, so
  // a truncated gold story stays at the model's length.
  // Owner, 22 Nov 2026 (Round 12): the verbatim filter also drops a pasted
  // resume sentence from a gold story, so the median sits just under the
  // 40-word truncation — the story is the model's narrative, not a paste.
  assert.ok(stories >= 30, `story median ${stories}`)
  console.log(`replay median short ${shorts} long ${longs} story ${stories}`)
})
