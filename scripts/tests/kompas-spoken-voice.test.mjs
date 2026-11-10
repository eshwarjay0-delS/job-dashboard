// Spoken voice is a pass over the answer, not another model call.
// Style fixtures follow openers counted in the 20 dossiers and the recovered M4A
// deep-dives (So, Then, That, What I, Where) and Lens's two example answers.
import test from "node:test"
import assert from "node:assert/strict"
import { spokenVoice, CARRY_STARTERS, VOICE_RULES } from "../../src/lib/kompasSpokenVoice.ts"
import { SIGN_OFF_LINE } from "../../src/lib/kompasSheetMatch.ts"

const BANNED = /\b(?:in conclusion|furthermore|moreover|additionally|it is important to note|leverag\w*|utiliz\w*|robust)\b/i
const LENS = [
  "I'd make the controls part of the pipeline itself, so a developer can't ship without passing them. So the scans and policy checks run as required gates, and the people who write code don't own the permissions that could switch those gates off. That second part is where it usually breaks. At Citi a lot of my IAM review was asking who can actually change a control, not just whether the control exists. If someone needs an exception, it goes through a tracked approval with evidence, the way we tracked mitigation in ServiceNow GRC and Jira, so a bypass is visible rather than quiet. And then I check the pipeline's own service identity, because an over-permissioned pipeline account is a bypass that nobody files a ticket for.",
  "I'd test the API directly as each role, because the UI hiding a button proves nothing about whether the request is refused. So I build a small matrix of roles against actions, then send each call with that role's token, not through the screen. Where it usually breaks is the gap between the two: the page says no, the endpoint says yes. That's the same thing I looked for in Citi's IAM and database-access reviews. A control on paper isn't a control until effective access matches it. Any mismatch becomes a finding with evidence and an owner, and I retest after the fix instead of trusting the ticket closed.",
]
const LPL = [
  ["Can you explain the difference between authentication, authorization, and access control?", "Authentication checks who you are. Furthermore, authorization decides what you can open. Moreover, access control is the robust mechanism we leverage."],
  ["How would you test whether authorization is enforced consistently across both UI and API layers?", "I'd test authorization on the API as each role, because a hidden button proves nothing. Additionally, it is important to note we utilize a robust proxy. In conclusion, I retest the endpoint."],
  ["How would you implement security controls in a CI/CD pipeline without allowing developers to bypass them?", "So imagine you're sitting there watching the pipeline. I'd put the security checks in the pipeline so a developer can't skip them. Furthermore, we leverage a robust gate. Moreover, the pipeline identity is separate."],
  ["How would you handle a manual security scanner outage without unnecessarily stopping every software deployment?", "First I would separate a dead scanner from a failed scan. Then I would let a low-risk change through on the last good result. Additionally, we utilize a robust exception."],
  ["How would you identify malicious or compromised third-party packages entering the CI pipeline?", "I'd check the packages' signatures before the pipeline accepts them. Furthermore, a mismatched hash gets quarantined. Moreover, we leverage a robust allowlist."],
  ["How would you monitor suspicious package activity and coordinate incident response?", "I'd block the package and tell the appsec owner. Additionally, the alert goes to the SIEM. In conclusion, it is important to note the handoff."],
  ["Let's say a critical vulnerability is reported in a shared Java library and that library is used by 150 applications. How would you determine which applications are affected and prioritize remediation?", "I'd inventory which applications actually load that Java library. Furthermore, internet-facing ones go first. Moreover, we leverage a robust ticket."],
  ["Security identifies a critical vulnerability, but the development team disputes the finding. How would you organize the technical review so that both teams can agree on the outcome?", "I'd put both teams on the same finding before anyone argues the severity. Additionally, we utilize a robust repro. In conclusion, the owner and the date get written down."],
]
const CLOSE = "That is going to be it for the questions. I appreciate our conversation. Thank you for taking the time out of your day to speak to me. I will speak to your editor and we will get back to you regarding the next steps."

function sentences(text) {
  return text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean)
}
function startersUsed(text) {
  const found = []
  for (const sentence of sentences(text).slice(1)) {
    const hit = CARRY_STARTERS.filter((s) => sentence.toLowerCase().startsWith(s.toLowerCase())).sort((a, b) => b.length - a.length)[0]
    if (hit) found.push(hit.toLowerCase())
  }
  return found
}

test("the prompt bank is the carry-over list, and Entra at Citi is refused", () => {
  assert.match(VOICE_RULES, /So the first thing I'd/)
  assert.match(VOICE_RULES, /Where it usually breaks is/)
  assert.match(VOICE_RULES, /Never write In conclusion/)
  assert.ok(CARRY_STARTERS.length >= 8)
})

test("Lens examples are the target shape, and unsourced names come out", () => {
  assert.match(LENS[0], /^I'd make the controls part of the pipeline/)
  assert.match(LENS[1], /^I'd test the API directly/)
  for (const sample of LENS) assert.doesNotMatch(sample, BANNED)
  const cleaned = spokenVoice(LENS[0], "How would you implement security controls in a CI/CD pipeline without allowing developers to bypass them?", "")
  assert.match(cleaned, /pipeline/i)
  assert.doesNotMatch(cleaned, /\bCiti\b/)
  assert.doesNotMatch(cleaned, /Entra/)
  assert.doesNotMatch(cleaned, /ServiceNow/)
  assert.doesNotMatch(cleaned, BANNED)
})

test("ten transcript-style answers stay on the question and drop the stiff words", () => {
  const extra = [
    ["How do you onboard a new syslog source?", "So the rule is I confirm the syslog source before it lands in the SIEM. Furthermore, we leverage a robust parser. Moreover, I watch the first alerts."],
    ["What is least privilege?", "Least privilege means the account gets only the access the job needs. Additionally, it is important to note we utilize robust standing access. In conclusion, extra rights expire."],
  ]
  const cases = [...LPL, ...extra]
  assert.equal(cases.length, 10)
  for (const [question, stiff] of cases) {
    const topic = question.match(/\b(?:authentication|authorization|API|pipeline|scanner|packages?|Java|finding|syslog|privilege)\b/i)
    const out = spokenVoice(stiff, question, "IAM analyst. Splunk SIEM. SAST and DAST.")
    const lines = sentences(out)
    assert.ok(lines.length >= 2, question)
    assert.match(lines[0], new RegExp(topic[0], "i"), question + " first sentence: " + lines[0])
    assert.doesNotMatch(lines[0], /^(?:so|then|furthermore|in conclusion)\b/i)
    assert.doesNotMatch(out, BANNED)
    assert.doesNotMatch(out, /Microsoft Entra|at Citi/i)
    const used = startersUsed(out)
    assert.equal(new Set(used).size, used.length, "repeated starter in " + out)
    assert.ok(used.length >= 1, out)
    const long = lines.filter((s) => s.split(/\s+/).length > 28)
    assert.equal(long.length, 0, long.join(" | "))
  }
})

test("a closing pleasantry stays a thank-you", () => {
  const out = spokenVoice("Furthermore, we leverage the SIEM and a robust control at Citi.", CLOSE, "")
  assert.equal(out, SIGN_OFF_LINE)
  assert.doesNotMatch(out, /SIEM|Citi|Furthermore/)
})
