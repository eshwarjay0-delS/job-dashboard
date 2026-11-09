// Offline question intake, 6 Nov 2026.
// Measures chunk concatenation and keyword formation. This is not a live microphone.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { deriveByCode } from "../../src/lib/kompasAnswer.ts"
import { repairDictation } from "../../src/lib/kompasDictation.ts"
import { localDeriveFallback } from "../../src/lib/kompasDeriveFallback.ts"
import { intakeQuestions, questionGroups } from "../../src/lib/kompasQuestionIntake.ts"

function desktopIntake() {
  const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const phrases = src.slice(src.indexOf("const PHRASE_FIXES"), src.indexOf("function fixTerms"))
  const slice = src.slice(src.indexOf("// ── question intake slice 2026-11-06"), src.indexOf("// ── end question intake slice 2026-11-06"))
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(phrases + "\n" + slice + "\nthis.intakeQuestions = intakeQuestions; this.questionGroups = questionGroups; this.formQuestionFromHeard = formQuestionFromHeard;", ctx)
  return ctx
}

const desk = desktopIntake()

function oldGlue(chunks) {
  return chunks.slice(-4).join(" ").slice(-600)
}

test("desktop intake matches the server on the same chunks", () => {
  const samples = [
    ["What is Kubernetes?", "What is Terraform?"],
    ["How would you design a PKI", "for a bank that already runs Venafi?"],
    ["intro"],
    ["strengths"],
    ["weaknesses"],
    ["why this role"],
    ["experience with Kubernetes"],
    ["walk me through a certificate outage"],
    ["about a time the issuance failed"],
    ["questions for us"],
    ["how would you handle a failed rollout"],
    ["conflict"],
    ["certificate rotation failed last quarter"],
    ["kube cuddle"],
    ["What is cooper netties?"],
    ["Yeah.", "What is pee key eye?"],
    ["Tell me about your background with SailPoint.", "Last quarter a campaign stalled.", "How would you redesign the campaign so it finishes on time?"],
  ]
  for (const sample of samples) {
    assert.equal(JSON.stringify(desk.intakeQuestions(sample)), JSON.stringify(intakeQuestions(sample)), JSON.stringify(sample))
  }
})

test("(a) two back-to-back questions stay separate", () => {
  const out = intakeQuestions(["What is Kubernetes?", "What is Terraform?"])
  assert.equal(out.length, 2)
  assert.match(out[0], /Kubernetes/)
  assert.match(out[1], /Terraform/)
  assert.equal(out.some((q) => /Kubernetes/.test(q) && /Terraform/.test(q)), false)
})

test("(b) one question spoken in several short chunks stays one whole question", () => {
  const chunks = ["How would you design a PKI", "for a bank that already runs Venafi?"]
  const out = intakeQuestions(chunks)
  assert.equal(out.length, 1)
  assert.match(out[0], /How would you design a PKI/)
  assert.match(out[0], /Venafi/)
  assert.equal(out[0].startsWith("For a bank"), false)
})

test("(c) the last few unrelated messages do not glue", () => {
  const chunks = ["What is Kubernetes?", "Have you used Terraform?", "What is PKI?", "Walk me through a STAR story."]
  const glued = oldGlue(chunks)
  assert.match(glued, /Kubernetes/)
  assert.match(glued, /STAR/)
  const out = intakeQuestions(chunks)
  assert.equal(out.length, 4)
  assert.equal(out.some((q) => /Kubernetes/.test(q) && /Terraform|PKI|STAR/.test(q)), false)
  const fallback = localDeriveFallback(chunks.map((c) => "Them: " + c).join("\n"))
  assert.match(fallback, /STAR/)
  assert.doesNotMatch(fallback, /Kubernetes/)
})

test("(d) start and end of a question are kept, and the setup in front of the ask stays", () => {
  const chunks = [
    "We run SailPoint in three regions.",
    "Last quarter a certification campaign stalled.",
    "How would you redesign the campaign so it finishes on time?",
  ]
  const out = intakeQuestions(chunks)
  assert.equal(out.length, 1)
  assert.match(out[0], /SailPoint/)
  assert.match(out[0], /finishes on time/)
})

test("(e) keyword intro becomes a tell-me-about-yourself question", () => {
  const out = intakeQuestions(["intro"])
  assert.deepEqual(out, ["Tell me about yourself."])
  assert.match(deriveByCode("Them: intro", []), /Tell me about yourself/)
})

test("(f) the ten basic stems become questions", () => {
  const stems = [
    ["intro", /Tell me about yourself/],
    ["strengths", /strengths/],
    ["weaknesses", /weakness/],
    ["why this company", /Why do you want this role/],
    ["experience with Kubernetes", /experience with Kubernetes/],
    ["walk me through a certificate outage", /Walk me through a certificate outage/],
    ["about a time the cluster failed", /time you the cluster failed|time when the cluster failed|about a time/],
    ["questions for us", /questions do you have for us/],
    ["how would you handle a failed rollout", /How would you handle a failed rollout/],
    ["conflict", /something went wrong/],
  ]
  assert.equal(stems.length, 10)
  for (const [heard, want] of stems) {
    const out = intakeQuestions([heard])
    assert.equal(out.length, 1, heard)
    assert.match(out[0], want, heard + " -> " + out[0])
  }
})

test("(g) a free-form fragment with no question syntax still becomes a question", () => {
  const out = intakeQuestions(["certificate rotation failed last quarter and the bank was down"])
  assert.equal(out.length, 1)
  assert.match(out[0], /\?|time when/i)
  assert.match(out[0], /certificate rotation failed/i)
  const paragraph = intakeQuestions(["The team pages one person for every noisy alert and the queue never clears."])
  assert.equal(paragraph.length, 0, "a long statement with no ask is not a question")
  assert.equal(intakeQuestions(["I don't know"]).length, 0)
  assert.equal(intakeQuestions(["I dunno"]).length, 0)
})

test("(h) dictation repairs keep Kubernetes, PKI, Terraform, STAR, and a few more mishearings", () => {
  const cases = [
    ["What is cooper netties?", "Kubernetes"],
    ["How does kuber netes schedule a pod?", "Kubernetes"],
    ["What is pee kay eye?", "PKI"],
    ["What is terra form?", "Terraform"],
    ["Have you used terror form for infrastructure?", "Terraform"],
    ["Tell me about a time you used the start method.", "STAR method"],
    ["How do you structure an answer with the S T A R method?", "STAR method"],
    ["What is kube cuddle?", "Kubernetes"],
    ["What is koo ber netties?", "Kubernetes"],
    ["What is pee key eye?", "PKI"],
    ["Explain leased privilege.", "least privilege"],
    ["Explain least priviledge.", "least privilege"],
    ["What is zero thrust?", "zero trust"],
    ["We use roll based access.", "role-based access"],
    ["Open grafanna.", "Grafana"],
    ["Scrape promethius.", "Prometheus"],
    ["Our infra structure is old.", "infrastructure"],
    ["We ship with see eye see dee.", "CI/CD"],
    ["Bind active die rectory.", "Active Directory"],
    ["Have you used sale point?", "SailPoint"],
    ["Create an azure service principle name.", "service principal"],
  ]
  for (const [heard, want] of cases) {
    const server = repairDictation(heard)
    const page = desk.formQuestionFromHeard ? null : null
    assert.match(server, new RegExp(want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), heard + " -> " + server)
    assert.equal(repairDictation(server), server, "stable " + heard)
  }
  for (const plain of ["the start of the method is slow", "a terror alert is not a tool", "pick the key that fits", "the cooper union is in the city"]) {
    assert.equal(repairDictation(plain), plain, plain)
  }
})

test("a same-question pause does not depend on silence, and a follow-up stays with its question", () => {
  const mid = intakeQuestions(["How would you rotate certificates in PKI", "without taking Venafi offline?"])
  assert.equal(mid.length, 1)
  assert.match(mid[0], /rotate certificates in PKI/)
  assert.match(mid[0], /Venafi offline/)
  const follow = intakeQuestions(["What is PKI?", "And why?"])
  assert.equal(follow.length, 1)
  assert.match(follow[0], /PKI/)
  assert.match(follow[0], /why/i)
})

test("focused replay: old last-four glue merges questions; the new intake does not", () => {
  const sequences = [
    { chunks: ["What is Kubernetes?", "What is Terraform?"], separate: ["Kubernetes", "Terraform"] },
    { chunks: ["What is PKI?", "Walk me through a STAR story."], separate: ["PKI", "STAR"] },
    { chunks: ["Have you configured CyberArk?", "What is least privilege?"], separate: ["CyberArk", "least privilege"] },
    { chunks: ["intro", "strengths"], separate: ["yourself", "strengths"] },
    { chunks: ["How would you design a PKI", "for a bank that already runs Venafi?"], whole: ["PKI", "Venafi"] },
    { chunks: ["We run SailPoint in three regions.", "How would you redesign the campaign?"], whole: ["SailPoint", "redesign the campaign"] },
    { chunks: ["What is Kubernetes?", "Yeah.", "What is Terraform?"], separate: ["Kubernetes", "Terraform"] },
    { chunks: ["experience with Terraform"], whole: ["Terraform"] },
    { chunks: ["certificate rotation failed last quarter"], whole: ["certificate rotation failed"] },
    { chunks: ["questions for us", "why this role"], separate: ["questions do you have", "want this role"] },
    { chunks: ["The bank has run its own certificate authority for years and the issuance desk sits next to the people who own the applications. " + "x".repeat(700), "How would you rotate one certificate without stopping Venafi?"], whole: ["certificate authority", "Venafi"] },
  ]
  let beforeMerged = 0
  let afterMerged = 0
  let beforeMissedHead = 0
  let afterMissedHead = 0
  for (const seq of sequences) {
    const old = oldGlue(seq.chunks).toLowerCase()
    if (seq.separate && seq.separate.every((term) => old.includes(term.toLowerCase()))) beforeMerged++
    if (seq.whole && seq.whole.some((term) => !old.includes(term.toLowerCase()))) beforeMissedHead++
    const now = intakeQuestions(seq.chunks)
    if (seq.separate) {
      const blob = now.join(" \n ").toLowerCase()
      const oneCardHasTwo = now.some((q) => {
        const hits = seq.separate.filter((term) => q.toLowerCase().includes(term.toLowerCase()))
        return hits.length > 1
      })
      if (oneCardHasTwo || now.length < seq.separate.length) afterMerged++
      assert.equal(oneCardHasTwo, false, JSON.stringify(now))
      for (const term of seq.separate) assert.match(blob, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"))
    }
    if (seq.whole) {
      assert.equal(now.length, 1, JSON.stringify(now))
      for (const term of seq.whole) {
        if (!now[0].toLowerCase().includes(term.toLowerCase())) afterMissedHead++
        assert.match(now[0], new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), now[0])
      }
    }
  }
  assert.ok(beforeMerged >= 4, "before merged " + beforeMerged)
  assert.equal(afterMerged, 0)
  assert.equal(afterMissedHead, 0)
  assert.equal(questionGroups(["What is Kubernetes?", "What is Terraform?"]).length, 2)
})

test("logistics stems are still formed as logistics questions", () => {
  assert.match(intakeQuestions(["salary"])[0], /salary/i)
  assert.match(intakeQuestions(["visa"])[0], /visa/i)
  assert.match(intakeQuestions(["address"])[0], /address/i)
  assert.match(intakeQuestions(["relocation"])[0], /relocation/i)
  assert.match(intakeQuestions(["notice period"])[0], /notice/i)
})

test("pure greetings stay empty", () => {
  assert.deepEqual(intakeQuestions(["Hello."]), [])
  assert.deepEqual(intakeQuestions(["thanks"]), [])
  assert.equal(deriveByCode("Them: makes sense", []), null)
})
