// 9:27 AM CT: side-talk around "introduce yourself" is not the question, and the intro is one paragraph.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { cleanHeardQuestion } from "../../src/lib/kompasLongContext.ts"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"

const HEARD = "Your introduction know, I'm not sure if I'm going to be able to get to the end of this. introduce yourself."
const INTRO = [
  "**Claim**",
  "- I am a Senior Cybersecurity Engineer at Citi Bank, where I design and operate security controls for digital payments.",
  "**Context**",
  "- First, previously I secured healthcare systems at CVS Health, building application security gates.",
  "- Before that I provided digital security for the City of San Diego.",
].join("\n")

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("side-talk before introduce yourself is not the question", () => {
  assert.equal(cleanHeardQuestion(HEARD), "Introduce yourself.")
  assert.equal(cleanHeardQuestion("Introduce yourself."), "Introduce yourself.")
  assert.equal(cleanHeardQuestion("How would you design the service catalog?"), "How would you design the service catalog?")
  assert.equal(cleanHeardQuestion("Introduce yourself. Why do you want this job?"), "Introduce yourself. Why do you want this job?")
  const start = app.indexOf("function cleanHeardQuestion(")
  const end = app.indexOf("function renderCard(")
  const ctx = {}
  vm.runInContext(app.slice(start, end) + "\nthis.cleanHeardQuestion = cleanHeardQuestion;", vm.createContext(ctx))
  assert.equal(ctx.cleanHeardQuestion(HEARD), "Introduce yourself.")
  assert.match(app, /cleanHeardQuestion\(draft \|\| c\.question\)/)
  assert.match(app, /question = cleanHeardQuestion\(String\(question \|\| ""\)\.trim\(\)\)/)
})

test("an introduction is one paragraph, with no Claim header and no First", () => {
  const card = presentSpokenAnswer(HEARD, INTRO)
  assert.equal(card, presentSpokenAnswer("Introduce yourself.", INTRO))
  assert.doesNotMatch(card, /\*\*(?:Claim|Context|Action|Result)\*\*/)
  assert.doesNotMatch(card, /\bFirst,/)
  assert.doesNotMatch(card, /^- /m)
  assert.match(card, /^I am a Senior Cybersecurity Engineer at Citi Bank/)
  assert.match(card, /Previously I secured healthcare systems at CVS Health/)
  const clean = app.slice(app.indexOf("function cleanHeardQuestion("), app.indexOf("function renderCard("))
  const present = app.slice(app.indexOf("function plainIntroAnswer("), app.indexOf("function answerLines("))
  const ctx = {}
  vm.runInContext(clean + present + "\nthis.presentAnswer = presentAnswer;", vm.createContext(ctx))
  assert.equal(ctx.presentAnswer(HEARD, INTRO, ""), card)
})
