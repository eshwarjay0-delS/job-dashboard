// Lens 3D/4D (30 Oct 2026): pivot and perspective moves from the 17 audio overviews (research/podcast-3d-4d-presentation.md).
// Offline, deterministic. Behind KOMPAS_DESKTOP_LENS (default off).
import test from "node:test"
import assert from "node:assert/strict"
import * as P from "../../src/lib/kompasPivot.ts"
import * as A from "../../src/lib/kompasAudience.ts"
import * as D from "../../src/lib/kompasDesktopResponse.ts"

const words = (t) => t.split(/\s+/).filter(Boolean).length

test("question types", () => {
  assert.equal(P.questionType("What is a zero trust network?"), "define")
  assert.equal(P.questionType("Why would you pick Terraform over CloudFormation?"), "tradeoff")
  assert.equal(P.questionType("What happened when the deployment failed?"), "failure")
  assert.equal(P.questionType("How would you set up log monitoring for a new service?"), "howto")
  assert.equal(P.questionType("Tell me about a time you disagreed with a teammate."), "behavioural")
  assert.equal(P.questionType("Can you go deeper on that?"), "deeper")
  // Fold 1: a topic word ("incident", "design") is not the ask.
  assert.equal(P.questionType("What is incident response?"), "define")
  assert.equal(P.questionType("What is AWS VPC design?"), "define")
  assert.equal(P.questionType("What are the tradeoffs of incident response?"), "tradeoff")
  assert.equal(P.questionType("How would you set up incident response?"), "howto")
  assert.equal(P.questionType("Tell me about an outage with Splunk."), "failure")
})

test("2 or 3 moves, at most one analogy, every type and depth", () => {
  for (const q of ["What is IAM?", "Tradeoffs of microservices?", "Tell me about a time you failed.", "Go deeper on the pipeline.", "Explain VPNs simply."])
    for (const a of ["hr", "director", "architect", "practitioner", "hiring_manager"]) {
      const m = P.pickMoves(q, a, [])
      assert.ok(m.length >= 2 && m.length <= 3, `${q} ${a} ${m.length}`)
      assert.ok(m.filter((x) => x.analogy).length <= 1)
    }
})

test("ledger: consecutive follow-ups never repeat an angle", () => {
  let ledger = []
  let prev = []
  for (const q of ["What is a SIEM?", "Go deeper.", "Where does it break?", "Why that over the other way?", "Go deeper again.", "And how would you roll it out?"]) {
    const m = P.pickMoves(q, "practitioner", ledger)
    const ids = m.map((x) => x.angle)
    assert.equal(ids.filter((x) => prev.includes(x)).length, 0, `${q}: ${ids} vs ${prev}`)
    ledger = P.recordAngles(ledger, ids); prev = ids
  }
})

test("pivot text: first person, spoken hedge / written [ ___ confirm ], no digits, quarter is scope not percent, short", () => {
  const t = P.pivotBlock("Tell me about a time you led a migration.", "director", [])
  assert.match(t, /^PIVOT /)
  assert.doesNotMatch(t, /\[\s*_{2,}/)
  assert.match(t, /I would want to confirm that/)
  assert.match(P.pivotBlock("Tell me about a time you led a migration.", "director", [], "written"), /\[ ___ confirm \]/)
  assert.doesNotMatch(t, /\d|%/)
  assert.ok(words(t) <= 150, `words ${words(t)}`)
  for (const m of P.MOVES) {
    assert.doesNotMatch(m.say, /\d/, m.angle)
    assert.match(m.say, /\bI\b|\bmy\b/, m.angle)
  }
  const q = P.MOVES.find((m) => m.angle === "quarter_scope")
  assert.match(q.say, /quarter|three-quarters/)
  assert.doesNotMatch(q.say, /%|\d/)
})

test("logistics gets nothing; a mixed ask keeps its real part", () => {
  assert.equal(P.pivotBlock("What is your expected salary?", "hr", []), "")
  assert.equal(P.pivotBlock("Are you willing to relocate?", "director", []), "")
  // Fold 0: AQ's helper does not reduce this one on this base (reported 29 Oct); the lens backstop does.
  assert.equal(P.pivotBlock("What is your expected hourly rate?", "hr", []), "")
  assert.equal(P.pivotBlock("What is your desired pay range?", "director", []), "")
  assert.match(P.pivotBlock("What is a rate limiter?", "practitioner", []), /^PIVOT /)
  assert.match(P.pivotBlock("What is Kubernetes? And are you willing to relocate?", "practitioner", []), /^PIVOT /)
  assert.doesNotMatch(P.pivotBlock("What is Kubernetes? And are you willing to relocate?", "practitioner", []), /relocat/i)
})

test("flag off: desktop slots byte-identical; lensBlock unchanged", () => {
  const pol = { guidance: "G" }
  const off = D.desktopDelivery(pol, "director", "What is IAM?", { on: false })
  assert.deepEqual(off, { on: false, delivery: "G", tail: "G" })
  assert.doesNotMatch(A.lensBlock("director", "What is IAM?"), /PIVOT/)
})

test("flag on: delivery carries the pivot after the lens block; ledger rotates", () => {
  const ledger = []
  const a = D.desktopDelivery({ guidance: "G" }, "director", "What is IAM?", { on: true, ledger })
  assert.match(a.delivery, /LENS [\s\S]* PIVOT /)
  const b = D.desktopDelivery({ guidance: "G" }, "director", "Go deeper.", { on: true, ledger })
  const angles = (s) => [...s.slice(s.indexOf("PIVOT")).matchAll(/\(([a-z_]+)\)/g)].map((x) => x[1])
  assert.equal(angles(a.delivery).filter((x) => angles(b.delivery).includes(x)).length, 0)
  assert.equal(D.desktopDelivery({ guidance: "G" }, "hr", "What is your expected salary?", { on: true }).on, false)
})
