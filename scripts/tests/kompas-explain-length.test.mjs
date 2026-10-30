// Explain-length (30 Oct 2026, OFFLINE): Eshwar, live 8:50 AM CT: "the answers go short hand even though the question
// clearly says explain your experiences". "Explain / describe / walk me through / tell me about your experience with X"
// fell through interviewIntent to "direct", so the dissected band (the last word on spoken length in
// kompasAnswerService) capped it at the 44/66/99-word direct ceiling. Those asks now take the personal-experience band
// (the full STAR budget per mode); short, yes/no and explicitly brief asks keep their short bands.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { dissectQuestion, dissectionPrompt, relativeGap } from "../../src/lib/kompasDissection.ts"
import { interviewIntent, focusPlan } from "../../src/lib/kompasRelevance.ts"

const EXPLAIN = [
  "Can you explain your experience with threat modeling?",
  "Explain your experience with SIEM tuning",
  "Walk me through your experience with cloud security",
  "Describe your experience leading a security team",
  "Tell me about your experience with incident response",
  "Could you talk me through your background in vulnerability management?",
  "Can you tell me a bit about your hands-on experience with Splunk?",
]
const SHORT = [
  ["What is your biggest strength?", "direct"],
  ["Do you use Splunk?", "direct"],
  ["Do you have experience with CyberArk?", "direct"],
  ["Briefly describe your experience with threat modeling.", "direct"],
  ["In one sentence, explain your experience with SIEM tuning.", "direct"],
]
const CONTROLS = [
  ["How would you explain residual risk to a business owner?", "definition"],
  ["Explain how SAML works", "technical-process"],
  ["Describe a project where you reduced alert noise.", "experience-story"],
  ["What is the difference between IDS and IPS?", "comparison"],
]

for (const q of EXPLAIN) {
  test(`explain-your-experience gets the full experience band: ${q}`, () => {
    const cut = dissectQuestion(q)
    assert.equal(cut.intent, "experience-story")
    assert.equal(cut.shape, "personal-experience")
    assert.ok(cut.modes.engineer.targetWords >= 100, `engineer ${cut.modes.engineer.targetWords}`)
    assert.ok(cut.modes.director.targetWords >= 150, `director ${cut.modes.director.targetWords}`)
    assert.ok(cut.modes.architect.targetWords >= 220, `architect ${cut.modes.architect.targetWords}`)
    const f = focusPlan(q, 2, "engineer")
    assert.ok(f.maxWords >= 170, `focus ceiling ${f.maxWords}`)
  })
}

test("the three modes still differ by at least 50% on an explain-your-experience ask", () => {
  const m = dissectQuestion(EXPLAIN[0]).modes
  assert.ok(relativeGap(m.engineer.targetWords, m.director.targetWords) >= 0.5)
  assert.ok(relativeGap(m.director.targetWords, m.architect.targetWords) >= 0.5)
  assert.ok(relativeGap(m.engineer.targetWords, m.architect.targetWords) >= 0.5)
})

test("the first sentence still opens on the interviewer's keywords (narrowed, not generic)", () => {
  const cut = dissectQuestion("Explain your experience with SIEM tuning")
  assert.ok(cut.keywords.includes("SIEM") && cut.keywords.includes("tuning"), cut.keywords.join(","))
  const p = dissectionPrompt("Explain your experience with SIEM tuning", "engineer")
  assert.match(p, /own words: [^\n]*SIEM[^\n]*tuning/)
  assert.match(p, /Shape: personal-experience/)
})

for (const [q, intent] of SHORT) {
  test(`short, yes/no or brief ask stays short: ${q}`, () => {
    const cut = dissectQuestion(q)
    assert.notEqual(cut.intent, "experience-story", `was ${intent} before the fix`)
    assert.ok(cut.modes.engineer.targetWords <= 44, `engineer ${cut.modes.engineer.targetWords}`)
  })
}

for (const [q, intent] of CONTROLS) {
  test(`unchanged control: ${q} -> ${intent}`, () => assert.equal(interviewIntent(q), intent))
}

test("the dissected band is still what sets the spoken length in the answer service", () => {
  const svc = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  assert.match(svc, /plan\.words = briefIntro \? [^\n]*: band\.targetWords/)
})

// Near-miss and honesty controls: the longer band must never cost the honest "not in your sources" line.
import { draftSpokenAnswer } from "../../src/lib/kompasDissection.ts"
const HIT = `# Sam Example
## Experience
### GRC Analyst — Hitachi Vantara — 2021 to 2024
- Mapped 300 controls to NIST 800-53 for the FedRAMP Moderate package.
- Ran quarterly access reviews for 40 applications with the control owners.
`
test("a bare 'walk me through your background' stays an introduction", () => {
  assert.equal(interviewIntent("Walk me through your background."), "introduction")
})
for (const q of ["Tell me about your experience at Google.", "Tell me about your experience with incident response at Google."]) {
  test(`employer the resume lacks keeps the honest line: ${q}`, () => {
    assert.match(draftSpokenAnswer(q, "director", HIT), /does not show/)
  })
}
test("a longer band invents no figure the sources lack", () => {
  for (const level of ["engineer", "architect", "director"]) {
    const a = draftSpokenAnswer("Explain your experience with access reviews", level, HIT)
    for (const n of a.match(/\b\d[\d,.]*\b/g) || []) assert.ok(/\b(300|40|800-53|2021|2024)\b/.test(n) || HIT.includes(n), `${level} invented ${n}: ${a}`)
  }
})
