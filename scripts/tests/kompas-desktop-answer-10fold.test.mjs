// Desktop 10-fold, 5 Nov 2026. Resume plus a job description, five pasted questions and five spoken ones.
// Code-level only: the offline stand-in, not a live model score and not a Windows session.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { draftSpokenAnswer, relativeGap, sameAnswerRatio, settleSpokenAnswer, wordCount } from "../../src/lib/kompasDissection.ts"
import { ungroundedLogisticsSentences } from "../../src/lib/kompasLogisticsPhrases.ts"
import { logisticsBackstop } from "../../src/lib/kompasLogistics.ts"
import { withoutLogistics } from "../../src/lib/kompasRelevance.ts"
import { desktopResponsePolicy, levelMetrics } from "../../src/lib/kompasDesktopResponse.ts"

const RESUME = readFileSync(new URL("../../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const JD = "Security analyst. Assess residual risk, policy exceptions, access reviews, and business impact."
const LEVELS = ["engineer", "director", "architect"]
const strip = (q) => logisticsBackstop(withoutLogistics(q))

const FOLDS = [
  { id: "pasted-definition", q: "What does residual risk mean?", skip: false },
  { id: "spoken-story", q: "um tell me about a time you challenged a weak remediation plan", skip: false },
  { id: "pasted-comparison", q: "What is the difference between a policy deviation and a policy exception?", skip: false },
  { id: "spoken-process", q: "how do you assess business impact and residual risk", skip: false },
  { id: "pasted-location", q: "Where are you based?", skip: true },
  { id: "spoken-address", q: "i live in dallas is that a problem", skip: true },
  { id: "pasted-code", q: "Write a Python function that returns the findings still open after 30 days.", skip: false },
  { id: "spoken-fact", q: "have you configured access reviews", skip: false },
  { id: "pasted-explain", q: "How would you explain least privilege to a new analyst?", skip: false },
  { id: "spoken-close", q: "what questions do you have for us", skip: false },
]

test("ten desktop folds: logistics questions stay quiet, the other eight stay apart and on the resume", () => {
  assert.equal(FOLDS.length, 10)
  assert.equal(FOLDS.filter((item) => item.skip).length, 2)
  assert.match(RESUME, /Chicago/)
  assert.doesNotMatch(RESUME, /H-1B|Austin|King Street/i)
  assert.doesNotMatch(JD, /visa|address|relocat/i)
  const rows = []
  for (const item of FOLDS) {
    const asked = strip(item.q)
    if (item.skip) {
      assert.equal(asked, "", item.id)
      continue
    }
    assert.ok(asked.length > 0, item.id)
    const policy = {}
    for (const level of LEVELS) {
      policy[level] = desktopResponsePolicy(level, asked).words
      const draft = draftSpokenAnswer(asked, level, `${RESUME}\n${JD}`)
      const settled = settleSpokenAnswer(asked, draft, level, RESUME)
      assert.equal(settled.providerError, false, item.id)
      assert.equal(ungroundedLogisticsSentences(settled.text, RESUME, asked).length, 0, `${item.id} ${level}: ${settled.text.slice(0, 140)}`)
      const spoken = settled.text.replace(/```[\s\S]*?```/g, " ")
      assert.ok(wordCount(spoken) > 0, item.id)
      if (item.id === "pasted-code") assert.ok(settled.text.startsWith("```"), level)
      rows.push({ id: item.id, question: asked, level, text: settled.text, words: wordCount(spoken) })
    }
    assert.ok(policy.director >= policy.engineer * 1.5 - 1, item.id)
    assert.ok(policy.architect >= policy.director * 1.5 - 1, item.id)
  }
  for (const level of LEVELS) {
    const mine = rows.filter((row) => row.level === level)
    for (let i = 0; i < mine.length; i++) {
      for (let j = 0; j < i; j++) {
        const ratio = sameAnswerRatio(mine[i].text, mine[j].text)
        assert.ok(ratio < 0.7, `${level} ${mine[i].id} vs ${mine[j].id} ratio ${ratio.toFixed(2)}`)
      }
    }
  }
  for (const question of new Set(rows.map((row) => row.question))) {
    const group = Object.fromEntries(rows.filter((row) => row.question === question).map((row) => [row.level, row.words]))
    for (const [a, b] of [["engineer", "director"], ["director", "architect"]]) {
      assert.ok(relativeGap(group[a], group[b]) >= 0.5, `${question.slice(0, 48)} ${a}=${group[a]} ${b}=${group[b]}`)
    }
  }
  const story = rows.find((row) => row.id === "spoken-story" && row.level === "engineer")
  assert.match(story.text, /\bI\b/)
  const metrics = LEVELS.map((level) => levelMetrics(level))
  assert.ok(relativeGap(metrics[0].depth, metrics[1].depth) >= 0.5)
  assert.ok(relativeGap(metrics[1].confidence, metrics[2].confidence) >= 0.5)
  assert.ok(relativeGap(metrics[0].length, metrics[1].length) >= 0.5)
})
