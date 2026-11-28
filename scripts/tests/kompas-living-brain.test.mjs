import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import {
  appendSession, brainPrompt, clearBrainCacheForTests, editChunk, ensureAnswerBrain,
  forbiddenProfile, isDesignWalkthrough, parseBrain, projectBrain, renderBrain,
  reviseLivingAnswer, seedBrain, selectChunks, setBrainBackendForTests, traceChunks, wordsBefore,
} from "../../src/lib/kompasLivingBrain.ts"

const gate = createRequire(import.meta.url)("../../public/kompas/brain-gate.js")
const houston = readFileSync(new URL("../../src/lib/kompas-houston-resume.txt", import.meta.url), "utf8")
const owner = "ab".repeat(8)

function memoryBackend(delayMs = 0) {
  const files = new Map()
  let reads = 0
  return {
    files,
    reads: () => reads,
    async getText(key) {
      reads += 1
      if (delayMs && key.endsWith("document.md")) await new Promise((resolve) => setTimeout(resolve, delayMs))
      return files.has(key) ? files.get(key) : null
    },
    async putText(key, text) { files.set(key, text) },
  }
}

test.afterEach(() => {
  setBrainBackendForTests(null)
  clearBrainCacheForTests()
})

test("the Houston resume is projected per role and the other profile is left out", () => {
  const doc = projectBrain({
    houston,
    persona: "I like plain explanations.",
    books: [{ q: "How did you migrate the firewalls?", a: "I led the FortiGate-VM migrations across six AWS regions and kept the old path up during the cutover." }],
    masterChunks: [{ title: "Other profile", text: "jayeshwar44 ran a Saint Louis SOC." }, { title: "Rehearsal", text: "I described the FortiGate HA cluster in the last practice session and kept the story on that deployment." }],
    preparedChunks: [{ title: "PAM category", text: "Category note about assessing an existing privileged-access setup before a design." }],
  })
  const markdown = renderBrain(doc)
  assert.match(markdown, /## Identity & Personality/)
  assert.match(markdown, /## What I Know/)
  assert.match(markdown, /## Talents & Signature Stories/)
  assert.match(markdown, /## How I Answer/)
  assert.match(markdown, /## Category Knowledge/)
  assert.match(markdown, /## Role Lenses/)
  assert.match(markdown, /## Learned From Sessions/)
  assert.match(markdown, /## Feedback Log/)
  assert.match(markdown, /## What I'm Working On/)
  assert.match(markdown, /FortiGate-VM/)
  assert.match(markdown, /Role: Fortinet AWS Cloud Networking Engineer/)
  assert.equal(forbiddenProfile(markdown), false)
  assert.doesNotMatch(markdown, /jayeshwar44/)
  assert.match(markdown, /I like plain explanations/)
  const dirty = projectBrain({ houston, persona: "jayeshwar44@gmail.com did other work and I like plain explanations." })
  assert.doesNotMatch(renderBrain(dirty), /jayeshwar44|plain explanations/)
  assert.match(markdown, /PAM category/)
  assert.match(markdown, /How did you migrate the firewalls/)
  const again = parseBrain(markdown)
  assert.equal(again.chunks.length, doc.chunks.length)
  assert.equal(again.chunks.some((item) => item.section === "What I Know" && item.enabled), true)
})

test("a switched-off chunk drops out and a heavier chunk ranks first", () => {
  const doc = projectBrain({ houston })
  const know = doc.chunks.find((item) => item.section === "What I Know")
  const off = editChunk(doc, know.id, { enabled: false }).doc
  assert.equal(selectChunks(off, "How do you deploy FortiGate").some((item) => item.id === know.id), false)
  const custom = {
    revision: 1,
    updatedAt: "",
    chunks: [
      { id: "low", section: "Category Knowledge", tags: ["fortigate"], weight: 0.5, enabled: true, source: "test", body: "A light FortiGate note." },
      { id: "high", section: "Category Knowledge", tags: ["fortigate"], weight: 4, enabled: true, source: "test", body: "A heavy FortiGate note." },
    ],
  }
  const picked = selectChunks(custom, "Tell me about FortiGate")
  assert.equal(picked[0].id, "high")
  const traced = traceChunks(off, "Tell me about FortiGate")
  assert.equal(traced.some((row) => row.id === know.id), false)
  assert.match(brainPrompt(doc, "design FortiGate"), /How I Answer/)
  assert.doesNotMatch(brainPrompt(doc, "design FortiGate"), /BRAIN POLICY/)
})

test("session write-back dedupes learnings and stores feedback with the question", () => {
  const doc = projectBrain({ houston })
  const qa = [{ q: "How did you cut over the firewalls?", a: "I led the FortiGate-VM cutover and kept the previous path available until verification passed." }]
  const before = "one two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty twentyone twentytwo twentythree twentyfour twentyfive twentysix twentyseven twentyeight twentynine thirty thirtyone thirtytwo thirtythree thirtyfour thirtyfive thirtysix thirtyseven thirtyeight thirtynine forty extra"
  assert.equal(wordsBefore(before).split(/\s+/).length, 40)
  assert.equal(wordsBefore("alpha beta gamma delta").split(/\s+/).length, 4)
  const first = appendSession(doc, {
    qa,
    transcript: "You: I kept the FortiGate verification notes next to the change ticket before I called the cutover done.",
    notes: [{ question: qa[0].q, answer: qa[0].a, before, note: "Say the stakeholder meeting earlier." }],
  })
  assert.equal(first.addedLearnings >= 1, true)
  assert.equal(first.addedNotes, 1)
  const note = first.doc.chunks.find((item) => item.section === "Feedback Log" && /stakeholder meeting/.test(item.body))
  assert.ok(note)
  assert.match(note.body, new RegExp(qa[0].q.slice(0, 20)))
  const beforeWords = note.body.split("Before: ")[1].split("\n")[0].trim().split(/\s+/)
  assert.equal(beforeWords.length, 40)
  assert.equal(beforeWords[0] === "one", false)
  assert.equal(beforeWords[beforeWords.length - 1], "extra")
  const second = appendSession(first.doc, { qa, notes: [{ question: qa[0].q, answer: qa[0].a, before, note: "Say the stakeholder meeting earlier." }] })
  assert.equal(second.addedLearnings, 0)
  assert.equal(second.addedNotes, 0)
})

test("a design question is revised once into a walkthrough and a bullet list becomes prose", () => {
  const brain = renderBrain(projectBrain({ houston }))
  const bullets = reviseLivingAnswer("How do you deploy a cluster?", "- I build the cluster.\n- I test the failover.", { brain })
  assert.equal(bullets.revised, true)
  assert.doesNotMatch(bullets.text, /^\s*[-*]/m)
  assert.match(bullets.text, /I build the cluster/)
  const designed = reviseLivingAnswer("Tell me about a time you set up CyberArk PAM from the ground up.", "I would start with a diagram.", { brain, earlier: "I led the FortiGate-VM deployments." })
  assert.equal(isDesignWalkthrough("Tell me about a time you set up CyberArk PAM from the ground up."), true)
  assert.match(designed.text, /assessing the existing setup/)
  assert.match(designed.text, /stakeholders/)
  assert.match(designed.text, /phased build/)
  assert.match(designed.text, /verification/)
  assert.doesNotMatch(designed.text, /CyberArk/)
  const denied = reviseLivingAnswer("Have you used FortiGate?", "I have not used FortiGate on any deployment.", { brain, earlier: "FortiGate-VM is on my resume." })
  assert.doesNotMatch(denied.text, /have not used FortiGate/i)
})

test("a slow brain read is kept and a second answer uses memory", async () => {
  const store = memoryBackend(200)
  store.files.set("dossier/keep/profile.json", "do not delete")
  setBrainBackendForTests(store)
  const started = Date.now()
  const first = await ensureAnswerBrain(owner, { question: "How do you design a FortiGate deployment?" })
  assert.ok(Date.now() - started >= 150)
  assert.match(first.prompt, /FortiGate/)
  assert.ok(first.trace.some((row) => row.section === "How I Answer"))
  const reads = store.reads()
  const second = await ensureAnswerBrain(owner, { question: "What did you migrate?" })
  assert.equal(store.reads(), reads)
  assert.match(second.prompt, /How I Answer/)
  await seedBrain(owner, { houston, books: [{ q: "How did the cutover go?", a: "I kept the FortiGate-VM path up until the six-region verification was finished." }] })
  assert.equal(store.files.get("dossier/keep/profile.json"), "do not delete")
  assert.match(store.files.get(`kompas/brain/${owner}/document.md`), /## What I Know/)
})

test("the feedback tab and mic stay hidden on a live session", () => {
  assert.equal(gate.feedbackTabVisible("live"), false)
  assert.equal(gate.feedbackTabVisible({ type: "live" }), false)
  assert.equal(gate.feedbackTabVisible({ type: "mock" }), false)
  assert.equal(gate.feedbackTabVisible({ type: "chat" }), false)
  assert.equal(gate.feedbackTabVisible(null), false)
  assert.equal(gate.feedbackTabVisible("category"), true)
  assert.equal(gate.feedbackTabVisible({ type: "role" }), true)
  function node(id) {
    return { id, hidden: false, attrs: {}, setAttribute(key, value) { this.attrs[key] = value }, getAttribute(key) { return this.attrs[key] || null } }
  }
  function doc() {
    const nodes = { answerTabFeedback: node("answerTabFeedback"), answerFeedbackPane: node("answerFeedbackPane"), feedbackMic: node("feedbackMic") }
    return { getElementById(id) { return nodes[id] || null }, nodes }
  }
  const live = doc()
  assert.equal(gate.applyFeedbackVisibility(live, { type: "live" }), false)
  assert.equal(live.nodes.answerTabFeedback.hidden, true)
  assert.equal(live.nodes.answerFeedbackPane.hidden, true)
  assert.equal(live.nodes.feedbackMic.hidden, true)
  assert.equal(live.nodes.feedbackMic.attrs["aria-pressed"], "false")
  const role = doc()
  assert.equal(gate.applyFeedbackVisibility(role, { type: "role" }), true)
  assert.equal(role.nodes.answerTabFeedback.hidden, false)
  assert.equal(role.nodes.feedbackMic.hidden, false)
  const category = doc()
  assert.equal(gate.applyFeedbackVisibility(category, { type: "category" }), true)
  assert.equal(category.nodes.answerTabFeedback.hidden, false)
  const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
  const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(html, /id="answerTabFeedback"[^>]*hidden/)
  assert.match(html, /id="feedbackMic"[^>]*hidden/)
  assert.match(html, /id="navBrain"/)
  assert.match(app, /KompasBrainGate/)
  assert.match(app, /applyFeedbackVisibility/)
  assert.doesNotMatch(service, /BRAIN_POLICY/)
  assert.match(service, /ensureAnswerBrain\(/)
  const call = service.slice(service.indexOf("ensureAnswerBrain("), service.indexOf("ensureAnswerBrain(") + 240)
  assert.doesNotMatch(call, /110|300|Promise\.race/)
})
