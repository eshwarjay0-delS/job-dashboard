// Parakeet master report §4 items on the answer engine: transcript window, stale titles, one-hop derive,
// Script + bullets default, empty-resume hard path.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  tailWindow, TRANSCRIPT_MAX_CHARS, isPlaceholderTitle, lastInterviewerAsk, unpinStale, wantsInlineDerive,
  answerFormat, toCard, spokenSentences, resumeState, resumeStatePrompt, enforceResumeState, NO_RESUME_OPENER, NO_RESUME_REFUSAL,
} from "../../src/lib/kompasAnswerContract.ts"
import { MASTER_PROMPT_TEXT } from "../../src/lib/kompasMasterPrompt.ts"

const SERVICE = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")

test("transcript: no silent 4,000-character clip; the newest speech survives", () => {
  const lines = Array.from({ length: 120 }, (_, i) => `Them: line ${i} about rate limiting and shared caches across regions.`)
  const long = lines.join("\n")
  assert.ok(long.length > 4000)
  const w = tailWindow(long)
  assert.equal(w.clipped, false)
  assert.equal(w.text, long)
  const huge = Array.from({ length: 600 }, (_, i) => `Them: line ${i} padding padding padding padding padding.`).join("\n")
  const h = tailWindow(huge)
  assert.equal(h.clipped, true)
  assert.ok(h.text.length <= TRANSCRIPT_MAX_CHARS)
  assert.match(h.text, /line 599 /)
  assert.match(h.text, /^Them: line \d+/)            // cut on a line boundary
  assert.doesNotMatch(SERVICE, /str\(body\.transcript,\s*4000\)/)
  assert.doesNotMatch(SERVICE, /str\(body\.transcript,\s*900\)/)
  assert.match(SERVICE, /tailWindow\(body\.transcript\)/)
})

test("titles: placeholders never pin", () => {
  for (const t of ["Preparing…", "Ready", "Cleared.", "No question yet", "Listening, no new question yet", "…", "Deriving the question and answering…", "Generating…", ""]) assert.equal(isPlaceholderTitle(t), true, t)
  assert.equal(isPlaceholderTitle("How do you rate limit by IP?"), false)
  assert.deepEqual(unpinStale({ heard: "Them: How do you scope an access review?", derived: "Preparing…", pinned: true }), { derived: "", pinned: false, unpinned: "placeholder" })
})

test("titles: a stale pinned title yields to a newer, different interviewer ask", () => {
  const heard = "Them: Tell me about a conflict with a coworker.\nYou: Sure, so at one point...\nThem: Okay. How would you level a new engineer's on-call access?"
  assert.equal(lastInterviewerAsk(heard), "How would you level a new engineer's on-call access?")
  const r = unpinStale({ heard, derived: "Tell me about a conflict with a coworker.", pinned: true })
  assert.equal(r.unpinned, "newer-ask"); assert.equal(r.pinned, false); assert.equal(r.derived, "")
})

test("titles: matching, typed, re-asked and no-new-ask titles stay pinned", () => {
  const same = "Them: Why use IP address for rate limiting over other identifiers?"
  assert.equal(unpinStale({ heard: same, derived: "Why use IP address for rate limiting over other identifiers?", pinned: true }).unpinned, "")
  assert.equal(unpinStale({ heard: "Them: so why would you rate limit on the IP address there?", derived: "Why use IP address for rate limiting over other identifiers?", pinned: true }).pinned, true)
  assert.equal(unpinStale({ heard: "You (typed): explain kerberoasting\nThem: How do you design a cache?", derived: "explain kerberoasting", pinned: true }).pinned, true)
  assert.equal(unpinStale({ heard: "Them: How do you design a cache?", derived: "Explain kerberoasting", pinned: true, again: true }).pinned, true)
  assert.equal(unpinStale({ heard: "Them: Yeah, that makes sense.", derived: "Explain kerberoasting", pinned: true }).pinned, true)
  assert.equal(unpinStale({ heard: "Them: How do you design a cache?", derived: "Explain kerberoasting", pinned: false }).unpinned, "")
})

test("one hop: derive runs inside the answer request when asked", () => {
  assert.equal(wantsInlineDerive({ derive: true, stream: true, question: "Them: ..." }), true)
  assert.equal(wantsInlineDerive({ derive: true, pinned: true }), false)
  assert.equal(wantsInlineDerive({ deriveOnly: true }), false)
  assert.equal(wantsInlineDerive({ question: "x" }), false)
  assert.match(SERVICE, /if \(wantsInlineDerive\(body\)\)/)
  assert.match(SERVICE, /const outcome = await deriveQuestion\(paidKey, body, request\.signal\)/)   // deriveOnly shares the same helper
  assert.match(SERVICE, /derived: job\.question/)                                                   // title goes out in the first meta event
})

test("format: Script + bullets is the default", () => {
  assert.equal(answerFormat({}), "script_bullets")
  assert.equal(answerFormat(undefined), "script_bullets")
  assert.equal(answerFormat({ format: "Script + bullets" }), "script_bullets")
  assert.equal(answerFormat({ format: "full script" }), "full_script")
  assert.equal(answerFormat({ format: "Bullet points" }), "bullets")
  const text = "I'd rate limit on the API key first, because IPs are shared behind NAT. The IP stays a fallback for anonymous traffic. I'd return a 429 with Retry-After so clients back off. Bursts get a token bucket, e.g. 20 per second. Logins get a tighter limit than reads. Abuse patterns go to the SOC queue."
  const c = toCard(text, "script_bullets", "balanced")
  assert.equal(c.script, "I'd rate limit on the API key first, because IPs are shared behind NAT.")
  assert.ok(c.bullets.length >= 2 && c.bullets.length <= 4, String(c.bullets.length))
  assert.ok(c.bullets.some((b) => /e\.g\. 20 per second/.test(b)))   // abbreviation not split
  const short = toCard(text, "bullets", "short")
  assert.equal(short.script, ""); assert.equal(short.bullets.length, 3)
  assert.equal(toCard(text, "full_script").script, text)
  const code = toCard("Here:\n```python\nprint(1)\n```", "script_bullets")
  assert.equal(code.format, "full_script"); assert.deepEqual(code.bullets, [])
  assert.deepEqual(spokenSentences("Version 2.5 shipped. Then U.S. teams adopted it."), ["Version 2.5 shipped.", "Then U.S. teams adopted it."])
  assert.doesNotMatch(MASTER_PROMPT_TEXT, /Do not use a list, a bullet/)
  assert.match(MASTER_PROMPT_TEXT, /Script \+ bullets/)
  assert.match(SERVICE, /toCard\(finalText/)
  assert.match(SERVICE, /toCard\(out/)
})

test("empty resume: three states", () => {
  assert.equal(resumeState({ resume: "Citi, Splunk", personal: true }), "grounded")
  assert.equal(resumeState({ dossier: "prior session facts", personal: true }), "grounded")
  assert.equal(resumeState({ personal: false }), "knowledge")
  assert.equal(resumeState({ personal: true }), "personal-no-resume")
  assert.equal(resumeStatePrompt("grounded"), "")
  assert.match(resumeStatePrompt("personal-no-resume"), /Never invent an employer, teammate/)
  assert.match(resumeStatePrompt("knowledge"), /answer as knowledge/)
})

test("empty resume: personal story gets no fake teammate or fake tool trial", () => {
  const fake = "At Acme Corp, I had a conflict with a teammate over a database tool. We trialed both tools for two weeks. I'd start by agreeing on the decision criteria with them. Then I'd share the data and let the team lead decide."
  const r = enforceResumeState(fake, "personal-no-resume")
  assert.ok(r.text.startsWith(NO_RESUME_OPENER), r.text)
  assert.doesNotMatch(r.text, /Acme|trialed/)
  assert.match(r.text, /agreeing on the decision criteria/)
  assert.equal(r.dropped, 2)
  assert.equal(enforceResumeState("At Acme, I led the migration. We cut costs by 30%.", "personal-no-resume").text, NO_RESUME_REFUSAL)
  const marked = `${NO_RESUME_OPENER} I'd agree on criteria first.`
  assert.equal(enforceResumeState(marked, "personal-no-resume").text, marked)
})

test("empty resume: knowledge answers carry no first-person career and grounded answers are untouched", () => {
  const k = "Kerberoasting requests service tickets and cracks them offline. In my last role I caught one in Splunk. Long random service account passwords stop it."
  const r = enforceResumeState(k, "knowledge")
  assert.doesNotMatch(r.text, /last role/); assert.equal(r.dropped, 1)
  assert.equal(enforceResumeState("At Citi, I tuned the Splunk alert.", "grounded").text, "At Citi, I tuned the Splunk alert.")
  assert.match(SERVICE, /enforceResumeState\(finalText, job\.resumeState\)/)
  assert.match(SERVICE, /!resumeSrc && !docsSrc && askedPersonal/)   // no 300 ms dossier wait on a knowledge question
  assert.match(SERVICE, /if \(noResumeState === "personal-no-resume"\) job\.streamPolicy = "guarded-final"/)
})

import {
  answerControls, controlsPrompt, createTitleSplitter, splitTitle, fallbackTitle, firstSentence, TITLE_INSTRUCTION,
} from "../../src/lib/kompasAnswerContract.ts"

test("controls: format, length, tone and STAR are per-request engine parameters with Parakeet-like defaults", () => {
  assert.deepEqual(answerControls({}), { format: "script_bullets", length: "balanced", tone: "simple", star: false })
  const mid = answerControls({ format: "bullet points", length: "Short", tone: "formal", star: "on" })
  assert.deepEqual(mid, { format: "bullets", length: "short", tone: "formal", star: true })
  assert.match(controlsPrompt(mid), /Three terse points/)
  assert.match(controlsPrompt(mid), /STAR is on/)
  assert.match(controlsPrompt(answerControls({})), /STAR is off/)
  assert.match(controlsPrompt(answerControls({})), /plain words, no jargon/)
  assert.match(controlsPrompt(answerControls({ format: "full script", length: "long" })), /spoken paragraph.*one level deeper/)
  // read from THIS request's config, so a mid-call switch changes the next card
  assert.match(SERVICE, /const cardControls = answerControls\(config\)/)
  assert.match(SERVICE, /\$\{controlsPrompt\(cardControls\)\}/)
  assert.match(SERVICE, /controls: job\.controls/)
})

test("title: produced by the same call, stripped from the spoken text, streamed first", () => {
  const s = createTitleSplitter()
  const chunks = ["TI", "TLE: Rate limiting by", " IP vs API key\nI'd key ", "it on the API key first."]
  const out = chunks.map((c) => s.push(c)).join("") + s.flush()
  assert.equal(s.title, "Rate limiting by IP vs API key")
  assert.equal(out, "I'd key it on the API key first.")
  const none = createTitleSplitter()
  assert.equal(["I'd key", " it on the API key."].map((c) => none.push(c)).join("") + none.flush(), "I'd key it on the API key.")
  assert.equal(none.title, "")
  assert.deepEqual(splitTitle("Title: **Conflict with a coworker**\n\nI disagreed with the lead."), { title: "Conflict with a coworker", body: "I disagreed with the lead." })
  assert.equal(splitTitle("Short.").body, "Short.")
  assert.equal(fallbackTitle("so um, how do you scope an access review? and who signs off?"), "How do you scope an access review?")
  assert.match(TITLE_INSTRUCTION, /TITLE: /)
  assert.match(SERVICE, /\$\{TITLE_INSTRUCTION\}/)
  assert.match(SERVICE, /emit\(\{ type: "title", text: titleSent \}\)/)
  assert.match(SERVICE, /title: titler\.title \|\| fallbackTitle\(job\.question\)/)
  assert.match(SERVICE, /title: jsonTitle \|\| fallbackTitle\(job\.question\)/)
})

test("card: model-written bullets are kept, first render needs only the opening line", () => {
  const c = toCard("I'd isolate the host first.\n- Pull the EDR timeline.\n- Reset the account.\n- Tell the owner what changed.", "script_bullets")
  assert.equal(c.script, "I'd isolate the host first.")
  assert.deepEqual(c.bullets, ["Pull the EDR timeline.", "Reset the account.", "Tell the owner what changed."])
  assert.equal(firstSentence("I'd isolate the host first. Then"), "I'd isolate the host first.")
  assert.equal(firstSentence("I'd isolate the host"), "")
  assert.match(SERVICE, /type: "card", partial: true/)
})
