// The answer card is the 01ceb1dc formatter. Pull request 350's live-card rules are not in force.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { presentSpokenAnswer } from "../../src/lib/kompasAnswerPresentation.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("a complex answer uses the pre-350 card, and an introduction stays a paragraph", () => {
  const card = presentSpokenAnswer(
    "What was the state of the system when you joined and what were your specific contributions?",
    "I joined two months before launch. Downstream calls were failing. I implemented queue-based staging and an object storage backup.",
  )
  assert.doesNotMatch(card, /\*\*(?:Claim|Context|Action|Result|Close)\*\*/)
  assert.doesNotMatch(card, /^…$/m)
  assert.match(card, /joined two months before launch/)
  assert.match(card, /Downstream calls were failing/)
  const intro = presentSpokenAnswer(
    "Your introduction know, I'm not sure if I'm going to be able to get to the end of this. introduce yourself.",
    "**Claim**\n- I am a Senior Cybersecurity Engineer at Citi Bank, where I design and operate security controls.\n**Context**\n- First, previously I secured healthcare systems at CVS Health.",
  )
  assert.doesNotMatch(intro, /\*\*Claim\*\*/)
  assert.doesNotMatch(intro, /\bFirst,/)
  assert.match(intro, /Previously I secured healthcare systems/)
  assert.doesNotMatch(app, /function framedQuestion/)
  assert.match(app, /includeTail && canRequest/)
  assert.doesNotMatch(app, /includeTail \|\| !!keep/)
})
