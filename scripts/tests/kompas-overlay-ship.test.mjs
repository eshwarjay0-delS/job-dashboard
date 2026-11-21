// Session start, window controls, transcript bridge lines, and the bold cycle.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import reauth from "../../public/kompas/session-reauth.js"
import bridge from "../../public/kompas/bridge-lines.js"

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8")
const app = read("public/kompas/app.js")
const html = read("public/kompas/index.html")
const css = read("public/kompas/styles.css")
const main = read("legacy/perfact/desktop/main.js")
const { decideSessionStart, NOT_READY } = reauth
const BANNED = /resume|not on|won't lie|can't claim|won't make|not directly/i

test("a flaky answer check starts the session and does not show the blocking banner", () => {
  for (const input of [
    { httpStatus: 503, code: "OPENROUTER_NOT_CONFIGURED", authDisabled: true, interviewLive: false, ready: false },
    { httpStatus: 0, message: "The operation was aborted", authDisabled: true, interviewLive: false },
    { httpStatus: 500, ready: false, authDisabled: false, interviewLive: false, hasSession: true },
  ]) {
    const decision = decideSessionStart(input)
    assert.equal(decision.action, "proceed")
    assert.equal(decision.autoSignIn, false)
    assert.equal(decision.message, "")
    assert.notEqual(decision.message, NOT_READY)
  }
  assert.match(app, /checkSessionReadiness\(\{ background: true \}\)/)
  assert.doesNotMatch(app, /await checkSessionReadiness\(\); return/)
  assert.doesNotMatch(app, /button\.textContent = "Check again"/)
})

test("minimize stays minimized and the title bar sits above the preview", () => {
  assert.doesNotMatch(main, /win\.restore\(\); setCollapsed\(true\)/)
  assert.match(main, /win\.on\("minimize", \(\) => \{[\s\S]*setSkipTaskbar\(false\)/)
  assert.match(main, /ipcMain\.on\("kompas:close"/)
  assert.match(css, /z-index:480 !important/)
  assert.match(css, /right:12px;bottom:42px/)
  assert.match(css, /width:168px/)
  assert.match(html, /id="boldBtn"/)
  assert.ok(html.indexOf('id="boldBtn"') < html.indexOf('id="textMinus"'))
})

test("answer weight defaults to normal, cycles bold then semi, and the answer pane is sans", () => {
  assert.match(app, /const ANSWER_WEIGHTS = \{ bold: 700, semi: 500, normal: 400 \}/)
  assert.match(app, /LS\.get\("answerWeight", "normal"\)/)
  assert.match(app, /const order = \["bold", "semi", "normal"\]/)
  assert.match(css, /#answer,#answer li,#answer li\.passage[\s\S]*font-family:var\(--sans\) !important/)
  assert.match(css, /font-weight:var\(--answer-weight, 400\) !important/)
  assert.doesNotMatch(css, /font-weight:var\(--answer-weight, 560\)/)
})

test("bridge lines are not a local template, and the junk sentence cannot be produced", () => {
  const junk = "So on heard zero vulnerability, given what you said about pmand more.listeningyou pmilisteningyou, I'd weigh exposure first."
  const src = read("public/kompas/bridge-lines.js")
  assert.doesNotMatch(src, /So on \$\{topic\}/)
  assert.doesNotMatch(src, /function considerations/)
  assert.deepEqual(bridge.bridgeLines({
    turns: [
      { who: "Them", text: "heard zero vulnerability" },
      { who: "You", text: "pmand more.listeningyou pmilisteningyou" },
    ],
    question: "heard zero vulnerability",
  }), [])
  assert.equal(bridge.acceptLine(junk), "")
  const cleaned = bridge.cleanTurns([
    { who: "Them", text: "INTERVIEWER tell me about the principle of least privilege" },
    { who: "You", text: "pmand more.listeningyou" },
  ])
  assert.ok(cleaned.some((turn) => /least privilege/i.test(turn.text)))
  assert.ok(cleaned.every((turn) => !/listeningyou|pmand/i.test(turn.text)))
  assert.doesNotMatch(cleaned.map((turn) => turn.text).join(" "), BANNED)
})
