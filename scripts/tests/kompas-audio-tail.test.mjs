// AI Answer keeps the last slice of mic and computer audio, then transcribes it.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
function section(start, end) {
  return app.slice(app.indexOf(start), app.indexOf(end, app.indexOf(start)))
}

function recorder(chunks, late) {
  return {
    mimeType: "audio/webm",
    state: "recording",
    ondataavailable: null,
    requestData() {
      const data = new Blob([late])
      queueMicrotask(() => { if (this.ondataavailable) this.ondataavailable({ data }) })
    },
    stop() {
      this.state = "inactive"
      if (this.onstop) this.onstop()
    },
  }
}

function load() {
  const sent = []
  const state = {
    sent,
    captures: [],
    finals: new Set(),
    VAD: { MIN_SPEECH_MS: 160 },
    MIME: "audio/webm",
    transcriptionEpoch: 1,
    performance,
    Date,
    Blob,
    setTimeout,
    clearTimeout,
    queueMicrotask,
    status() {},
    whisperPrompt() { return "" },
    spokenWallTime() { return Date.now() },
    startSegment() { throw new Error("must not restart") },
    transcribe: async (blob, who) => { sent.push({ who, text: await blob.text() }); return true },
  }
  vm.createContext(state)
  vm.runInContext(section("function segmentKept(", "function flushAction("), state)
  vm.runInContext(section("function endSegment(", "// AI Answer pressed"), state)
  vm.runInContext(section("async function flushHeard(", "function repairBadge("), state)
  return state
}

test("a late final chunk is transcribed for the microphone and for computer audio", async () => {
  const s = load()
  const micChunks = [new Blob(["mic-head"])]
  const tabChunks = [new Blob(["tab-head"])]
  s.captures = [
    { who: "You", rec: recorder(micChunks, "mic-tail"), chunks: micChunks, speechMs: 40, stopped: true, tail: [{ blob: new Blob(["mic-preroll"]), at: 1 }] },
    { who: "Them", rec: recorder(tabChunks, "tab-tail"), chunks: tabChunks, speechMs: 30, stopped: true, tail: [{ blob: new Blob(["tab-preroll"]), at: 1 }] },
  ]
  assert.doesNotMatch(section("async function flushHeard(", "function repairBadge("), /html\.kd|classList/)
  await s.flushHeard(2000)
  const text = s.sent.map((item) => item.who + ":" + item.text).join("\n")
  assert.match(text, /You:[\s\S]*mic-preroll/)
  assert.match(text, /mic-tail/)
  assert.match(text, /Them:[\s\S]*tab-preroll/)
  assert.match(text, /tab-tail/)
  assert.equal(s.sent.length, 2)
})
