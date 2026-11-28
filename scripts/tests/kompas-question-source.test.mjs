import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { appendSession, projectBrain, questionAskTag, renderBrain } from "../../src/lib/kompasLivingBrain.ts"

const page = createRequire(import.meta.url)("../../public/kompas/question-source.js")
const houston = readFileSync(new URL("../../src/lib/kompas-houston-resume.txt", import.meta.url), "utf8")
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")

const ASK = "How did you cut over the firewalls?"
const ANSWER = "I led the FortiGate-VM cutover and kept the previous path available until verification passed."

test("a detected question is tagged mic, captions, computer-audio, or typed", () => {
  for (const tag of ["mic", "captions", "computer-audio", "typed"]) {
    assert.equal(page.questionAskTag(tag), tag)
    assert.equal(questionAskTag(tag), tag)
    assert.equal(page.questionLine(ASK, tag), ASK + " [" + tag + "]")
  }
  assert.equal(page.questionAskTag("microphone"), "mic")
  assert.equal(page.questionAskTag("caption-window"), "captions")
  assert.equal(page.questionAskTag("system"), "computer-audio")
  assert.equal(page.questionAskTag("You (typed)"), "typed")
  assert.equal(page.questionAskTag("screen"), "")
  assert.equal(page.questionLine(ASK + " [mic]", "mic"), ASK + " [mic]")
})

test("the question line shows the tag and Learned From Sessions keeps it", () => {
  const doc = appendSession(projectBrain({ houston }), {
    qa: [
      { q: ASK, a: ANSWER, source: "captions" },
      { q: "How does the mic path differ from the call?", a: "I answer the microphone question from what I said, and I keep it separate from the call audio.", source: "mic" },
    ],
  }).doc
  const markdown = renderBrain(doc)
  assert.match(markdown, /Q \[captions\]: How did you cut over the firewalls\?/)
  assert.match(markdown, /Q \[mic\]: How does the mic path differ/)
  assert.match(app, /c\.askSource/)
  assert.match(app, /askTagOf\(channel\)/)
  assert.match(app, /\[" \+ c\.askSource \+ "\]"/)
  assert.match(app, /onTranscript\("Them", r\.part, false, Date\.now\(\), "captions"\)/)
  assert.match(html, /question-source\.js/)
})
