// Source grounding r3 (29 Oct 2026): offline, code-level only; not live answer quality.
import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { sourceDocs, retrievePassages, sourcePassagesPrompt, splitPassages } from "../../src/lib/kompasSourceRetrieval.ts"
import { draftSpokenAnswer, experienceLines, sameAnswerRatio } from "../../src/lib/kompasDissection.ts"
import { normalizeResumeLayout } from "../../src/lib/kompasResumeLayout.ts"
import { LAYOUTS } from "../kompas-grounding-r3-folds.mjs"

const S = JSON.parse(readFileSync(new URL("../../tests/fixtures/kompas-sample-sources.json", import.meta.url), "utf8"))
const docsFor = (resume) => sourceDocs({ ...S, resume })

test("layout: a one-paragraph resume is split into sentences and the name line is not experience", () => {
  const lines = experienceLines(LAYOUTS.flat)
  assert.ok(lines.length >= 7, `got ${lines.length} lines`)
  assert.ok(!lines.some((l) => /Riley/.test(l)))
  const d = draftSpokenAnswer("Tell me about a time Splunk detections went wrong.", "engineer", LAYOUTS.flat)
  assert.ok(!/riley/i.test(d), d)
})
test("layout: table rows become role-headed passages; the header and divider rows are not passages", () => {
  const ps = splitPassages(docsFor(LAYOUTS.table)).filter((p) => p.source === "resume")
  assert.equal(ps.length, 7)
  assert.ok(ps.every((p) => !p.line.includes("|")))
  assert.match(ps[0].text, /Northwind Bank/)
  assert.ok(!experienceLines(LAYOUTS.table).some((l) => /\|/.test(l)))
})
test("layout: 'Role | Employer | Years' lines in a bulleted resume become role headings", () => {
  const ps = splitPassages(docsFor(LAYOUTS.bullets)).filter((p) => p.source === "resume")
  assert.ok(ps.find((p) => /Residual risk|residual risk/.test(p.line)).text.includes("Contoso Health"))
  assert.ok(!ps.some((p) => /^Senior Cloud Security Engineer \|/.test(p.line)))
})
test("layout failsafe: the subheading layout, empty and junk input are unchanged", () => {
  assert.equal(normalizeResumeLayout(S.resume), S.resume)
  assert.equal(normalizeResumeLayout(""), "")
  assert.equal(normalizeResumeLayout(null), "")
  assert.equal(normalizeResumeLayout("| | |"), "| | |")
})
test("every layout keeps the 1.5x mode gap and no near-duplicate for a different next question", () => {
  for (const [name, resume] of Object.entries(LAYOUTS)) {
    for (const q of ["How did you handle access reviews?", "Tell me about a time Splunk detections went wrong.", "How did you handle post-incident review?"]) {
      const w = ["engineer", "director", "architect"].map((l) => draftSpokenAnswer(q, l, resume).split(/\s+/).length)
      assert.ok(w[1] >= w[0] * 1.5 && w[2] >= w[1] * 1.5, `${name} ${q} ${w}`)
    }
    const a1 = draftSpokenAnswer("Tell me about a time Splunk detections went wrong.", "engineer", resume)
    const a2 = draftSpokenAnswer("Tell me about a time CloudTrail findings went wrong.", "engineer", resume, [a1])
    assert.ok(sameAnswerRatio(a1, a2) < 0.8, name)
  }
})
test("misheard voice words still find the right passage", () => {
  const docs = sourceDocs(S)
  for (const [q, want] of [["How did you lead the team on spunk detections?", /Splunk/], ["Tell me about a time privilege accounts went wrong.", /privileged/],
    ["Tell me about a time post incident review went wrong.", /post-incident/], ["How did you handle hippa controls?", /HIPAA/]]) {
    const r = retrievePassages(q, docs)
    assert.ok(r.matched, q)
    assert.match(r.passages[0].text, want, q)
  }
})
test("misheard matching does not invent coverage for uncovered topics", () => {
  for (const q of ["How did you handle Okta SSO rollout?", "Tell me about PCI DSS scoping.", "Walk me through Kubernetes admission controllers."])
    assert.equal(retrievePassages(q, sourceDocs(S)).matched, false, q)
})
test("partly covered ask: the missing part is named as not in sources; fully covered pairs are not", () => {
  const r = retrievePassages("How did you approach Splunk detections and Okta SSO rollout?", sourceDocs(S))
  assert.ok(r.matched)
  assert.deepEqual(r.missing, ["Okta SSO rollout"])
  assert.match(sourcePassagesPrompt(r), /PARTLY NOT IN YOUR SOURCES: Okta SSO rollout/)
  const both = retrievePassages("How did you approach Terraform guardrails and access reviews?", sourceDocs(S))
  assert.deepEqual(both.missing || [], [])
  assert.doesNotMatch(sourcePassagesPrompt(both), /PARTLY/)
})
test("'what else' leads on an unused passage that covers the topic, even when both were said", () => {
  const docs = sourceDocs({ ...S, dossier: "I ran access reviews for the Contoso Health admin group before each audit.\nI cut noisy SIEM rules by retiring the ones nobody acted on." })
  const said = "I ran access reviews for the Contoso Health admin group before each audit. I ran quarterly access reviews for 1,200 privileged accounts and removed stale admin rights."
  const r = retrievePassages("What else did you do on access reviews?", docs, 4, { recent: [said.replace(/I ran quarterly.*$/, "")] })
  assert.match(r.passages[0].line, /quarterly access reviews/)
  const r2 = retrievePassages("What else did you do on noisy SIEM rules?", docs, 4, { recent: ["I cut noisy SIEM rules by retiring the ones nobody acted on."] })
  assert.doesNotMatch(r2.passages[0].line, /retiring the ones/)
})
test("failsafe: 'going back to' keeps the passage just used", () => {
  const docs = sourceDocs(S)
  const used = "Led incident response for a leaked API key: rotated the key in KMS, scoped the blast radius and wrote the post-incident review."
  assert.match(retrievePassages("Going back to the leaked API key, what was hardest?", docs, 4, { recent: [used] }).passages[0].line, /leaked API key/)
})
test("a misheard word split in two ('sis log') meets the one source word ('syslog')", () => {
  for (const resume of [LAYOUTS.bullets, LAYOUTS.table]) {
    const r = retrievePassages("Tell me about a time sis log sources went wrong.", docsFor(resume))
    assert.ok(r.matched)
    assert.match(r.passages[0].text, /syslog/)
  }
})
test("weighting measurement: the question-kind boost never puts the right passage first less often than no boost", async () => {
  const W = await import("../kompas-weighting-r3.mjs")
  const on = W.measure(true), off = W.measure(false)
  for (const k of Object.keys(off)) assert.ok(on[k].top1 >= off[k].top1, k)
})
