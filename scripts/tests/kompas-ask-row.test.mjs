// Bottom row: Chat, the typed question, and Level. Format follows the length band.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { JSDOM } from "jsdom"
import { dissectQuestion, formatForBand, lengthKind } from "../../src/lib/kompasDissection.ts"

const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8")
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("the bottom row keeps Chat, the typed question, and Level", () => {
  const dom = new JSDOM(html, { url: "https://job-dashboard.example/kompas/", pretendToBeVisual: true, runScripts: "outside-only" })
  const { window } = dom
  const start = app.indexOf("function placeAskRow()")
  const end = app.indexOf("function placeDesktopControls()")
  const ctx = vm.createContext({ document: window.document, $: (id) => window.document.getElementById(id) })
  vm.runInContext(app.slice(start, end) + "\nplaceAskRow();", ctx)
  const ask = window.document.getElementById("barAsk")
  assert.deepEqual([...ask.querySelectorAll("[id]")].map((node) => node.id), ["chatBtn", "manualInput", "sendBtn", "liveInterviewer"])
  assert.equal(ask.querySelector("#chatBtn").textContent, "Chat")
  assert.equal(ask.querySelector("#manualInput").tagName, "INPUT")
  assert.equal(ask.querySelector("#sendBtn") != null, true)
  assert.equal(ask.querySelector("#liveInterviewer") != null, true)
  assert.equal(ask.querySelector("#liveFormat"), null)
  assert.equal(ask.querySelector("#liveTone"), null)
  assert.equal(ask.querySelector("#liveStar"), null)
  assert.match(css, /\.card-prefs,#liveFormat,#liveLength,#liveTone,#liveStar\{display:none !important\}/)
  assert.match(css, /html\.kd \.card-prefs,html\.kd #liveFormat,html\.kd #liveLength,html\.kd #liveTone,html\.kd #liveStar\{display:none !important\}/)
  assert.match(app, /return \{ format: "full_script", length: "balanced", tone: "simple", star: false \}/)
})

test("format follows the length band", () => {
  const yes = dissectQuestion("Do you use Splunk?")
  assert.equal(formatForBand(lengthKind("Do you use Splunk?", yes.shape)), "sentences")
  const mid = dissectQuestion("Have you done Splunk detections?")
  assert.equal(formatForBand(lengthKind("Have you done Splunk detections?", mid.shape)), "script")
  const long = dissectQuestion("Tell me about yourself.")
  assert.equal(formatForBand(lengthKind("Tell me about yourself.", long.shape)), "script_bullets")
  const svc = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(svc, /cardControls\.format = formatForBand\(lengthKind\(question, spokenShape\), question\)/)
})
