// Owner rule (Eshwar, 29 Oct 2026, 11:26 PM CT): Kompas does not answer personal logistics (visa / work authorization,
// citizenship, salary / pay / rate, relocation, address, current location, start date, notice period, availability).
// Only resume content may be personal. Ambiguous or technical text fails open: it is never suppressed.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { personalLogistics, withoutLogistics } from "../../src/lib/kompasRelevance.ts"

const LOGISTICS = [
  "Salary?", "U.S. citizen?", "H-1B?", "Visa?", "What is your expected salary?", "What are your salary expectations?",
  "What's your hourly rate?", "What is your pay range?", "Do you need sponsorship?", "Do you require visa sponsorship?",
  "Are you authorized to work in the US?", "Are you a U.S. citizen?", "What is your visa status?", "Are you on a green card?",
  "Are you open to relocation?", "Would you relocate to Dallas?", "Where are you located?", "Where are you based?",
  "Where do you live?", "What's your current location?", "What is your home address?", "When can you start?",
  "And when can you start?", "How soon can you start?", "What is your notice period?", "Do you have to give two weeks notice?",
  "What is your availability?", "What's your earliest start date?", "What is your current compensation?", "What's your expected CTC?",
]
const NOT_LOGISTICS = [
  "Tell me about yourself.", "Where did you work before Citi?", "What was your start date at Citi?", "When did you start at CVS?",
  "How do you design for high availability?", "Explain the IP address allocation in your VPC design.", "What is the error rate you saw?",
  "How did you address the audit finding?", "Tell me about your security clearance work at DOE.", "How does rate limiting work?",
  "What did the team pay attention to during the CyberArk rollout?", "How did you handle availability zones in AWS?",
  "Walk me through how you would build the start date validation in the HR feed.", "What is CyberArk PAM?", "Go deeper.", "Notice anything odd in the logs?", "Have you built citizen developer apps?",
  "Can you relocate the service to us-east?", "What start date field does Workday use?",
]

test("pure logistics asks are recognised (owner list only)", () => {
  for (const q of LOGISTICS) assert.equal(personalLogistics(q), true, q)
})
test("technical, resume-derived and ambiguous asks fail open", () => {
  for (const q of NOT_LOGISTICS) assert.equal(personalLogistics(q), false, q)
})
// Chief (29 Oct 2026, 11:49 PM CT): relocation and current location fail closed, even behind why/how/tell me.
const FAIL_CLOSED = [
  "Why are you relocating?", "Why are you relocating to Chicago?", "Why do you want to relocate?", "Tell me about your relocation plans.",
  "How do you feel about relocating?", "Why did you relocate to Dallas?", "Where are you located?", "Where are you currently located?",
  "Tell me where you are located.", "Why are you based in Chicago?", "What is your current location?",
]
const STILL_TECHNICAL = [
  "Tell me about the data center relocation.", "How did you relocate the Vault servers?", "Explain how you would relocate workloads to AWS.",
  "Why did the team relocate the PSM servers?", "Where is the Vault located?", "How do you track a user's current location in the app?",
  "Where did you work before Citi?", "Tell me about yourself.", "How does rate limiting work?", "Explain the IP address allocation in your VPC design.",
  "Why are you relocating, and how did you roll out CyberArk?".replace(", and", " and"),
]
test("relocation and current location fail closed (Chief decision)", () => {
  for (const q of FAIL_CLOSED) assert.equal(personalLogistics(q), true, q)
})
test("technical relocation/location wording and resume history stay open", () => {
  for (const q of STILL_TECHNICAL.slice(0, -1)) assert.equal(personalLogistics(q), false, q)
  assert.equal(withoutLogistics(STILL_TECHNICAL.at(-1)), "how did you roll out CyberArk?")
})
test("a pure logistics ask reduces to nothing", () => {
  for (const q of ["Salary?", "And when can you start?", "Where are you located?"]) assert.equal(withoutLogistics(q), "", q)
})
test("compound: only the logistics part is dropped, every other word kept verbatim", () => {
  assert.equal(withoutLogistics("What is your visa status and tell me about PAM."), "tell me about PAM.")
  assert.equal(withoutLogistics("Are you open to relocation and how did you roll out CyberArk?"), "how did you roll out CyberArk?")
  assert.equal(withoutLogistics("Tell me about your SIEM tuning, and also what is your notice period?"), "Tell me about your SIEM tuning")
  assert.equal(withoutLogistics("um so what is your experience with okta and um what is your notice period"), "um so what is your experience with okta")
})
test("an unsplit compound fails open: the technical part is never lost", () => {
  for (const q of ["What is your experience with Okta and your notice period?", "Your visa status and how you rotated CyberArk passwords?"]) {
    assert.equal(personalLogistics(q), false, q); assert.ok(withoutLogistics(q).length > 0, q)
  }
})
test("non-logistics text is returned unchanged, byte for byte", () => {
  for (const q of NOT_LOGISTICS.concat(["Tell me about IAM and how you rolled out SailPoint.", ""])) assert.equal(withoutLogistics(q), q, q)
})
test("the answer service skips logistics before any model call, and says so", () => {
  const s = readFileSync("src/lib/kompasAnswerService.ts", "utf8")
  const at = s.indexOf("let question = latestInterviewerAsk(")
  const guard = s.indexOf("withoutLogistics(", at), quiet = s.indexOf("const quiet =", at), model = s.indexOf("rediscoverRelevance(originalTurnAsk", at)
  assert.ok(at > 0 && guard > at && guard < quiet && quiet < model, "guard sits between the question and the quiet reply")
  assert.match(s.slice(quiet, quiet + 300), /skipped/, "the quiet reply names the reason so the page can show a quiet card")
  assert.match(s.slice(at, model), /originalTurnAsk = [^\n]*withoutLogistics\(/, "the whole-turn ask sent to the prompt is cleaned too")
})
test("the page shows a quiet one-line card for a skipped logistics ask, with no answer text", () => {
  const app = readFileSync("public/kompas/app.js", "utf8")
  const i = app.indexOf("if (meta.noQuestion) {")
  assert.ok(i > 0)
  const branch = app.slice(i, app.indexOf("return;", i))
  assert.match(branch, /meta\.skipped === "logistics"[^\n]*Personal logistics, not answered/)
  assert.match(branch, /status\(meta\.skipped === "logistics" \? "Personal logistics, not answered\./)
  assert.match(branch, /card\.answer = keepOld \? prevAnswer : \[\]/, "no answer text is written")
})
