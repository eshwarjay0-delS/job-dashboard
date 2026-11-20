// New edges for the parity upgrade: video-only tab preview, a clean copyable transcript, and the typed chat line.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const start = app.indexOf("function previewVideoTracks")
const end = app.indexOf("function showTabPreview")
const textStart = app.indexOf("function cleanTranscriptText")
const textEnd = app.indexOf("// Nothing is answered phrase-by-phrase")
const ctx = vm.createContext({})
vm.runInContext(app.slice(start, end) + "\n" + app.slice(textStart, textEnd) + "\nthis.video = previewVideoTracks; this.text = cleanTranscriptText;", ctx)

test("screen share: the in-session preview keeps video and leaves audio on the capture stream", () => {
  const audio = { kind: "audio", readyState: "live" }
  const ended = { kind: "video", readyState: "ended" }
  const video = { kind: "video", readyState: "live" }
  assert.deepEqual(ctx.video([audio, ended, video]), [video])
  assert.deepEqual(ctx.video([audio]), [])
  assert.match(app, /const tracks = previewVideoTracks\(owner\.getVideoTracks/)
  assert.match(app, /video\.muted = true/)
  assert.doesNotMatch(app.slice(start, app.indexOf("function hideTabPreview")), /srcObject = owner/)
  assert.match(html, /id="tabPreviewVideo" muted/)
})

test("transcript: the copy is plain text, one line per turn, with no status tags", () => {
  const copied = ctx.text([
    { who: "Them", text: "How would you <b>investigate</b> a phishing email?" },
    { who: "You", text: "  I start with the message.  " },
    { who: "Them", text: "   " },
  ], "")
  assert.equal(copied, "Interviewer: How would you investigate a phishing email?\nYou: I start with the message.")
  assert.doesNotMatch(copied, /<|Question detected|Listening/)
  assert.match(html, /id="copyTranscriptBtn"/)
  assert.match(app, /copyTranscriptBtn/)
})

test("chat: a typed line that is not in the transcript yet is still copied, once", () => {
  const copied = ctx.text([
    { who: "Them", text: "Tell me about a time you led an incident." },
  ], "Go deeper on the CMDB")
  assert.match(copied, /You \(typed\): Go deeper on the CMDB/)
  assert.equal(copied.split("Go deeper on the CMDB").length, 2)
  const again = ctx.text([
    { who: "You", text: "Go deeper on the CMDB" },
  ], "Go deeper on the CMDB")
  assert.equal(again, "You: Go deeper on the CMDB")
})
