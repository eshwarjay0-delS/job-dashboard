// S1 replay gate. One mixed tab-audio stream, no mic. Offline.
import { readFileSync, writeFileSync, rmSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { tmpdir } from "node:os"
import { join } from "node:path"
import vm from "node:vm"
import { answerWords, longGroundedAnswer } from "../src/lib/kompasS1Replay.ts"
import { clarifyingFromQuestion } from "../src/lib/kompasConsistency.ts"

const root = new URL("..", import.meta.url)
const app = readFileSync(new URL("../public/kompas/app.js", import.meta.url), "utf8")
const css = readFileSync(new URL("../public/kompas/styles.css", import.meta.url), "utf8")

export function parseS1(text) {
  return String(text || "").trim().split(/\n/).filter(Boolean).map((line) => {
    const m = line.match(/^(\d+)-(\d+)\|([^|]*)\|([^|]*)\|(.*)$/)
    if (!m) throw new Error("bad turn: " + line)
    return { start: Number(m[1]), end: Number(m[2]), speaker: m[3], qId: m[4], text: m[5] }
  })
}

function loadReplay() {
  const start = app.indexOf("function isGatedQuestion(")
  const end = app.indexOf("function soundsLikeCandidate(")
  const ctx = vm.createContext({})
  vm.runInContext(app.slice(start, end) + "\nthis.replay = replayMixedTab; this.header = questionHeader;", ctx)
  return ctx
}

function chromeBin() {
  for (const name of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const found = spawnSync("bash", ["-lc", "command -v " + name], { encoding: "utf8" })
    if (found.status === 0 && found.stdout.trim()) return found.stdout.trim()
  }
  return ""
}

function boxesOverlap(a, b) {
  if (!a || !b || a.w < 1 || a.h < 1 || b.w < 1 || b.h < 1) return false
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

function measureLayout(width, height) {
  const bin = chromeBin()
  if (!bin) return { error: "no chrome" }
  const htmlPath = new URL("../public/kompas/index.html", import.meta.url)
  const base = new URL("../public/kompas/", import.meta.url)
  let html = readFileSync(htmlPath, "utf8")
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
  html = html.replace(/href="([^"]+\.css[^"]*)"/g, (all, href) => {
    if (/^https?:/.test(href)) return all
    return `href="${new URL(href.split("?")[0], base).href}"`
  })
  html = html.replace('class="view view-copilot hidden"', 'class="view view-copilot"')
  const probe = `<script>
    const controls = ["answerBtn", "startBtn", "moreBtn"];
    function box(id) {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      const shown = s.display !== "none" && s.visibility !== "hidden" && !el.hidden && r.width > 0 && r.height > 0;
      return { id, x: r.x, y: r.y, w: shown ? r.width : 0, h: shown ? r.height : 0, display: s.display };
    }
    function snap(name) {
      const preview = box("tabPreview");
      const toggle = box("tabPreviewToggle");
      const buttons = {};
      controls.forEach((id) => { buttons[id] = box(id); });
      return { name, preview, toggle, buttons, inner: { w: window.innerWidth, h: window.innerHeight } };
    }
    const closed = snap("closed");
    document.getElementById("tabPreviewToggle").hidden = false;
    const preview = document.getElementById("tabPreview");
    preview.hidden = false;
    preview.classList.remove("hidden");
    const open = snap("open");
    const pre = document.createElement("pre");
    pre.id = "s1boxes";
    pre.textContent = JSON.stringify({ closed, open });
    document.body.append(pre);
  </script>`
  html = html.replace("</body>", probe + "</body>")
  const file = join(tmpdir(), `kompas-s1-${width}x${height}.html`)
  writeFileSync(file, html)
  const run = spawnSync(bin, [
    "--headless=new",
    "--disable-gpu",
    "--no-sandbox",
    "--allow-file-access-from-files",
    `--window-size=${width},${height}`,
    "--virtual-time-budget=3000",
    "--dump-dom",
    "file://" + file,
  ], { encoding: "utf8", timeout: 30000 })
  rmSync(file, { force: true })
  if (run.status !== 0 && !run.stdout.includes("s1boxes")) return { error: run.stderr.slice(0, 400) || "chrome failed" }
  const m = run.stdout.match(/<pre id="s1boxes">([\s\S]*?)<\/pre>/)
  if (!m) return { error: "no boxes" }
  return JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"))
}

export function evaluate() {
  const failures = []
  const fail = (msg) => failures.push(msg)
  const turns = parseS1(readFileSync(new URL("./fixtures/kompas-s1-replay.txt", import.meta.url), "utf8"))
  const { replay } = loadReplay()
  const { lines, fires } = replay(turns)
  const byQ = {}
  for (const fire of fires) {
    if (!fire.qId) continue
    byQ[fire.qId] = byQ[fire.qId] || []
    byQ[fire.qId].push(fire)
  }
  for (const id of ["1", "2", "3", "4", "5"]) {
    const rows = byQ[id] || []
    if (rows.length !== 1) fail(`q${id} fired ${rows.length} times`)
    else {
      const delay = rows[0].at - rows[0].end
      if (delay < 0 || delay > 2) fail(`q${id} delay ${delay}s`)
    }
  }
  const early = fires.filter((fire) => fire.end <= 19)
  if (early.length) fail("small talk fired: " + early.map((fire) => fire.text).join(" | "))
  for (const turn of turns.filter((turn) => turn.speaker === "C")) {
    const line = lines.find((row) => row.text === turn.text)
    if (!line) fail("missing C line: " + turn.text)
    else {
      if (line.tag !== "You" || line.role !== "You") fail("C tag " + line.tag)
      if (/them/i.test(line.tag)) fail("C labeled THEM")
      for (const other of turns.filter((row) => row.speaker.startsWith("I") && row.text.length > 12)) {
        if (line.text.includes(other.text.slice(0, 18))) fail("C merged with I: " + turn.text)
      }
    }
  }
  const follow = fires.filter((fire) => fire.end >= 274)
  if (follow.length > 1) fail("follow-ups fired " + follow.length + " cards")
  for (const fire of fires) {
    const headers = fire.header.match(/Question:/g) || []
    if (headers.length !== 1) fail("header prefixes " + fire.header)
    if (!fire.header.startsWith("Question: ")) fail("header shape " + fire.header)
    const body = fire.header.slice("Question: ".length)
    if (body !== fire.text) fail("header is not the interviewer text")
    for (const turn of turns.filter((row) => row.speaker === "C")) {
      if (body.includes(turn.text.slice(0, 16))) fail("header includes candidate text")
    }
    const answer = longGroundedAnswer(fire.text)
    const words = answerWords(answer)
    if (words.length < 120 || words.length > 180) fail(`long ${words.length} for ${fire.qId || fire.text}`)
    if (words.length < 20) fail("stub")
    if (/New constraint:/i.test(answer) || /New constraint:/i.test(fire.header)) fail("New constraint on card")
    const clarifier = clarifyingFromQuestion(fire.text, "Assists with ServiceNow platform incident resolution.")
    if (clarifier.some((line) => /New constraint:/i.test(line))) fail("clarifier constraint")
    if (clarifier.length && clarifier.join(" ").split(/\s+/).some((word) => word.length > 4 && !fire.text.toLowerCase().includes(word.toLowerCase().replace(/[?]/g, "")))) {
      /* a clarifier may use short template words; the banned line is the constraint stub */
    }
  }
  if (/New constraint:/.test(app)) fail("page still shows New constraint")
  if (!/let tabPreviewOpen = false/.test(app)) fail("preview is not off by default")
  if (!/right:12px;bottom:42px/.test(css)) fail("preview is not parked at the bottom-right")
  if (!/width:168px/.test(css)) fail("preview is not the small panel")
  const layout = {}
  for (const [width, height] of [[1280, 800], [1280, 720]]) {
    const shot = measureLayout(width, height)
    layout[`${width}x${height}`] = shot
    if (shot.error) { fail(`layout ${width}x${height}: ${shot.error}`); continue }
    for (const state of [shot.closed, shot.open]) {
      for (const id of ["answerBtn", "startBtn", "moreBtn"]) {
        if (boxesOverlap(state.preview, state.buttons[id])) fail(`${state.name} preview overlaps ${id} at ${width}x${height}`)
        if (boxesOverlap(state.toggle, state.buttons[id])) fail(`${state.name} toggle overlaps ${id} at ${width}x${height}`)
      }
    }
  }
  return { pass: failures.length === 0, failures, fires, lines, layout }
}

const main = process.argv[1] && process.argv[1].endsWith("kompas-s1-replay-gate.mjs")
if (main) {
  const result = evaluate()
  const summary = {
    pass: result.pass,
    failures: result.failures,
    fires: result.fires.map((fire) => ({ qId: fire.qId, at: fire.at, end: fire.end, header: fire.header })),
    layout: result.layout,
  }
  console.log(JSON.stringify(summary, null, 2))
  process.exit(result.pass ? 0 : 1)
}
