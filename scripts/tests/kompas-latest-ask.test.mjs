// Latest queued question, the two-second fold, cache bust, and the locks from #397 and 12 Nov.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import latest from "../../public/kompas/latest-ask.js"
import reauth from "../../public/kompas/session-reauth.js"

const require = createRequire(import.meta.url)
const taskbar = require("../../legacy/perfact/desktop/taskbar-choice.cjs")
const loopback = require("../../legacy/perfact/desktop/output-loopback.cjs")
const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8")
const app = read("public/kompas/app.js")
const html = read("public/kompas/index.html")
const css = read("public/kompas/styles.css")
const panel = read("legacy/perfact/desktop/panel.css")
const main = read("legacy/perfact/desktop/main.js")
const presentation = read("src/lib/kompasAnswerPresentation.ts")
const memory = read("src/lib/kompasSessionMemory.ts")

function ask(text, seq) { return { who: "Them", text, seq }; }

test("fourteen queued questions answer the latest, not the oldest", () => {
  const lines = []
  for (let i = 1; i <= 13; i++) lines.push(ask("What is question " + i + "?", i))
  lines.push(ask("How would you design the service catalog?", 14))
  assert.equal(latest.countQueuedAsks(lines), 14)
  assert.equal(latest.selectLatestQueuedAsk(lines), "How would you design the service catalog?")
  assert.match(app, /selectLatestQueuedAsk\(pending\)/)
  assert.match(app, /if \(latest && queued >= 2\) liveResolved = latest/)
})

test("a short follow-up stays with the question it points at", () => {
  const lines = [ask("What is CyberArk?", 1), ask("And why?", 2)]
  assert.match(latest.selectLatestQueuedAsk(lines), /What is CyberArk\? And why\?/)
})

test("the next two seconds fold in only when the words change the question", () => {
  const base = "How would you design the service catalog?"
  assert.equal(latest.foldLateContext(base, "uh").changed, false)
  assert.equal(latest.foldLateContext(base, "service catalog").changed, false)
  const folded = latest.foldLateContext(base, "for the HR cases in ServiceNow")
  assert.equal(folded.changed, true)
  assert.match(folded.question, /HR cases in ServiceNow/)
  assert.equal(latest.LATE_CONTEXT_MS, 2000)
  assert.match(app, /lateFold: true/)
  assert.match(app, /noteLateContext\(who, text\)/)
})

test("a manual press schedules the request inside 100ms and does not wait out the old flush", () => {
  const t0 = 1_000
  const plan = latest.answerPressSchedule(t0, t0 + 40)
  assert.equal(plan.startDelayMs, 0)
  assert.equal(plan.startNow, true)
  assert.ok(plan.elapsedMs < 100)
  assert.equal(plan.lateContextMs, 2000)
  const late = latest.answerPressSchedule(t0, t0 + 1500)
  assert.equal(late.startNow, false)
  assert.match(app, /answerPressSchedule\(pressAt, pressAt\)/)
  assert.match(app, /if \(!fromAuto\) \{[\s\S]{0,240}Do not wait on flushHeard before the request/)
  assert.match(app, /\} else if \(\(running && captures\.length\) \|\| finals\.size\) \{[\s\S]{0,120}await flushHeard\(1500\)/)
})

test("the page and the desktop shell load this build, not the 12 Nov cache", () => {
  assert.equal(JSON.parse(read("public/kompas/version.json")).build, "kompas-20261128-brain")
  assert.match(html, /window\.PERFACT_BUILD = "kompas-20261128-brain"/)
  assert.match(html, /app\.js\?v=20261128-brain/)
  assert.match(html, /styles\.css\?v=20261127-fold/)
  assert.match(main, /PAGE_BUILD = "kompas-20261128-brain"/)
  assert.match(main, /cache-control", "no-store"/)
  assert.doesNotMatch(html, /app\.js\?v=20261112-output/)
})

test("desktop rows use the full width and the in-session tab preview is video only", () => {
  assert.match(css, /justify-content:space-evenly !important/)
  assert.match(css, /width:100% !important/)
  assert.doesNotMatch(css, /right:200px !important/)
  assert.match(panel, /#tabPreview,html\.kd \.tab-preview/)
  assert.doesNotMatch(css, /#tabPreview\{display:none !important/)
  assert.match(css, /#tabPreview:not\(\.hidden\):not\(\[hidden\]\)\{display:block/)
  assert.match(app, /previewVideoTracks/)
  assert.match(app, /new MediaStream\(tracks\)/)
})

test("spoken answers, the clarify popup, memory, grounding, opacity, and the bottom row stay", () => {
  assert.match(presentation, /function presentSpokenAnswer/)
  assert.doesNotMatch(presentation, /First, \$\{items/)
  assert.match(html, /answer-aside\.js\?v=20261127-fold/)
  assert.match(memory, /turns\.slice\(-6\)/)
  assert.match(app, /--answer-weight/)
  assert.match(app, /function placeAskRow/)
  assert.match(css, /html\.kd \.card-prefs/)
})

test("skip-login, WASAPI loopback, and a remembered yes stay intact", () => {
  const off = reauth.decideSessionStart({ httpStatus: 401, code: "signed_out", authDisabled: true, interviewLive: false })
  assert.equal(off.action, "proceed")
  assert.equal(off.autoSignIn, false)
  const quota = reauth.decideSessionStart({ httpStatus: 402, code: "exceed_egress_quota", noticeCode: "egress_quota", interviewLive: false })
  assert.equal(quota.action, "explain")
  assert.equal(quota.egress, true)
  const quotaOff = reauth.decideSessionStart({ httpStatus: 402, code: "exceed_egress_quota", authDisabled: true, interviewLive: false })
  assert.equal(quotaOff.action, "proceed")
  assert.equal(quotaOff.autoSignIn, false)
  assert.equal(loopback.loopbackCapture().audio, "loopback")
  assert.equal(loopback.loopbackCapture().pinnedDevice, "")
  assert.deepEqual(taskbar.taskbarAnswer(0, false), { hide: true, remember: true })
  assert.deepEqual(taskbar.taskbarAnswer(1, true), { hide: false, remember: false })
  assert.equal(taskbar.rememberedTaskbar({ hideTaskbarRemembered: true, hideTaskbar: true }).ask, false)
})
