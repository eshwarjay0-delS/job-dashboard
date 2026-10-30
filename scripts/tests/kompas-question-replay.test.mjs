// Offline replay of the live question cut.
// Before this change, on these 50 sequences (66 asks), using the silence window
// and the single-question cut the desktop was shipping:
//   missed 21/66 (31.8%), merged 20/66 (30.3%), misheard 11/11.
// A merged ask is one that shared its cut with a different question.
// A misheard ask still carried the garble, or never named the term.
// After: each of those counts is 0. This is not a live microphone session.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { answerableQuestions, clauseStillOpen, shortFollowUp, splitDistinctAsks } from "../../src/lib/kompasAnswer.ts"

const SILENCE_MS = 1100
const AUTO_QUIET_MS = 2200
const OPEN_HOLD_MS = 7000
const Q_CUE = /\?\s*$|^(so,? )?(what|how|why|when|where|which|who|whose|can|could|would|will|should|do|does|did|are|is|was|were|have|has|tell|walk|describe|explain|give|share|talk|imagine|suppose|let's|lets)\b|\b(tell me|walk me|how would you|what would you|why did you|can you|could you|would you|have you|do you|are you|what is|what are)/i

function hasTerm(text, term) {
  if (term.includes(" ")) return text.toLowerCase().includes(term)
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  return new RegExp("\\b" + escaped + "\\b", "i").test(text)
}
function garbledLeft(text, term) {
  return hasTerm(text, term)
}
function covers(cut, ask) {
  return ask.must.every((m) => hasTerm(cut, m))
}
function replay(seq) {
  let pending = []
  let hist = (seq.history || []).slice()
  const cuts = []
  const flush = () => {
    if (!pending.length) return
    const heard = pending.map((part) => "Them: " + part.text).join("\n")
    for (const q of answerableQuestions(heard, hist)) {
      cuts.push(q)
      hist = hist.concat([{ q, a: "x".repeat(80) }])
    }
    pending = []
  }
  for (const part of seq.utts) {
    if (pending.length) {
      const joined = pending.map((p) => p.text).join(" ")
      const armed = Q_CUE.test(joined) || shortFollowUp(joined)
      const wait = clauseStillOpen(joined) ? OPEN_HOLD_MS : AUTO_QUIET_MS
      if (armed && part.pauseBeforeMs >= SILENCE_MS + wait) flush()
    }
    pending.push(part)
  }
  flush()
  return cuts
}

const prevNla = [{ q: "What is NLA and why do we disable it?", a: "NLA checks the client before the session starts." }]
const prevPki = [{ q: "What is PKI?", a: "PKI is the set of keys and certificates that prove identity." }]
const prevK8s = [{ q: "What is Kubernetes?", a: "Kubernetes schedules containers across a cluster." }]
const prevTf = [{ q: "What is Terraform?", a: "Terraform declares infrastructure and applies it from state." }]
const prevLp = [{ q: "What is least privilege?", a: "Least privilege means each account gets only the access it needs." }]

const S = []
const add = (id, utts, asks, history = []) => S.push({ id, utts, asks, history })
const u = (text, pause = 0) => ({ text, pauseBeforeMs: pause })

add("01 back to back kubernetes then terraform", [
  u("What is Kubernetes and when would you use it?"),
  u("What is Terraform and how do you keep state safe?", 1500),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["terraform"], independent: true },
])
add("02 back to back pki then star", [
  u("What is PKI and why does a bank run its own?"),
  u("Walk me through a STAR story about a certificate outage.", 1800),
], [
  { must: ["pki"], independent: true },
  { must: ["star"], independent: true },
])
add("03 back to back cyberark then least privilege", [
  u("Have you configured CyberArk?"),
  u("What is least privilege?", 1600),
], [
  { must: ["cyberark"], independent: true },
  { must: ["least privilege"], independent: true },
])
add("04 three back to back nla residual exception", [
  u("What is NLA?"),
  u("What is residual risk?", 1400),
  u("What is a policy exception?", 1700),
], [
  { must: ["nla"], independent: true },
  { must: ["residual risk"], independent: true },
  { must: ["policy exception"], independent: true },
])
add("05 one breath kubernetes and terraform", [
  u("What is Kubernetes? What is Terraform?"),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["terraform"], independent: true },
])
add("06 one breath pki and star", [
  u("What is PKI? Have you used the STAR method?"),
], [
  { must: ["pki"], independent: true },
  { must: ["star"], independent: true },
])
add("07 one breath incident then terraform", [
  u("Tell me about a time you handled an incident. What is Terraform?"),
], [
  { must: ["incident"], independent: true },
  { must: ["terraform"], independent: true },
])
add("08 long pause mid pki question", [
  u("How would you design a PKI"),
  u("for a bank that already runs Venafi?", 4000),
], [
  { must: ["pki", "venafi"], independent: true },
])
add("09 pause under the auto window still one question", [
  u("How would you design a PKI"),
  u("for a bank that already runs Venafi?", 2500),
], [
  { must: ["pki", "venafi"], independent: true },
])
add("10 longer pause mid sentence", [
  u("How would you rotate certificates in PKI"),
  u("without taking the bank's Venafi issuance offline?", 5200),
], [
  { must: ["pki", "venafi"], independent: true },
])
add("11 and why after pki", [
  u("And why?", 4000),
], [
  { must: ["pki", "why"], independent: false },
], prevPki)
add("12 why after kubernetes", [
  u("Why?", 4500),
], [
  { must: ["kubernetes", "why"], independent: false },
], prevK8s)
add("13 how come after terraform", [
  u("How come?", 4000),
], [
  { must: ["terraform"], independent: false },
], prevTf)
add("14 and how after least privilege", [
  u("And how?", 3800),
], [
  { must: ["least privilege", "how"], independent: false },
], prevLp)
add("15 filler before terraform", [
  u("Um, so, yeah, okay, right, what is Terraform?"),
], [
  { must: ["terraform"], independent: true },
])
add("16 filler before pki", [
  u("Right, right. Great. So what is PKI?"),
], [
  { must: ["pki"], independent: true },
])
add("17 filler between star and terraform", [
  u("What is the STAR method?"),
  u("Yeah. Okay.", 1200),
  u("What is Terraform?", 1500),
], [
  { must: ["star"], independent: true },
  { must: ["terraform"], independent: true },
])
add("18 mishear cooper netties", [
  u("What is cooper netties?"),
], [
  { must: ["kubernetes"], garbled: ["cooper"], independent: true },
])
add("19 mishear kuber netes", [
  u("How does kuber netes schedule a pod?"),
], [
  { must: ["kubernetes"], garbled: ["kuber"], independent: true },
])
add("20 mishear kube netes", [
  u("Have you run kube netes in production?"),
], [
  { must: ["kubernetes"], garbled: ["kube netes"], independent: true },
])
add("21 mishear pee kay eye", [
  u("What is pee kay eye?"),
], [
  { must: ["pki"], garbled: ["pee kay"], independent: true },
])
add("22 mishear p k i", [
  u("How do you protect P K I keys?"),
], [
  { must: ["pki"], garbled: ["p k i"], independent: true },
])
add("23 mishear terra form", [
  u("What is terra form?"),
], [
  { must: ["terraform"], garbled: ["terra form"], independent: true },
])
add("24 mishear terror form", [
  u("Have you used terror form for infrastructure?"),
], [
  { must: ["terraform"], garbled: ["terror"], independent: true },
])
add("25 mishear start method", [
  u("Tell me about a time you used the start method."),
], [
  { must: ["star"], garbled: ["start method"], independent: true },
])
add("26 mishear s t a r method", [
  u("How do you structure an answer with the S T A R method?"),
], [
  { must: ["star"], garbled: ["s t a r"], independent: true },
])
add("27 compound design stays one question", [
  u("Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, data flow, failure isolation, rollout and validation."),
], [
  { must: ["splunk", "trust boundaries", "rollout"], independent: true },
])
add("28 compound define idor stays one", [
  u("Define IDOR, explain why it matters, and give one mitigation."),
], [
  { must: ["idor", "why it matters", "mitigation"], independent: true },
])
add("29 go deeper still follows", [
  u("Go deeper", 4000),
], [
  { must: ["nla", "deeper"], independent: false },
], prevNla)
add("30 explain that still follows", [
  u("Explain that", 4000),
], [
  { must: ["nla", "explain that"], independent: false },
], prevNla)
add("31 least privilege is not nla", [
  u("What exactly is least privilege?", 2000),
], [
  { must: ["least privilege"], ban: ["nla"], independent: true },
], prevNla)
add("32 residual risk is not nla", [
  u("What is the meaning of residual risk?", 1800),
], [
  { must: ["residual risk"], ban: ["nla"], independent: true },
], prevNla)
add("33 repeated question is still answered", [
  u("What is PKI?"),
  u("What is PKI?", 1400),
], [
  { must: ["pki"], independent: true },
])
add("34 thanks then the real question", [
  u("Thanks for the overview. What drove the move to Azure?"),
], [
  { must: ["azure"], independent: true },
])
add("35 one breath with uh between two questions", [
  u("Okay what is Kubernetes? And, uh, what is Terraform?"),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["terraform"], independent: true },
])
add("36 short gap mid sentence stays whole", [
  u("What is a policy exception"),
  u("and how is it different from a deviation?", 900),
], [
  { must: ["policy exception", "deviation"], independent: true },
])
add("37 quiet gap already separates two questions", [
  u("What is Kubernetes?"),
  u("What is Terraform?", 4500),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["terraform"], independent: true },
])
add("38 and why in the same breath", [
  u("What is PKI? And why?"),
], [
  { must: ["pki", "why"], independent: false },
])
add("39 mishear then another question", [
  u("What is cooper netties?"),
  u("What is terra form?", 1600),
], [
  { must: ["kubernetes"], garbled: ["cooper"], independent: true },
  { must: ["terraform"], garbled: ["terra form"], independent: true },
])
add("40 and why when the previous question already said why", [
  u("And why?", 4200),
], [
  { must: ["nla", "why"], independent: false },
], prevNla)
add("41 so um then the question", [
  u("So, um."),
  u("What is Terraform?", 2000),
], [
  { must: ["terraform"], independent: true },
])
add("42 walk me through that still follows", [
  u("Walk me through that", 4000),
], [
  { must: ["nla"], independent: false },
], prevNla)
add("43 cyberark epm is not the previous nla question", [
  u("Have you configured CyberArk EPM?", 2000),
], [
  { must: ["cyberark"], ban: ["nla"], independent: true },
], prevNla)
add("44 which of those still follows", [
  u("Which of those would you start with?", 4000),
], [
  { must: ["nla"], independent: false },
], prevNla)
add("45 three questions one breath", [
  u("What is Kubernetes? What is PKI? What is Terraform?"),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["pki"], independent: true },
  { must: ["terraform"], independent: true },
])
add("46 pause then a different question", [
  u("What is Kubernetes?"),
  u("What is Terraform?", 6000),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["terraform"], independent: true },
])
add("47 next question is not the previous one", [
  u("Moving to the next question, what exactly is least privilege?"),
], [
  { must: ["least privilege"], ban: ["nla"], independent: true },
], prevNla)
add("48 scenario stays with the how question", [
  u("A permission fix passes unit tests but fails for one tenant. How would you diagnose it?"),
], [
  { must: ["one tenant", "diagnose"], independent: true },
])
add("49 parallel how questions stay one assessment", [
  u("How do you assess the business impact? How do you understand root cause?"),
], [
  { must: ["business impact", "root cause"], independent: true },
])
add("50 how would you secure two different products", [
  u("How would you secure Kubernetes? How would you secure Terraform?"),
], [
  { must: ["kubernetes"], independent: true },
  { must: ["terraform"], independent: true },
])

function score(seq) {
  const cuts = replay(seq)
  const failures = []
  const independent = seq.asks.filter((a) => a.independent)
  let missed = 0, merged = 0, misheard = 0
  for (const ask of seq.asks) {
    const hits = cuts.filter((c) => covers(c, ask))
    if (!hits.length) { missed++; failures.push("missed " + ask.must.join("+") + " cuts=" + JSON.stringify(cuts)) }
    if (ask.ban && hits.some((c) => ask.ban.some((b) => hasTerm(c, b)))) { merged++; failures.push("answered as the previous question " + JSON.stringify(cuts)) }
    if (ask.garbled && (!hits.length || hits.some((c) => ask.garbled.some((g) => garbledLeft(c, g))))) { misheard++; failures.push("misheard " + JSON.stringify(cuts)) }
  }
  for (const cut of cuts) {
    const ids = independent.filter((a) => covers(cut, a))
    if (ids.length > 1) { merged += ids.length; failures.push("merged " + ids.map((a) => a.must[0]).join(" & ") + " in " + JSON.stringify(cut)) }
  }
  return { missed, merged, misheard, failures }
}

test("fifty interview sequences are heard, cut and kept apart", () => {
  let missed = 0, merged = 0, misheard = 0, asks = 0, mishearAsks = 0
  const failures = []
  assert.equal(S.length >= 40, true, "need at least 40 sequences")
  for (const seq of S) {
    const result = score(seq)
    missed += result.missed
    merged += result.merged
    misheard += result.misheard
    asks += seq.asks.length
    mishearAsks += seq.asks.filter((a) => a.garbled).length
    for (const failure of result.failures) failures.push(seq.id + " " + failure)
  }
  assert.equal(asks, 66)
  assert.equal(mishearAsks, 11)
  assert.deepEqual({ missed, merged, misheard, failures }, { missed: 0, merged: 0, misheard: 0, failures: [] })
})

test("a multi-part question stays one question, and two subjects do not", () => {
  assert.equal(splitDistinctAsks("Design Splunk and Sentinel ingestion with identity correlation. Explain trust boundaries, data flow, failure isolation, rollout and validation.").length, 1)
  assert.equal(splitDistinctAsks("How do you assess the business impact? How do you understand root cause?").length, 1)
  assert.equal(splitDistinctAsks("Define IDOR, explain why it matters, and give one mitigation.").length, 1)
  assert.deepEqual(splitDistinctAsks("What is Kubernetes? What is Terraform?"), ["What is Kubernetes?", "What is Terraform?"])
  assert.deepEqual(splitDistinctAsks("What is NLA and why do we disable it? Go deeper on that exception."), ["What is NLA and why do we disable it?", "Go deeper on that exception."])
  assert.equal(splitDistinctAsks("What is NLA and why do we disable it? Go deeper.").length, 1)
  assert.equal(clauseStillOpen("How would you design a PKI"), true)
  assert.equal(clauseStillOpen("How would you design a PKI for a bank that already runs Venafi?"), false)
})

test("the desktop page splits and holds the same way", () => {
  const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
  const a = src.indexOf("const PHRASE_FIXES")
  const b = src.indexOf("function fixTerms", a)
  const c = src.indexOf("function shortFollowUp(")
  const d = src.indexOf("const armsAuto", c)
  assert.ok(a > 0 && b > a && c > 0 && d > c)
  const ctx = {}
  vm.createContext(ctx)
  vm.runInContext(src.slice(a, b) + "\n" + src.slice(c, d) + "\nthis.splitDistinctAsks=splitDistinctAsks; this.clauseStillOpen=clauseStillOpen; this.repeatsPriorQuestion=repeatsPriorQuestion;", ctx)
  for (const seq of S) {
    const joined = seq.utts.map((part) => part.text).join(" ")
    assert.equal(JSON.stringify(ctx.splitDistinctAsks(joined)), JSON.stringify(splitDistinctAsks(joined)), seq.id)
  }
  assert.equal(ctx.clauseStillOpen("How would you design a PKI"), true)
  assert.equal(JSON.stringify(ctx.splitDistinctAsks("What is NLA and why do we disable it? Go deeper on that exception.")), JSON.stringify(["What is NLA and why do we disable it?", "Go deeper on that exception."]))
  assert.equal(ctx.splitDistinctAsks("What is NLA and why do we disable it? Go deeper.").length, 1)
  assert.equal(ctx.repeatsPriorQuestion("And why?", "What is NLA and why do we disable it?"), false)
  assert.equal(ctx.repeatsPriorQuestion("Go deeper", "What is NLA and why do we disable it?"), false)
  assert.equal(shortFollowUp("Go deeper"), true)
  assert.equal(shortFollowUp("Explain that"), true)
  assert.equal(shortFollowUp("What exactly is least privilege?"), false)
  assert.equal(ctx.repeatsPriorQuestion("What is PKI?", "What is PKI?"), true)
  assert.match(src, /clauseStillOpen\(tail\) \? 7000 : AUTO_QUIET_MS/)
  assert.match(src, /spans.length > 1/)
})
