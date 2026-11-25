// P0 overlay: readiness never blocks Start, window controls stay clickable,
// the clarifier is its own popup, and the B button owns the answer weight.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { JSDOM } from "jsdom"
import readiness from "../../public/kompas/readiness-probe.js"

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8")
const app = read("public/kompas/app.js")
const html = read("public/kompas/index.html")
const css = read("public/kompas/styles.css")
const asideCss = read("public/kompas/answer-aside.css")
const aside = read("public/kompas/answer-aside.js")
const main = read("legacy/perfact/desktop/main.js")
const preload = read("legacy/perfact/desktop/preload.js")
const { classifyProbe, probeReadiness, NOT_READY } = readiness

test("a probe timeout still starts and names the timeout", async () => {
  const decision = await probeReadiness(async () => {
    const err = new Error("The operation was aborted")
    err.name = "TimeoutError"
    throw err
  }, { timeoutMs: 50, backoff: [], origin: "https://job-dashboard-fawn.vercel.app" })
  assert.equal(decision.start, true)
  assert.equal(decision.ready, false)
  assert.equal(decision.fallback, true)
  assert.equal(decision.reason, "timeout")
  assert.equal(decision.banner, NOT_READY)
  assert.equal(classifyProbe({ timedOut: true, status: 0, elapsedMs: 1800 }).reason, "timeout")
})

test("4xx and 5xx still start and keep the fallback chain", async () => {
  for (const status of [400, 404, 401, 503, 500, 502]) {
    const decision = await probeReadiness(async () => ({ status, ready: false, body: { ready: false } }), {
      timeoutMs: 50, backoff: [],
    })
    assert.equal(decision.start, true, String(status))
    assert.equal(decision.ready, false, String(status))
    assert.equal(decision.fallback, true, String(status))
    assert.equal(decision.reason, status >= 500 ? "5xx" : "4xx", String(status))
    assert.equal(decision.banner, NOT_READY, String(status))
  }
})

test("a cross-origin desktop origin still starts", () => {
  const decision = classifyProbe({ status: 0, ready: false, origin: "kompas://app", elapsedMs: 40 })
  assert.equal(decision.desktopOrigin, true)
  assert.equal(decision.reason, "cross-origin")
  assert.equal(decision.start, true)
  assert.equal(decision.ready, false)
  assert.equal(decision.fallback, true)
  assert.match(main, /const ORIGIN = "kompas:\/\/app"/)
  assert.match(app, /crossOrigin: \/\^kompas:\/i\.test\(origin\)/)
})

test("a slow cold start that does answer still starts", async () => {
  let clock = 1000
  const decision = await probeReadiness(async () => {
    clock += 2200
    return { status: 200, ready: true, body: { ready: true } }
  }, { timeoutMs: 4000, backoff: [], now: () => clock })
  assert.equal(decision.start, true)
  assert.equal(decision.ready, true)
  assert.equal(decision.reason, "cold")
  assert.equal(decision.fallback, false)
  assert.ok(decision.elapsedMs >= 1200)
})

test("Check again re-probes and clears the banner without blocking Start", async () => {
  let calls = 0
  const decision = await probeReadiness(async () => {
    calls += 1
    return { status: 503, ready: false, body: {} }
  }, { timeoutMs: 40, backoff: [0], recheck: true })
  assert.equal(calls, 2)
  assert.equal(decision.start, true)
  assert.equal(decision.banner, "")
  assert.match(html, /id="readyCheck"/)
  assert.match(html, /Check again/)
  assert.match(app, /recheck: true/)
  assert.match(app, /clearReadyBanner\(\)/)
  assert.match(app, /checkSessionReadiness\(\{ background: true, recheck: true \}\)/)
  assert.doesNotMatch(app, /AbortSignal\.timeout\(50000\)/)
  assert.doesNotMatch(app, /await checkSessionReadiness\(\); return/)
  const start = app.indexOf("async function checkSessionReadiness")
  const slice = app.slice(start, app.indexOf("async function start()", start))
  assert.doesNotMatch(slice, /button\.disabled = true/)
  assert.match(app, /void checkSessionReadiness\(\{ background: true \}\)/)
})

test("minimize and close stay above the grips and are not a drag region", () => {
  assert.match(main, /closable: true/)
  assert.match(main, /minimizable: true/)
  assert.match(main, /frame: false/)
  assert.match(main, /ipcMain\.on\("kompas:minimize"/)
  assert.match(main, /ipcMain\.on\("kompas:close"/)
  assert.match(main, /userMinimized = true/)
  assert.match(main, /if \(!force && \(userMinimized \|\| win\.isMinimized\(\)\)\) return/)
  assert.match(preload, /kompas:minimize/)
  assert.match(preload, /kompas:close/)
  assert.match(preload, /data-tauri-drag-region/)
  assert.match(preload, /removeAttribute\("data-tauri-drag-region"\)/)
  assert.match(css, /-webkit-app-region:no-drag !important/)
  assert.match(css, /z-index:1003 !important/)
  assert.match(css, /html\.kd \.kd-grip\{z-index:2 !important\}/)
  assert.doesNotMatch(preload, /id: "kdClose"[\s\S]{0,80}data-tauri-drag-region/)
  assert.equal(main.includes("tauri.conf"), false)
})

test("the clarifier is a separate popup and opacity does not hide it or the answer", async () => {
  const dom = new JSDOM(`<!doctype html><html><body>
    <div id="overlay"><div class="content"><div class="card">
      <div class="q"><span id="question">Waiting for the interview to start…</span></div>
      <div class="a"><ul id="answer"><li>Answer</li></ul></div>
    </div></div></div>
  </body></html>`, { url: "https://job-dashboard.example/kompas/", runScripts: "outside-only" })
  const { window } = dom
  window.eval(read("public/kompas/bridge-lines.js"))
  window.eval(aside)
  const panel = window.document.getElementById("answerAside")
  const question = window.document.getElementById("question")
  const answer = window.document.getElementById("answer")
  assert.ok(panel)
  assert.equal(answer.closest(".a").contains(panel), false)
  assert.equal(question.closest(".q").contains(panel), false)
  assert.equal(window.document.getElementById("overlay").contains(panel), true)
  assert.equal(panel.hidden, true)
  question.textContent = "How do you rotate a secret without downtime?"
  await new Promise((r) => setTimeout(r, 0))
  const live = window.document.getElementById("clarifyLive")
  assert.ok(live)
  assert.equal(live.textContent, "How do you rotate a secret without downtime?")
  assert.equal(panel.hidden, false)
  assert.equal(answer.closest(".a").contains(live), false)
  question.textContent = "Which key store did you use?"
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(window.document.getElementById("clarifyLive").textContent, "Which key store did you use?")
  assert.doesNotMatch(asideCss, /position:\s*fixed/)
  assert.match(css, /#answer,#answer li,#clarifyLive,\.answer-aside,\.clarify-live\{opacity:1 !important\}/)
  assert.match(preload, /--answer-shadow", "0"/)
})

test("the B button cycles 700, 600, then 400 and the desktop stores it", () => {
  assert.match(html, /id="boldBtn"/)
  assert.ok(html.indexOf('id="boldBtn"') < html.indexOf('id="textMinus"'))
  assert.match(app, /const ANSWER_WEIGHTS = \{ bold: 700, semi: 600, normal: 400 \}/)
  assert.match(app, /const order = \["bold", "semi", "normal"\]/)
  assert.match(app, /LS\.get\("answerWeight", "normal"\)/)
  assert.match(app, /setAnswerWeight\?\.\(next\)/)
  assert.match(preload, /setAnswerWeight:/)
  assert.match(preload, /if \(id === "semi"\) return 600/)
  assert.match(main, /p\.answerWeight === "bold" \|\| p\.answerWeight === "semi" \|\| p\.answerWeight === "normal"/)
  assert.match(css, /font-weight:var\(--answer-weight, 400\) !important/)
  assert.match(app, /setProperty\("--answer-shadow", "0"\)/)
})
