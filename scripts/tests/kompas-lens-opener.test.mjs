// Lens opener r1 (29 Oct 2026). OFFLINE ONLY: pure functions, sample fixture (fictional candidate), no model.
import { test } from "node:test"
import assert from "node:assert/strict"
import { existsSync } from "node:fs"
import { readFileSync } from "node:fs"
import { buildOpenerTable, pickOpener, openerCategory, openerPrompt, withoutOpenerRepeat } from "../../src/lib/kompasOpener.ts"
import { allowedNumbers } from "../../src/lib/kompasGuards.ts"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const SRC = { resume: S.resume, documents: S.documents }
const ITEMS = [
  { id: "resume:1", sourceDoc: "resume", category: "experience-story", status: "sourced", text: "Led incident response for a leaked API key: rotated the key in KMS, scoped the blast radius and wrote the post-incident review." },
  { id: "resume:0", sourceDoc: "resume", category: "experience-story", status: "sourced", text: "Built Splunk detections for AWS CloudTrail and GuardDuty findings and cut alert triage time by 40%." },
  { id: "doc:0", sourceDoc: "document", category: "introduction", status: "sourced", text: "At Northwind Bank I owned the detection backlog and reviewed every new CloudTrail rule with the platform team before it shipped." },
  // refused: reworded, invented number, hole, JD line
  { id: "bad:1", sourceDoc: "resume", category: "experience-story", status: "sourced", text: "Built Splunk detections and cut triage time by 65%." },
  { id: "bad:2", sourceDoc: "resume", category: "experience-story", status: "hole", text: "Cut costs by [ ___ confirm ]." },
  { id: "bad:3", sourceDoc: "jd", category: "introduction", status: "sourced", text: "Lead incident response, partner with audit on control evidence." },
  { id: "bad:4", sourceDoc: "resume", category: "experience-story", status: "sourced", text: "Reduced incidents by 50% across the whole bank." },
]
const { table, refused } = buildOpenerTable(ITEMS, SRC)
const all = Object.values(table).flat()

test("every opener is verbatim from its own source document; reworded, hole and JD items are refused with a reason", () => {
  for (const o of all) {
    assert.equal(o.verbatim, true)
    const hay = (o.sourceDoc === "resume" ? S.resume : S.documents).replace(/\s+/g, " ")
    assert.ok(hay.includes(o.text), o.text)
  }
  assert.deepEqual(refused.map((r) => r.id).sort(), ["bad:1", "bad:2", "bad:3", "bad:4"])
  for (const r of refused) assert.ok(r.reason.length > 3)
})

test("no invented numbers or stories: every figure in every opener is in allowedNumbers of the experience sources", () => {
  const allowed = allowedNumbers(S.resume, S.documents)
  for (const o of all) for (const f of o.text.match(/\b\d[\d,.]*%?/g) || []) assert.ok(allowed.has(f.replace(/[.,]$/, "")), f)
  assert.ok(!all.some((o) => /65%|50%/.test(o.text)))
})

test("empty category gives no opener (null), never a JD line, a hole or a generated line", () => {
  assert.equal(pickOpener(buildOpenerTable([], SRC).table, "Tell me about a time you handled an incident."), null)
  // r7 relabel (opener honesty): no matched passage, no opener; with doc:0 matched it is doc:0
  assert.equal(pickOpener(table, "Introduce yourself."), null)
  assert.equal(pickOpener(table, "Introduce yourself.", { passages: [{ id: "doc:0" }] })?.sourceId, "doc:0")
  assert.equal(pickOpener(buildOpenerTable(ITEMS.filter((i) => i.category !== "introduction" || i.sourceDoc === "jd"), SRC).table, "Introduce yourself."), null)
  // concept and scenario questions keep the existing first-sentence rules
  assert.equal(pickOpener(table, "What is zero trust?"), null)
  assert.equal(pickOpener(table, "How would you design a SIEM pipeline?"), null)
})

test("the matched passage id wins when it has an opener; otherwise the first sourced item", () => {
  const q = "Tell me about a time you led incident response."
  assert.equal(openerCategory(q), "experience-story")
  assert.equal(pickOpener(table, q, { passages: [{ id: "resume:0", kind: "experience" }] })?.sourceId, "resume:0")
  assert.equal(pickOpener(table, q, { passages: [{ id: "jd:0", kind: "emphasis" }] }), null) // r7 relabel: was the first sourced item (resume:1); no approved passage now means no opener
})

test("the body does not repeat the opener: prompt tells it, and restating sentences are dropped", () => {
  const o = pickOpener(table, "Tell me about a time you led incident response.", { passages: [{ id: table["experience-story"][0].sourceId }] }) // r7: matched passage passed explicitly
  const p = openerPrompt(o)
  assert.match(p, /OPENER ALREADY SPOKEN/); assert.ok(p.includes(o.text)); assert.match(p, /do not (?:restate|repeat)/i)
  assert.match(openerPrompt(null), /point first/i); assert.doesNotMatch(openerPrompt(null), /ALREADY SPOKEN/)
  const body = "I led incident response for a leaked API key, rotated the key in KMS, scoped the blast radius and wrote the post-incident review. The hard part was knowing which services used the key. I checked CloudTrail for every call made with it before I rotated."
  const out = withoutOpenerRepeat(body, o)
  assert.doesNotMatch(out, /leaked API key, rotated/); assert.match(out, /^The hard part/); assert.match(out, /CloudTrail/)
  assert.equal(withoutOpenerRepeat(body, null), body)
})

test(`fold: 200 personal questions x item orders, 0 non-verbatim, 0 invented figures, 0 body repeats`, () => {
  const qs = ["Tell me about a time you {x}.", "Describe a situation where you {x}.", "What was your biggest challenge when you {x}?", "Walk me through a project where you {x}."]
  const xs = ["led incident response", "built detections", "handled a leaked key", "worked with audit", "tuned noisy rules"]
  const allowed = allowedNumbers(S.resume, S.documents); let bad = 0, n = 0
  for (let i = 0; i < 200; i++) {
    const items = i % 2 ? [...ITEMS].reverse() : ITEMS
    const t = buildOpenerTable(items, SRC).table
    const q = qs[i % qs.length].replace("{x}", xs[i % xs.length]); const o = pickOpener(t, q, { passages: [{ id: t[openerCategory(q)]?.[0]?.sourceId }] }) // r7: matched passage passed explicitly
    n++; if (!o) { bad++; continue }
    const hay = (o.sourceDoc === "resume" ? S.resume : S.documents).replace(/\s+/g, " ")
    if (!hay.includes(o.text)) bad++
    if ((o.text.match(/\b\d[\d,.]*%?/g) || []).some((f) => !allowed.has(f.replace(/[.,]$/, "")))) bad++
    if (withoutOpenerRepeat(`${o.text} Then I checked the result.`, o).includes(o.text)) bad++
  }
  console.log(`opener fold bad ${bad}/${n}`); assert.equal(bad, 0)
})

const FAST = "/workspace/speed-work/src/fastIndex.ts"
test("integration with the speed-work fastIndex prototype (skipped if absent): its matched passage ids drive the pick", { skip: !existsSync(FAST) }, async () => {
  const { buildIndex, matchQuestion } = await import(FAST)
  const ix = buildIndex({ resume: S.resume, documents: S.documents, jd: S.jd })
  const q = "Tell me about a time you led incident response for a leaked key."
  const m = matchQuestion(ix, q)
  assert.equal(m.category, openerCategory(q))
  const items = m.passages.filter((p) => p.kind === "experience").map((p) => ({ id: p.id, sourceDoc: p.id.startsWith("documents") ? "document" : "resume", category: "experience-story", status: "sourced", text: p.text.replace(/^- /, "") }))
  const t = buildOpenerTable(items, SRC)
  const o = pickOpener(t.table, q, m)
  assert.ok(o, JSON.stringify(t.refused)); assert.equal(o.sourceId, m.passages.find((p) => p.kind === "experience").id)
  assert.match(o.text, /leaked API key/)
})

test("failure hunt: a concept question that trips the category words gets no opener", () => {
  assert.equal(pickOpener(table, "What is the biggest risk in cloud?"), null)
  assert.equal(pickOpener(table, "What is the main challenge with zero trust?"), null)
})
