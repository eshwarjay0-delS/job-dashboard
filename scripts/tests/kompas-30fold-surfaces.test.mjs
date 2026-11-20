import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync, statSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")

function grab(start, end) {
  const from = app.indexOf(start)
  const to = app.indexOf(end)
  if (from < 0 || to < from) throw new Error(`missing ${start}`)
  return app.slice(from, to)
}

const api = vm.runInNewContext(`const BUILD = "test";\n${grab("function speakerName(", "function transcriptName(")}\nthis.api = { speakerName, chatExchange, orderedTranscript, transcriptText }`)
const share = vm.runInNewContext(`${grab("function screenShareStep(", "let sharePhase")}\nthis.step = screenShareStep`)
const phrases = vm.runInNewContext(`${grab("const PHRASE_FIXES = [", "function fixTerms(")}\nthis.fix = fixPhrases`)

const interviewer = [
  "How do you keep the CMDB accurate?",
  "How do you handle incidents?",
  "What is a business rule?",
  "How does Discovery work?",
  "Tell me about the KYC workflow.",
  "How did you track SLA adherence?",
  "What GRC work did you support?",
  "How do you build a service catalog item?",
  "How does ServiceNow work?",
  "Walk me through change approval.",
]
const followUps = ["and why?", "why that?", "how so?", "what about that?", "go deeper", "and then?", "why now?", "go deeper on it", "and this?", "why?"]
const sends = [
  "How do you keep imported CMDB data accurate?",
  "What is a transform map?",
  "Did you configure SLAs?",
  "How would you onboard a new CI class?",
  "Tell me about a time you improved a process.",
  "How do you manage access?",
  "What is ITSM?",
  "How does orchestration work?",
  "Are you a ServiceNow developer?",
  "How large was the CMDB?",
]

function report(name, fails, total) {
  console.log(`${name} parity ${total - fails.length}/${total}`)
  return fails
}

test("30 chat, screen, transcription, transcript, and UI parity checks", () => {
  const chat = []
  sends.forEach((text, index) => {
    const turn = api.chatExchange([], text)
    if (turn.lines.length !== 1 || turn.lines[0].text !== text || turn.streamed[0].split(" ")[0] !== text.split(" ")[0] || turn.streamed.at(-1) !== text) chat.push({ id: `send-${index}`, why: "send/stream" })
  })
  followUps.forEach((text, index) => {
    const turn = api.chatExchange([{ role: "interviewer", text: interviewer[index] }], text)
    if (!turn.followUp || !turn.lines.at(-1).text.startsWith(interviewer[index].replace(/[?.!\s]+$/, "")) || turn.streamed.length < 2) chat.push({ id: `follow-${index}`, why: turn.lines.at(-1).text })
  })
  sends.forEach((text, index) => {
    const turn = api.chatExchange([{ role: "interviewer", text: interviewer[index] }], text)
    const grew = turn.streamed.every((part, at) => at === 0 || part.length > turn.streamed[at - 1].length)
    if (!grew || turn.streamed.at(-1) !== text) chat.push({ id: `stream-${index}`, why: "stream did not grow" })
  })

  const screen = []
  for (let i = 0; i < 10; i++) {
    const live = share(share({ phase: "idle", preview: false }, "pick"), "live")
    if (live.phase !== "live" || live.preview !== true) screen.push({ id: `preview-${i}`, why: JSON.stringify(live) })
  }
  for (let i = 0; i < 10; i++) {
    const stopped = share({ phase: "live", preview: true }, "stop")
    if (stopped.preview !== false || stopped.phase !== "stopped") screen.push({ id: `stop-${i}`, why: JSON.stringify(stopped) })
  }
  for (let i = 0; i < 10; i++) {
    const again = share(share({ phase: "stopped", preview: false }, "restart"), "live")
    if (again.phase !== "live" || again.preview !== true) screen.push({ id: `restart-${i}`, why: JSON.stringify(again) })
  }

  const heard = []
  for (let i = 0; i < 10; i++) if (api.speakerName("You") !== "You") heard.push({ id: `you-${i}`, why: api.speakerName("You") })
  for (const who of ["Them", "Them (interviewer)", "Interviewer", "interviewer 2", "Them (Windows caption)", "THEM", "Interviewer 1", "them", "Interviewer (tab)", "Them (call)"].slice(0, 10)) {
    if (api.speakerName(who) !== "Interviewer") heard.push({ id: `label-${who}`, why: api.speakerName(who) })
  }
  const lagSites = [
    app.includes("function onCaptionText(") && app.indexOf("onTranscript(\"Them\", r.part", app.indexOf("function onCaptionText(")) > 0,
    !/function onCaptionText\([\s\S]{0,400}await /.test(app),
    (app.match(/__kompasFirstWordDeadline = Date\.now\(\) \+ (\d+)/g) || []).every((row) => Number(row.match(/\d+/)[0]) < 1500),
    app.includes("Caption capture connected"),
    app.includes("function captionNewPart("),
  ]
  lagSites.forEach((ok, index) => { if (!ok) heard.push({ id: `lag-${index}`, why: "lag" }) })
  const repairs = [
    ["the seem tool", /SIEM tool/],
    ["worked with seem", /SIEM/],
    ["sail point", /SailPoint/],
    ["sys log", /syslog/],
    ["okta", /Okta/],
  ]
  repairs.forEach(([input, pattern], index) => { if (!pattern.test(phrases(input))) heard.push({ id: `repair-${index}`, why: phrases(input) }) })

  const transcript = []
  for (let i = 0; i < 10; i++) {
    const text = api.transcriptText({ role: "ServiceNow" }, [
      { t: "line", who: "Them", text: "second", at: 2000 + i },
      { t: "line", who: "You", text: "first", at: 1000 + i },
    ])
    if (text.indexOf("first") > text.indexOf("second")) transcript.push({ id: `order-${i}`, why: "unordered" })
    if (!text.includes("Interviewer") || !text.includes("You")) transcript.push({ id: `names-${i}`, why: "labels" })
  }
  for (let i = 0; i < 10; i++) {
    const text = api.transcriptText({ role: "ServiceNow" }, [
      { t: "line", who: "Them", text: "same line", at: 1000 },
      { t: "line", who: "Them", text: "same line", at: 1000 },
      { t: "line", who: "You", text: "my answer", at: 1100 },
    ])
    if (text.split("same line").length !== 2) transcript.push({ id: `dup-${i}`, why: "duplicate kept" })
    if (/Them \(interviewer\)/.test(text)) transcript.push({ id: `old-label-${i}`, why: "Them label" })
  }
  for (let i = 0; i < 10; i++) {
    const log = [{ t: "line", who: "You", text: `line ${i}`, at: 1000 + i }]
    const text = api.transcriptText({ role: "ServiceNow" }, log)
    if (!text.includes(`line ${i}`) || !text.startsWith("Kompas Timeline Export")) transcript.push({ id: `copy-${i}`, why: "not copyable" })
  }

  const kompasFiles = readdirSync(new URL("../../public/kompas/", import.meta.url))
  const buttons = ["startBtn", "answerBtn", "chatBtn", "sendBtn", "copyBtn", "getTranscriptBtn", "exportBtn", "tabPreviewStop", "tabPreviewChange", "tabPreviewFull"]
  const shortcuts = ["ctrlKey && e.key === \"Enter\"", "e.key === \"/\"", "e.key === \"t\" || e.key === \"T\"", "e.key === \"f\" || e.key === \"F\"", "e.key === \"Escape\"", "ctrlKey && e.shiftKey"]
  const uiChecks = [
    ...buttons.map((id) => [`button-${id}`, html.includes(`id="${id}"`) && app.includes(id)]),
    ...shortcuts.map((needle, index) => [`key-${index}`, app.includes(needle)]),
    ["bundle-weights", !kompasFiles.some((name) => name.endsWith(".onnx") || name.endsWith(".wasm"))],
    ["bundle-lazy", app.includes("import(\"./vad-loader.mjs\")")],
    ["bundle-size", statSync(new URL("../../public/kompas/app.js", import.meta.url)).size < 900000],
    ["clicks", app.includes("$(\"cnStart\").onclick") && app.includes("$(\"startBtn\").click()")],
    ["one-document", (html.match(/<html/g) || []).length === 1],
    ["preview-in-page", html.includes("id=\"tabPreview\"") && !grab("function showTabPreview(", "function hideTabPreview(").includes("window.open")],
    ["start-states", app.includes("textContent = \"Stop\"") && app.includes("textContent = \"Start\"")],
    ["chat-state", app.includes("aria-pressed")],
    ["chat-clear", app.includes("box.value = \"\"")],
    ["copy-transcript", app.includes("navigator.clipboard.writeText")],
    ["pause", app.includes("async function pauseRun(")],
    ["no-health-poll", !app.includes("setInterval(() => { fetch(\"/api/health\"") ],
    ["preview-hidden", html.includes("tab-preview hidden")],
    ["enter-sends", app.includes("function sendManual()")],
  ]
  const ui = uiChecks.filter(([, ok]) => !ok).map(([id]) => ({ id, why: "missing" }))
  if (uiChecks.length !== 30) ui.push({ id: "ui-count", why: String(uiChecks.length) })

  const chatFails = report("chat", chat, 30)
  const screenFails = report("screen", screen, 30)
  const heardFails = report("transcription", heard, 30)
  const transcriptFails = report("transcript", transcript, 30)
  const uiFails = report("ui", ui, uiChecks.length)
  const worst = [...chatFails, ...screenFails, ...heardFails, ...transcriptFails, ...uiFails].slice(0, 10)
  if (worst.length) console.log(worst.map((row) => `${row.id}: ${row.why}`).join("\n"))
  assert.equal(sends.length + followUps.length + sends.length, 30)
  assert.equal(chatFails.length + screenFails.length + heardFails.length + transcriptFails.length + uiFails.length, 0)
})
