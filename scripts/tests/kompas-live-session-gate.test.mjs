import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const root = new URL("../../", import.meta.url)
const src = readFileSync(new URL("public/kompas/live-session.js", root), "utf8")
const fixture = JSON.parse(readFileSync(new URL("scripts/fixtures/kompas-live-session-s2b.json", root), "utf8"))
const ctx = vm.createContext({ globalThis: {} })
vm.runInContext(src, ctx)
const Gate = ctx.globalThis.KompasLiveSession

test("the latest interviewer question is the only one answered", () => {
  assert.equal(Gate.latestQuestion(fixture.offTopic.heard), fixture.offTopic.latest)
  const mixed = "Them: we covered KYC workflows\nYou: I mapped the identity checks\nThem: how would you prevent SQL injection in a login form?"
  assert.match(Gate.latestQuestion(mixed), /SQL injection/i)
  assert.doesNotMatch(Gate.latestQuestion(mixed), /KYC/i)
})

test("security ASR corrects SIEM, SOC, XSS, and KQL and keeps a SAM account", () => {
  for (const row of fixture.asr) {
    const out = Gate.correctSecurityAsr(row.heard)
    if (row.expect) assert.match(out, new RegExp(row.expect), row.heard)
    if (row.keep) assert.match(out, new RegExp(row.keep), row.heard)
  }
  assert.match(Gate.correctSecurityAsr("what is SAM"), /SIEM/)
  assert.match(Gate.correctSecurityAsr("what is a SAM account"), /SAM account/)
})

test("small talk, short lines, and an early pause do not fire", () => {
  for (const row of fixture.fires) {
    const decision = Gate.shouldFire(row)
    assert.equal(decision.fire, row.fire, row.id)
    if (row.reason) assert.equal(decision.reason, row.reason, row.id)
  }
})

test("a repeated Sentinel question fires once inside the dedupe window", () => {
  const now = 1_700_000_000_000
  const recent = []
  const fired = []
  for (const text of fixture.duplicates) {
    const decision = Gate.shouldFire({ text, pauseMs: 1200, recent, now })
    if (decision.fire) {
      fired.push(text)
      recent.push({ text, at: now })
    }
  }
  assert.equal(fired.length, 1)
  const follow = Gate.shouldFire({
    text: fixture.followUp.text,
    previous: fixture.followUp.previous,
    pauseMs: 2000,
    now,
  })
  assert.equal(follow.fire, false)
  assert.equal(follow.reason, "follow-up")
})

test("candidate speech is You and a Them label never stays in the header", () => {
  for (const row of fixture.speakers) {
    assert.equal(Gate.attributeSpeaker({ text: row.text, previousRole: row.previousRole, source: "system" }), row.role, row.text)
  }
  for (const row of fixture.headers) {
    const header = Gate.questionHeader(row.text)
    assert.equal(header, row.header)
    assert.doesNotMatch(header, /\bThem:/)
  }
})

test("a question split across speakers still forms v2-1", () => {
  const joined = Gate.joinSplitQuestion(fixture["v2-1"])
  assert.equal(joined.length, 1)
  assert.equal(joined[0].role, "Interviewer")
  assert.match(joined[0].text, /rotational shifts working 24\/7/)
  const decision = Gate.shouldFire({ text: joined[0].text, pauseMs: 1200 })
  assert.equal(decision.fire, true, decision.reason)
})

test("ending a session produces a summary", () => {
  const summary = Gate.sessionSummary({
    cards: [
      { question: "How would you prevent SQL injection in a login form?", answer: "I parameterized the queries." },
      { question: "What tools have you worked on in Microsoft Sentinel?", answer: "…" },
    ],
    turns: [
      { who: "Them", text: "How are you doing today?" },
      { who: "You", text: "I am doing well." },
    ],
  })
  assert.match(summary.text, /^Session summary/)
  assert.equal(summary.questions.length, 2)
  assert.match(summary.text, /SQL injection in a login form\? - answered/)
  assert.match(summary.text, /Microsoft Sentinel\? - heard/)
  assert.doesNotMatch(summary.text, /How are you/)
})

test("the page installer waits out the start timeout and loads the gate", () => {
  const install = readFileSync(new URL("public/kompas/live-session-install.js", root), "utf8")
  const caption = readFileSync(new URL("public/kompas/caption-once.js", root), "utf8")
  assert.match(install, /ms === 12000/)
  assert.match(install, /sessionSummary/)
  assert.match(install, /latestQuestion/)
  assert.match(install, /__kompasLiveCapped/)
  assert.match(caption, /live-session\.js/)
  const html = readFileSync(new URL("public/kompas/index.html", root), "utf8")
  assert.match(html, /id="autoBtn"[^>]*aria-pressed="true"/)
  assert.doesNotMatch(html.slice(html.indexOf('id="moreMenu"'), html.indexOf('id="startBtn"')), /id="autoBtn"/)
  assert.match(html, /id="tabPreview"[^>]*hidden/)
  const aside = readFileSync(new URL("public/kompas/answer-aside.css", root), "utf8")
  const styles = readFileSync(new URL("public/kompas/styles.css", root), "utf8")
  assert.match(aside, /min-width:min\(100%, 18rem\)/)
  assert.match(aside, /#overlay\.bridge-open #answer/)
  assert.match(styles, /@media \(max-width:640px\)/)
  assert.match(styles, /#tabPreview\.tab-preview/)
})
