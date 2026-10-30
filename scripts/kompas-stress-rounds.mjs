#!/usr/bin/env node
/**
 * Offline Kompas stress rounds (29 Oct 2026). CODE-LEVEL ONLY: no model, no network, no token. The answers here come from
 * draftSpokenAnswer (the offline stand-in) and the real server code that every live answer passes through (question
 * intake, dissection, settle, number guard, provider-error refusal). Passing here is NOT live answer quality.
 *
 *   node scripts/kompas-stress-rounds.mjs            all rounds
 *   node scripts/kompas-stress-rounds.mjs 2          one round
 *
 * Each round adds harder adversarial families. One case is one check; an answer case is judged at all three modes.
 */
import { readFileSync } from "node:fs"
import {
  draftSpokenAnswer, dissectQuestion, evaluateLiveAnswers, settleSpokenAnswer, sameAnswerRatio, sentencesOf,
  isProviderErrorAnswer, questionKeywords, wordCount, answerEchoesPrevious, firstPersonRewrite, askedPartList,
} from "../src/lib/kompasDissection.ts"
import { deriveByCode, questionForAnswer } from "../src/lib/kompasAnswer.ts"
import { applyGuards } from "../src/lib/kompasGuards.ts"

export const RESUME = readFileSync(new URL("../tests/fixtures/kompas-sample-resume.md", import.meta.url), "utf8")
const LEVELS = ["engineer", "director", "architect"]
const HITACHI = JSON.parse(readFileSync(new URL("./fixtures/kompas-evaluation/interview-50.json", import.meta.url), "utf8"))
  .filter((x) => x.chain === "hitachi-grc").sort((a, b) => a.step - b.step).map((x) => x.question)

const A = (family, q, extra = {}) => ({ kind: "answer", family, q, ...extra })

// ------------------------------------------------------------------ round 1: the ordinary interview
const R1 = [
  ...["What is residual risk?", "Define least privilege.", "What does a compensating control mean?", "What is a policy exception?",
    "What is root cause analysis?", "What does privileged access mean?", "What is business impact?", "What is an access review?"].map((q) => A("definition", q, { shapes: ["definition"] })),
  ...["What is the difference between a policy deviation and a policy exception?", "Compare residual risk and inherent risk.",
    "Access review versus access recertification: which do you run first?", "How do preventive and detective controls differ?",
    "What is the difference between a finding and an exception?", "Compare remediation and risk acceptance."].map((q) => A("comparison", q, { shapes: ["comparison"] })),
  ...["Tell me about a time you challenged a weak remediation plan.", "Tell me about a time you sent evidence back to an owner.",
    "Give me an example of when you questioned an exception request.", "Describe a situation where a fix did not hold.",
    "Tell me about a time you explained risk to the business.", "Have you ever trained a new analyst?"].map((q) => A("behavioral", q, { shapes: ["personal-experience"] })),
  ...["How do you assess business impact and residual risk?", "Explain how a finding moves from open to closed.",
    "How do you validate that a fix is still in place?", "Walk me through how you map controls to an audit checklist.",
    "How does an access review work step by step?", "Explain how you confirm evidence matches the live setting."].map((q) => A("process", q)),
  ...["Are you able to work on site three days a week?", "Are you open to hybrid work?", "When can you start?",
    "Do you need visa sponsorship?", "Are you willing to travel?", "Where are you based?"].map((q) => A("logistics", q, { shapes: ["logistics"] })),
  A("intro", "Tell me about yourself.", { shapes: ["intro"] }), A("intro", "Give me a brief overview of your background.", { shapes: ["intro"] }),
  A("value", "Why are you interested in this role?", { shapes: ["value"] }), A("value", "What would you bring to this team?", { shapes: ["value"] }),
  A("closing", "Do you have any questions for us?", { shapes: ["closing"] }), A("closing", "What questions do you have for me?", { shapes: ["closing"] }),
  { kind: "nearDup", family: "near-duplicate", a: "What is residual risk?", b: "How do you report residual risk to the business?" },
  { kind: "nearDup", family: "near-duplicate", a: "What is a policy exception?", b: "When would you reject a policy exception?" },
  { kind: "nearDup", family: "near-duplicate", a: "How do you track open findings?", b: "How do you close open findings?" },
  ...HITACHI.map((q, i) => A("hitachi-grc", q, { history: HITACHI.slice(0, i) })),
  A("code", "Write a Python function that returns the findings still open after 30 days.", { code: true }),
  A("code", "Write a SQL query that lists findings with no owner.", { code: true }),
  A("multi-part", "How do you assess business impact, who owns the decision, and what do you track afterwards?"),
  A("multi-part", "Explain residual risk, compensating controls and exception expiry."),
]

// ------------------------------------------------------------------ round 2: tricks, small talk, jargon bait, garbled speech
const SMALL_TALK = ["yeah that's a tough one", "makes sense", "great, thanks", "let's dive in", "that's interesting",
  "hmm, fair enough", "good, good", "I see what you mean", "alright, let me pull up my notes", "nice, I like that answer",
  "perfect, that's helpful", "give me one second", "interesting point", "sorry, my dog is barking", "the weather has been crazy here lately"]
const R2 = [
  ...["What is your biggest weakness?", "Why should we not hire you?", "Is one hundred percent security possible?",
    "What did you dislike about your last manager?", "Why do you want to leave your current job?", "What is your salary expectation?",
    "Since you led the SOC at a large bank, how big was your team?", "Would you bypass a control if the CEO asked you to?"].map((q) => A("trick", q)),
  ...SMALL_TALK.map((heard) => ({ kind: "smalltalk", family: "small-talk (idea E)", heard })),
  ...["um", "uh huh", "mm-hmm", "mhm", "oh", "I see"].map((heard) => ({ kind: "smalltalk", family: "backchannel noise", heard })),
  ...["How do you keep user accounts safe?", "How do you stop attackers moving around the network?", "How do you check who has admin rights?",
    "How do you make sure logs are useful?", "How do you protect passwords?", "How do you handle a suspicious login?"].map((q) => A("jargon-bait", q)),
  ...[["um so like what's the uh resid jewel risk thing", "definition"], ["uh what is uh least privilege", "definition"],
    ["so um can you tell me about a time you you challenged a weak remediation plan", "personal-experience"],
    ["what's the difference between a policy deviation and and a policy exception you know", "comparison"],
    ["what's residual risk mean to you", "definition"], ["define compensating uh control", "definition"],
    ["how do you assess business in pact", null], ["tell me about uh yourself", "intro"],
    ["are you able to work on site like three days a week", "logistics"]].map(([q, shape]) => A("garbled", q, { shapes: shape ? [shape] : null, garbled: true })),
  ...["Hi, can you hear me okay?", "How are you doing today?", "Thanks for joining, shall we get started?"].map((q) => A("greeting", q, { shapes: ["logistics", "acknowledgement"] })),
]

// ------------------------------------------------------------------ round 3: very short, very long, follow-ups, provider errors, numbers
const LONG = "So we have a pretty big environment, lots of business units, some of them still on old systems, and the audit team keeps coming back with findings that were supposedly closed months ago, and honestly the owners are tired, they feel like security keeps moving the goalposts, and leadership wants a clean report before the next board meeting, so with all of that in mind, how would you decide which findings to reopen first and how would you explain that decision to the owners without losing them?"
const R3 = [
  ...["SOC 2?", "IAM?", "Residual risk?", "Why?", "Exceptions?", "Least privilege."].map((q) => A("very-short", q)),
  A("very-long", LONG), A("very-long", `${LONG} Also, what would you track to show it worked?`),
  A("very-long", "Okay so before we move on I want to understand your approach, because we had a contractor last year who closed everything on paper and nothing was actually fixed, the evidence was screenshots from months earlier, nobody checked the live setting, and when the auditors came back it was a mess, so tell me about a time you compared the evidence in a ticket with the live setting before you signed off."),
  ...[["Write a Python function that returns the findings still open after 30 days.", "Can you also add unit tests?", "tests"],
    ["Design multi-cloud controls mapped to NIST 800-53.", "What would you monitor?", "monitor"],
    ["Tell me about a time you challenged a weak remediation plan.", "What would you do differently?", "differently"],
    ["Write a SQL query that lists findings with no owner.", "Could you add an index for it?", "index"],
    ["How do you assess business impact and residual risk?", "How would you test that?", "test"],
    ["Explain how a finding moves from open to closed.", "And what about exceptions?", "exceptions"]].map(([first, follow, keyword]) => ({ kind: "followup", family: "follow-up (idea D)", first, follow, keyword })),
  ...["openrouter 429 try again in 2000ms", "Error: Request failed with status code 429", "upstream connect error or disconnect/reset before headers",
    "502 Bad Gateway", "Rate limit exceeded for model openai/gpt-5. Please retry later.", "{\"error\":{\"message\":\"Insufficient credits\",\"code\":402}}",
    "The model is currently overloaded with other requests.", "Internal Server Error", "This model's maximum context length is 128000 tokens.",
    "I'm sorry, but I can't help with that request."].map((raw) => ({ kind: "provider", family: "provider-error", raw })),
  ...["I would add rate limiting to the login API so a burst of failures is slowed down.",
    "If the upstream service returns an error, I fail closed and alert the owner.",
    "Service availability matters, so I schedule the change outside business hours."].map((raw) => ({ kind: "notProvider", family: "provider-error (legit)", raw })),
  ...[["I reduced incidents by 40% within a quarter.", true], ["I cut review time by 50% per audit cycle.", true],
    ["I handled over 200 findings every quarter.", true], ["I closed 95 percent of findings at least a month early.", true],
    ["I led a team of 12 analysts.", true], ["I improved patch compliance to 98%.", true],
    ["I would alert when failures exceed 5 per minute.", false], ["I set the threshold at 3 failed logins.", false],
    ["Hypothesis 1 held, so step 2 ran first.", false]].map(([sentence, invented]) => ({ kind: "numbers", family: "invented-number", sentence, invented })),
]

// ------------------------------------------------------------------ round 4: harder mixes and live-output settling
const R4 = [
  { kind: "nearDup", family: "near-duplicate (negation)", a: "When would you accept residual risk?", b: "When would you not accept residual risk?" },
  { kind: "nearDup", family: "near-duplicate (audience)", a: "Explain residual risk to an engineer.", b: "Explain residual risk to a director." },
  { kind: "nearDup", family: "near-duplicate (verb)", a: "How do you open a finding?", b: "How do you close a finding?" },
  { kind: "nearDup", family: "near-duplicate (no resume match)", a: "How do you secure Kubernetes clusters?", b: "How do you secure a CI pipeline?" },
  { kind: "nearDup", family: "near-duplicate (no resume match)", a: "What is zero trust?", b: "What is SASE?" },
  { kind: "nearDup", family: "near-duplicate (no resume match)", a: "How many years of experience do you have?", b: "Why do you want to leave your current job?" },
  ...["um so explain residual risk, compensating controls and uh exception expiry", "what's the difference between like inherent and residual risk and which one do you report",
    "tell me about a time you you challenged a remediation plan and what happened after"].map((q) => A("garbled multi-part", q, { garbled: true })),
  ...[["What does residual risk mean?", "## Answer\nResidual risk is the risk left after the planned control is in place."],
    ["What does residual risk mean?", "**Residual risk** is the risk left after the control is in place. I tracked it on open findings."],
    ["What does residual risk mean?", "Jordan tracked residual risk on open findings. He told the business what remained."],
    ["What does residual risk mean?", "Answer: Residual risk is what remains after the control is in place."]].map(([q, raw]) => ({ kind: "settle", family: "live-output speakable", q, raw })),
  ...[["How do you report residual risk to the business?", "I tracked residual risk on open findings and told the business what remained after the planned control was in place. I wrote the weekly risk summary in plain language."],
    ["When would you reject a policy exception?", "I questioned exception requests that had no end date and sent them back for an expiry. I compared the evidence with the live setting."]].map(([q, raw]) => ({ kind: "repeat", family: "repeat of previous answer (full)", q, raw, previous: raw, full: true })),
  ...[["When would you reject a policy exception?", "I reject an exception that has no end date and no compensating control. I tracked residual risk on open findings and told the business what remained after the planned control was in place.", "I tracked residual risk on open findings and told the business what remained after the planned control was in place. I wrote the weekly risk summary in plain language."],
    ["How do you close a finding?", "I compared the evidence in each ticket with the live setting before I signed off. I close a finding only when the live setting matches the fix and the owner confirms it.", "I compared the evidence in each ticket with the live setting before I signed off. I sent weak plans back to the owner."]].map(([q, raw, previous]) => ({ kind: "repeat", family: "repeat of previous answer (partial)", q, raw, previous })),
  ...["What is residual risk?", "Tell me about a time you challenged a weak remediation plan.", "How do you assess business impact and residual risk?",
    "Explain how a finding moves from open to closed.", "Compare remediation and risk acceptance.", "What would you bring to this team?",
    "Tell me about yourself.", "Do you have any questions for us?", "Go deeper on that.", "Why is that important?"].map((q) => A("mode separation", q)),
  ...["What is zero trust?", "How do you secure Kubernetes clusters?", "Explain OAuth to a recruiter.", "What is SASE?", "How would you run a phishing simulation?",
    "How do you handle a ransomware incident?", "What is a SIEM?", "What's your experience with cloud security?", "How do you prioritize vulnerabilities?",
    "What is threat modeling?", "Explain encryption at rest.", "How would you build a security awareness program?"].map((q) => A("off-resume", q)),
]
// ------------------------------------------------------------------ round 5: the hardest mixes, judged on the production paths
const LONG_GARBLED = "okay so um we've got like three things going on, the audit team wants um evidence for the access reviews, the owners say the the fixes are done, and leadership wants a date, so uh how would you decide what to check first, who signs off, and what you would tell leadership this week"
const R5 = [
  // Off-topic speech around one real ask: the ask is kept, the chatter is not.
  ...[["sorry, my kid just walked in. Anyway, how do you scope an access review?", "scope an access review", "kid"],
    ["The coffee here is terrible, honestly. So, what does a compensating control mean?", "compensating control", "coffee"],
    ["We use a lot of spreadsheets, it's a mess. How would you track exceptions?", "track exceptions", "spreadsheets"],
    ["Our last candidate talked for twenty minutes. Keep it short: what is least privilege?", "least privilege", "candidate"]].map(([heard, want, drop]) => ({ kind: "intake", family: "off-topic speech around an ask", heard, want, drop })),
  // Interviewer statements with no ask: never a question.
  ...["So our team is about twelve people and we mostly do SOX work.", "We're hoping to fill this role by the end of the quarter.",
    "I'll be sharing your notes with the hiring manager afterwards."].map((heard) => ({ kind: "statement", family: "off-topic statement (no ask)", heard })),
  // Keyword traps on the production prompt: premise, audience, negation, filler and the follow-up tag never become keywords.
  ...[["Since you led the SOC at a large bank, how did you report risk?", ["report", "risk"], ["led", "large", "bank"]],
    ["Given that you ran the audit program, what would you change first?", ["change"], ["audit", "program"]],
    ["Explain residual risk to an engineer.", ["residual risk"], ["engineer"]],
    ["When would you never accept a policy exception?", ["not accept", "policy exception"], []],
    ["um so like how do you you scope an access review you know", ["scope", "access", "review"], ["um", "like", "know"]],
    ["What about expiry dates — following up on: \"How do you track exceptions\"?", ["expiry"], ["following"]]].map(([q, must, never]) => ({ kind: "keywords", family: "keyword trap", q, must, never })),
  // Follow-ups: tied when additive, not tied when a new question, and a follow-up of a follow-up stays on the first topic.
  ...[["How do you validate that a fix is still in place?", "Could you also automate that?", "automate"],
    ["Write a SQL query that lists findings with no owner.", "What's the time complexity?", "complexity"],
    ["Explain how a finding moves from open to closed.", "Any edge cases?", "edge"]].map(([first, follow, keyword]) => ({ kind: "followup", family: "follow-up (idea D, more)", first, follow, keyword })),
  ...[["Explain residual risk.", "How do you secure a CI pipeline?"], ["Write a SQL query that lists findings with no owner.", "Tell me about a time you trained an analyst."],
    ["What would you monitor?", "What is zero trust?"]].map(([first, next]) => ({ kind: "notFollowup", family: "new question after history (must not tie)", first, next })),
  // Jargon a model might bring in unasked is cut from the spoken answer; asked jargon stays.
  ...[["How do you keep user accounts safe?", "I review who has access each quarter. I also watch for Kerberoasting and pass-the-hash.", "Kerberoasting"],
    ["How do you make sure logs are useful?", "I agree which events matter with the owner. Then I ship them to Splunk.", "Splunk"]].map(([q, raw, term]) => ({ kind: "jargon", family: "jargon temptation (settle)", q, raw, term })),
  { kind: "jargonKept", family: "jargon asked (kept)", q: "How do you detect Kerberoasting?", raw: "I look for unusual service ticket requests, because Kerberoasting abuses them." },
  // Invented results with money and time units.
  ...[["I saved the company $2M in audit fees.", true], ["I reduced time to close from 4 hours to 30 minutes.", true],
    ["I would review it within 30 days of the finding.", false]].map(([sentence, invented]) => ({ kind: "numbers", family: "invented-number (units)", sentence, invented })),
  // More provider failure shapes.
  ...["Error 503: Service Unavailable", "context_length_exceeded", "Request timed out after 60000ms"].map((raw) => ({ kind: "provider", family: "provider-error (more)", raw })),
  // Very long garbled multi-part, a very short follow-up word, and two jargon-bait near-duplicates.
  A("very-long garbled multi-part", LONG_GARBLED, { garbled: true }),
  { kind: "nearDup", family: "near-duplicate (jargon bait)", a: "How do you keep user accounts safe?", b: "How do you keep service accounts safe?" },
  { kind: "nearDup", family: "near-duplicate (scope)", a: "How do you scope an access review?", b: "How do you scope an audit?" },
]
// ------------------------------------------------------------------ round 6: mishears, third person, echoes across turns, mode floors
const ECHO = (a, aText, b, bText, same) => ({ kind: "echo", family: same ? "echo: copied answer (must flag)" : "echo: real new answer (must pass)", a, aText, b, bText, same })
const R6 = [
  ...[["um so like what's the uh resid jewel risk thing", "definition"], ["what is residue all risk", "definition"], ["what's the residual joule risk", "definition"],
    ["define resid jewel risk", "definition"], ["what's a compensating control", "definition"], ["what's zero trust", "definition"],
    ["what's the cooper netties control plane", "definition"], ["uh what's terror form", "definition"],
    ["so what's least privilege", "definition"], ["what's the difference between inherent and resid jewel risk", "comparison"]].map(([q, shape]) => A("mishear / what's (round 6)", q, { shapes: [shape], garbled: true })),
  ...["What's your biggest weakness?", "what's your salary expectation", "What's your experience with cloud security?", "what's your notice period", "What's your management style?"]
    .map((q) => ({ kind: "notDefinition", family: "what's your (not a definition)", q })),
  ...[["Jordan tracked residual risk on open findings. He told the business what remained.", false, /^I tracked .* I told /],
    ["Jordan Hale reviewed remediation plans and sent weak evidence back.", false, /^I reviewed /],
    ["Jordan's weekly summary named one finding per paragraph.", false, /^My weekly summary/],
    ["Jordan would hold the item until the evidence matched.", false, /^I would hold/],
    ["Jordan sent findings to the owner. She confirmed the date.", false, /^I sent .* I confirmed/],
    ["Jordan tracks residual risk every week.", true, /^Jordan tracks/],
    ["The weekly summary was written by Jordan for the owner.", true, /Jordan/],
    ["He tracked residual risk. He told the business.", true, /^He tracked/],
    ["My manager Sam reviewed the plan. He agreed to hold the item.", false, /^My manager Sam/],
    ["I'm Jordan Hale, and I review remediation plans.", false, /^I'm Jordan Hale/]].map(([raw, flag, shape]) => ({ kind: "voice", family: "third person (round 6)", raw, flag, shape })),
  ...[["What is a policy exception?", "How do you approve a policy exception?"], ["How do you track open findings?", "How do you report open findings?"],
    ["How do you secure Kubernetes clusters?", "How do you monitor Kubernetes clusters?"], ["What is zero trust?", "How would you roll out zero trust?"],
    ["What is residual risk?", "Who owns residual risk?"], ["How do you scope an access review?", "How do you close an access review?"],
    ["What is least privilege?", "How do you enforce least privilege?"], ["How do you handle a suspicious login?", "How do you handle a lost laptop?"],
    ["Explain residual risk to an engineer.", "Explain residual risk to a director."], ["When would you accept residual risk?", "When would you not accept residual risk?"],
    ["How do you keep user accounts safe?", "How do you keep service accounts safe?"], ["What is SASE?", "What is a SIEM?"],
    ["How do you protect passwords?", "How do you rotate passwords?"], ["How do you validate a fix?", "How do you reopen a fix that failed?"],
    ["What is a compensating control?", "When is a compensating control not enough?"], ["How do you prioritize vulnerabilities?", "How do you prioritize audit findings?"],
    ["How many years of experience do you have?", "Why do you want to leave your current job?"], ["What is threat modeling?", "Who should join a threat modeling session?"],
    ["How do you secure a CI pipeline?", "How do you secure a container registry?"], ["What is business impact?", "How do you measure business impact?"]]
    .map(([a, b]) => ({ kind: "nearDup", family: "near-duplicate (round 6, asked in a row)", a, b })),
  ...[["What is a policy exception?", "A policy exception is an approved, time-limited departure from a policy, with a compensating control and an owner.",
      "When would you reject a policy exception?", "I reject a policy exception when it has no end date, no owner, or no compensating control, and I send it back with what is missing."],
    ["How do you secure Kubernetes clusters?", "I secure Kubernetes clusters by limiting who can reach the control plane, scanning images before they run, and keeping network policies tight between namespaces.",
      "How do you secure a CI pipeline?", "I secure a CI pipeline by signing build artifacts, keeping secrets out of logs, and giving each pipeline only the deploy rights it needs."],
    ["What is zero trust?", "Zero trust means no request is trusted because of where it comes from; every request proves who it is and what it may reach.",
      "What is SASE?", "SASE puts network security and access control in one cloud service, so remote users get the same checks as the office."],
    ["How do you track open findings?", "I track open findings in one register with an owner, a due date, and the evidence that would close each one.",
      "How do you close open findings?", "I close an open finding only when the live setting matches the fix and the owner signs off on the evidence."],
    ["When would you accept residual risk?", "I accept residual risk when the owner signs it off, a compensating control is in place, and the acceptance has an expiry date.",
      "When would you not accept residual risk?", "I do not accept residual risk when no one owns it, when there is no compensating control, or when the impact would stop a critical process."]]
    .flatMap(([a, aText, b, bText]) => [ECHO(a, aText, b, aText, true), ECHO(a, aText, b, bText, false)]),
  ...[["What is residual risk?", "Can you repeat that?"], ["What is residual risk?", "Say that again, please."], ["What is residual risk?", "What is residual risk?"],
    ["What is residual risk?", "Go deeper — following up on: \"What is residual risk\"?"], ["What is residual risk?", "Explain that."]]
    .map(([a, b]) => ({ kind: "echoExempt", family: "echo exempt (repeat / follow-up)", a, b })),
  ...[["What is a policy exception?", "How do you track open findings?", "When would you reject a policy exception?"],
    ["What is zero trust?", "What is residual risk?", "What is SASE?"], ["How do you secure Kubernetes clusters?", "What is least privilege?", "How do you secure a CI pipeline?"],
    ["How do you scope an access review?", "Tell me about yourself.", "How do you scope an audit?"], ["What is business impact?", "When can you start?", "How do you measure business impact?"]]
    .map(([a, mid, c]) => ({ kind: "echoChain", family: "echo two turns back (last three turns)", a, mid, c })),
  ...["Would you bypass a control if the CEO asked you to?", "Would you ever ignore a finding to hit a deadline?", "Is one hundred percent security possible?",
    "Would you sign off on evidence you had not checked?", "Should security ever say no to the business?", "Would you report your own mistake to an auditor?",
    "Can a control be too strict?", "Would you close a finding the owner says is fixed?", "Is a policy exception a failure?", "Do auditors always find the real risks?"].map((q) => A("trick (round 6 mode floors)", q)),
  ...["so yeah, that's basically the team", "okay cool cool", "right, right", "we'll circle back on that", "my screen froze for a second", "I'm writing that down"]
    .map((heard) => ({ kind: "smalltalk", family: "small talk (round 6)", heard })),
  ...["Error: 429 Too Many Requests", "HTTP 503 Service Unavailable", "{\"error\":\"model_not_found\"}", "The upstream request timed out.", "Error: ECONNRESET"]
    .map((raw) => ({ kind: "provider", family: "provider-error (round 6)", raw })),
  ...[["I cut audit prep time by 60%.", true], ["I closed 300 findings last year.", true], ["I would review exceptions every 90 days.", false], ["I check the setting again after 30 days.", false]]
    .map(([sentence, invented]) => ({ kind: "numbers", family: "invented-number (round 6)", sentence, invented })),
]
// ------------------------------------------------------------------ round 7: disguised copies, mixed voice, asides around asks
const PREV_A = "I accept residual risk when the owner signs it off, a compensating control is in place, and the acceptance has an expiry date. I record the reason in the register and review it before it expires."
const R7 = [
  // A model that changes only the opener but keeps the old body is still a copy.
  ...[["When would you accept residual risk?", "Who signs off residual risk?", "The owner signs off residual risk. "],
    ["When would you accept residual risk?", "How do you report residual risk?", "I report residual risk like this. "],
    ["When would you accept residual risk?", "When would you not accept residual risk?", "I would not accept residual risk in some cases. "],
    ["When would you accept residual risk?", "How long can an exception last?", "An exception can last a while. "],
    ["When would you accept residual risk?", "What is residual risk?", "Residual risk is what is left over. "]]
    .map(([a, b, opener]) => ECHO(a, PREV_A, b, opener + PREV_A, true)),
  // Asked repeats in other words are never flagged.
  ...["Could you say that one more time?", "Sorry, I missed that, can you go over it again?", "Come again?", "Can you run through that once more?", "Pardon, could you repeat the last part?"]
    .map((b) => ({ kind: "echoExempt", family: "echo exempt (asked repeat, other words)", a: "What is residual risk?", b })),
  // Mixed voice in one answer.
  ...[["I reviewed the plan. Jordan also sent the findings back.", false, /I also sent/],
    ["Jordan Hale's team reviewed the plan with the owner.", false, /^My team reviewed/],
    ["Jordan led the access review. He then checked the fix a month later.", false, /^I led .*I then checked/],
    ["Jordan led the access review. He thinks it went well.", true, /^I led .*He thinks/],
    ["Jordan, as the analyst, tracked the findings.", true, /^Jordan, as/],
    ["The owner, not Jordan, signed the exception.", true, /Jordan/]].map(([raw, flag, shape]) => ({ kind: "voice", family: "third person mixed (round 7)", raw, flag, shape })),
  // Mishears inside harder asks.
  { kind: "keywords", family: "mishear + negation keywords", q: "when would you not accept resid jewel risk", must: ["not accept", "residual risk"], never: ["jewel"] },
  { kind: "keywords", family: "mishear + premise keywords", q: "Since you ran the audit program, how do you explain resid jewel risk?", must: ["residual risk"], never: ["audit", "program", "jewel"] },
  ...[["we'll circle back on that. How do you scope an access review?", "scope an access review", "circle back"],
    ["my screen froze for a second, sorry. What is least privilege?", "least privilege", "screen froze"],
    ["right, right. So how would you track exceptions?", "track exceptions", "right, right"]].map(([heard, want, drop]) => ({ kind: "intake", family: "aside then a real ask (round 7)", heard, want, drop })),
  ...["Is it better to accept a risk or delay a release?", "Would you trust an owner who says it is fixed?", "Should an analyst ever overrule a manager?",
    "Is compliance the same as security?", "What would you do if your fix broke production?"].map((q) => A("trick (round 7 mode floors)", q)),
  ...["Error code: 500 - {'error': {'message': 'Internal error'}}", "   502 Bad Gateway   ", "HTTP/1.1 429 Too Many Requests", "Gateway Timeout", "The server call timed out after waiting."]
    .map((raw) => ({ kind: "provider", family: "provider-error (round 7)", raw })),
  ...["I would add a timeout so a slow upstream request does not block the review queue.", "HTTP 503 errors from the scanner go to the owner as a ticket."]
    .map((raw) => ({ kind: "notProvider", family: "provider-error look-alike (round 7, legit)", raw })),
]

// ------------------------------------------------------------------ round 8: harder tricks, near-duplicates in a row, garbled asks, mishears
const R8 = [
  ...["Is it ever right to hide a finding from an auditor?", "Would you sign off a risk you do not understand?", "Can you be too thorough in an access review?",
    "Is a clean audit proof that controls work?", "Should every exception be rejected?", "Is zero risk a realistic target?", "Would you report your own manager's mistake?",
    "Is it fine to close a finding without evidence if the owner is senior?", "Do more controls always mean less risk?", "Can a compensating control be worse than the original gap?",
    "Is it okay to skip root cause when the fix is obvious?", "Would you rather miss a deadline or ship a weak fix?"].map((q) => A("trick (round 8 mode floors)", q)),
  ...[["How do you scope an access review?", "How do you schedule an access review?"], ["What is inherent risk?", "What is residual risk?"],
    ["How do you escalate an overdue finding?", "How do you close an overdue finding?"], ["Who owns a policy exception?", "Who approves a policy exception?"],
    ["How do you test a preventive control?", "How do you test a detective control?"], ["How do you report risk to the board?", "How do you report risk to the owner?"],
    ["What makes evidence good?", "What makes evidence weak?"], ["When do you reopen a finding?", "When do you close a finding?"],
    ["How do you handle a late remediation plan?", "How do you handle a vague remediation plan?"], ["How do you measure control health?", "How do you measure risk reduction?"]]
    .map(([a, b]) => ({ kind: "nearDup", family: "near-duplicate (round 8, asked in a row)", a, b })),
  ...[["uh so, um, how do you like, scope an an access review", "scope an access review", "um"], ["sorry the line cut out. What is least privilege?", "least privilege", "line cut"],
    ["okay okay. Next one. How do you track exceptions?", "track exceptions", "next one"], ["can you hear me now? good. How do you close a finding?", "close a finding", "hear me"],
    ["I'm just reading from the list here. What is a compensating control?", "compensating control", "reading from"], ["hold on, my coffee. Okay, what is residual risk?", "residual risk", "coffee"]]
    .map(([heard, want, drop]) => ({ kind: "intake", family: "garbled / aside then ask (round 8)", heard, want, drop })),
  { kind: "keywords", family: "mishear (round 8)", q: "how would you secure cooper netties secrets", must: ["kubernetes"], never: ["cooper", "netties"] },
  { kind: "keywords", family: "mishear (round 8)", q: "explain the start method for a story", must: ["star method"], never: ["start"] },
  { kind: "keywords", family: "mishear (round 8)", q: "when would you not accept residue all risk", must: ["residual risk", "not accept"], never: ["residue"] },
  { kind: "keywords", family: "mishear (round 8)", q: "what's the difference between inherent and resid jewel risk", must: ["inherent", "residual risk"], never: ["jewel"] },
  ...["mm-hm", "okay, noted", "sure, sure", "got it, thanks", "that's fair", "I'm going to mute for a second", "let me check the time", "sorry, someone just walked in"]
    .map((heard) => ({ kind: "smalltalk", family: "small talk (round 8)", heard })),
  ...["{\"error\":\"rate_limited\",\"retry_after\":12}", "openai.APIConnectionError: Connection error.", "Request timed out.", "Service Unavailable", "anthropic.InternalServerError: overloaded_error"]
    .map((raw) => ({ kind: "provider", family: "provider-error (round 8)", raw })),
  ...["When the scanner timed out, I re-ran it and compared the results with the change log.", "A 429 from the vendor API meant I batched the evidence requests."]
    .map((raw) => ({ kind: "notProvider", family: "provider-error look-alike (round 8, legit)", raw })),
]

// ------------------------------------------------------------------ round 9: long multi-part asks, recursive follow-ups, copies two turns back
const R9 = [
  ...["How do you assess residual risk, who signs it off, how long does the acceptance last, and what makes you reopen it?",
    "Walk me through scoping an access review, picking the sample, chasing evidence, and reporting what you found.",
    "Explain the difference between a policy exception and a deviation, when you would allow each, and who owns the follow-up.",
    "Tell me how you would challenge a weak remediation plan, what evidence you would ask for, and how you would know the fix held.",
    "If an owner misses a deadline, what do you do first, who do you tell, and how do you stop it happening again?",
    "Describe how you map a control to a framework, how you test it, and how you report a failed test to the business.",
    "What is least privilege, how do you check it in practice, and what do you do when a team pushes back?",
    "How do you prioritise findings, how do you explain the order to owners, and what do you track every week?"].map((q) => A("long multi-part (round 9)", q)),
  ...[["What is residual risk?", "And who signs it off?", "signs"], ["What is residual risk?", "What if they refuse?", "refuse"],
    ["How do you track open findings?", "What about the overdue ones?", "overdue"], ["How do you track open findings?", "And how often?", "often"],
    ["What is a policy exception?", "How long can it last?", "last"], ["How do you scope an access review?", "And who do you include?", "include"],
    ["How do you challenge a weak remediation plan?", "What if the owner is senior to you?", "senior"], ["How do you test a control?", "And if it fails?", "fails"]]
    .map(([first, follow, keyword]) => ({ kind: "followup", family: "recursive follow-up (round 9)", first, follow, keyword })),
  ...[["What is residual risk?", "How do you report it?", "Who owns it?"], ["How do you scope an access review?", "Who do you include?", "How do you report the results?"],
    ["What is a policy exception?", "Who approves it?", "How long does it last?"], ["How do you test a control?", "What if it fails?", "Who do you tell?"],
    ["How do you track open findings?", "What about overdue ones?", "How do you close them?"], ["What is least privilege?", "How do you check it?", "What if a team pushes back?"]]
    .map(([a, mid, c]) => ({ kind: "echoChain", family: "echo two turns back (round 9)", a, mid, c })),
  ...[["What is residual risk?", "What is zero trust?"], ["How do you track open findings?", "Tell me about yourself."], ["Who signs off residual risk?", "Where are you based?"],
    ["How do you test a control?", "Write a SQL query that lists findings with no owner."]].map(([first, next]) => ({ kind: "notFollowup", family: "new question after history (round 9)", first, next })),
  ...[["Tell me about yourself.", "How do you track open findings?"], ["When can you start?", "What is residual risk?"], ["What is residual risk?", "Do you have any questions for us?"]]
    .map(([a, b]) => ({ kind: "nearDup", family: "unrelated pair in a row (round 9)", a, b })),
]

// ------------------------------------------------------------------ round 10: the three modes on the hardest asks, disguised copies, mixed voice
const PREV_B = "I scope an access review by starting from the systems that hold sensitive data, then I pick the accounts with privileged access, and I agree the evidence with each owner before the review starts. I report what I found to the owner and track every removal to closure."
const R10 = [
  ...["Is it ever acceptable to accept a risk without an owner?", "What would you do if two owners both refuse a finding?", "Would you trust evidence from a screenshot?",
    "Why would a control pass the test and still fail in practice?", "What if the auditor is wrong?", "Explain residual risk to a ten-year-old.",
    "If you had one week, what would you review first?", "How would you know your risk register is lying?", "Why do remediation plans fail?", "What is the hardest finding you have closed?",
    "Should security ever slow down a release?", "What is the difference between a risk and an issue, and why does it matter?"].map((q) => A("three modes, hardest asks (round 10)", q)),
  ...[["How do you scope an access review?", "Who do you include in an access review?", "I include these people. "],
    ["How do you scope an access review?", "How do you report access review results?", "I report the results this way. "],
    ["How do you scope an access review?", "How long does an access review take?", "It takes a few weeks. "],
    ["How do you scope an access review?", "What is an access review?", "An access review checks access. "],
    ["How do you scope an access review?", "How do you scope an access review for a cloud account?", "For a cloud account it is similar. "]]
    .map(([a, b, opener]) => ECHO(a, PREV_B, b, opener + PREV_B, true)),
  // A copy with the sentences reordered is still a copy.
  ECHO("How do you scope an access review?", PREV_B, "Who do you include in an access review?", "I report what I found to the owner and track every removal to closure. I scope an access review by starting from the systems that hold sensitive data, then I pick the accounts with privileged access, and I agree the evidence with each owner before the review starts.", true),
  ECHO("How do you scope an access review?", PREV_B, "Who do you include in an access review?", "I include the system owner, the manager of each account holder, and someone from identity who can remove access the same day. I keep security as the reviewer, not the approver.", false),
  ECHO("How do you scope an access review?", PREV_B, "How long does an access review take?", "A quarterly access review takes me about two weeks for a sensitive system. Most of that time is waiting for owners to confirm, so I agree the deadline with them before I start.", false),
  ...[["Jordan scoped the review. Then he agreed the evidence with each owner.", false, /^I scoped .*I agreed/],
    ["Jordan Hale reported it to the committee.", false, /^I reported/],
    ["As Jordan, I reviewed the plan.", true, /Jordan/],
    ["My manager and Jordan reviewed it together.", true, /Jordan/],
    ["I reviewed the plan with the owner. She signed the exception.", false, /^I reviewed .*She signed/],
    ["Jordan's review found three gaps. He closed two.", false, /^My review .*I closed/]].map(([raw, flag, shape]) => ({ kind: "voice", family: "third person mixed (round 10)", raw, flag, shape })),
  ...[["Explain residual risk, compensating controls and exception expiry.", "And the second one again?", "compensating"]]
    .map(([first, follow, keyword]) => ({ kind: "followup", family: "follow-up on one part of a multi-part (round 10)", first, follow, keyword })),
  ...["Hmm. So, uh, what would you, um, what would you do if the owner says it's fixed but there's no evidence?", "okay so the thing is, like, how do you, how do you prove a control works?",
    "right so imagine, imagine you join on Monday, what do you look at first?"].map((q) => A("garbled long ask, three modes (round 10)", q, { garbled: true })),
]

// Round 9, more: three follow-ups in a row (each tied to the first real question, none a copy of an earlier answer),
// and listed parts read from long garbled asks.
const R9_MORE = [
  ...[["What is residual risk?", ["And who signs it off?", "What if they refuse?", "And how often do you review it?"]],
    ["How do you track open findings?", ["What about the overdue ones?", "And who do you tell?", "What if it slips again?"]],
    ["How do you scope an access review?", ["And who do you include?", "What if they don't respond?", "And how long does it take?"]],
    ["What is a policy exception?", ["How long can it last?", "And who approves it?", "What if it expires?"]],
    ["How do you test a control?", ["And if it fails?", "Who do you tell?", "What if they disagree?"]],
    ["How do you challenge a weak remediation plan?", ["What if the owner is senior to you?", "And if they still refuse?", "What would you track afterwards?"]]]
    .map(([first, chain]) => ({ kind: "followChain", family: "three follow-ups in a row (round 9)", first, chain })),
  ...[["So, uh, explain residual risk, um, compensating controls and, like, exception expiry.", ["residual risk", "compensating controls", "exception expiry"]],
    ["Walk me through, uh, scoping, sampling, evidence and reporting.", ["scoping", "sampling", "evidence", "reporting"]],
    ["Okay so, cover the owner, the deadline and, you know, the evidence.", ["owner", "deadline", "evidence"]],
    ["Explain, um, trust boundaries, data flow, failure isolation and rollout.", ["trust boundaries", "data flow", "failure isolation", "rollout"]],
    ["Describe the scope, the risks, and uh the rollback plan.", ["scope", "risks", "rollback plan"]],
    ["Hmm, so, discuss preventive controls, detective controls and, er, corrective controls.", ["preventive controls", "detective controls", "corrective controls"]]]
    .map(([q, parts]) => ({ kind: "parts", family: "listed parts in a garbled ask (round 9)", q, parts })),
  ...["What is residual risk? And who signs it off? And how long does the acceptance last?",
    "How do you scope an access review and who do you include and how do you report it and what do you do with the leavers?",
    "Tell me about a time you challenged a plan, what the owner said, what you did next, and what you would do differently now."].map((q) => A("long multi-part, many asks (round 9)", q)),
]

const R10_MORE = [
  ...["Uh, is it, um, is it ever okay to close a finding without evidence?", "So like, why would, why would a clean audit worry you?",
    "Okay, the question is, how do you know a fix held?", "Here's the thing, what if the owner disagrees with the rating?",
    "I guess, what is the difference between inherent and residual risk?", "Right so, um, what would you do if two findings conflict?",
    "My question is, would you trust an owner's self-assessment?", "so, uh, the thing is, how do you, how do you rank findings?"].map((q) => A("garbled trick, three modes (round 10)", q, { garbled: true })),
  ...[["Explain residual risk, compensating controls and exception expiry.", "And the last one?", "expiry"],
    ["Explain residual risk, compensating controls and exception expiry.", "Go back to the first one.", "residual"],
    ["Describe scoping, sampling and reporting for an access review.", "And the second part?", "sampling"]]
    .map(([first, follow, keyword]) => ({ kind: "followup", family: "follow-up on one part of a multi-part (round 10)", first, follow, keyword })),
  ...[["Jordan reviewed it. Afterwards he sent it back.", false, /^I reviewed .*Afterwards I sent/],
    ["Jordan led it. So he tracked every finding.", false, /^I led .*So I tracked/],
    ["Jordan led it. Then she signed it.", false, /^I led it\. Then I signed/],
    ["He tracked the findings and reported them.", true, /^He tracked/]].map(([raw, flag, shape]) => ({ kind: "voice", family: "third person after a connector (round 10)", raw, flag, shape })),
  ...["openai.RateLimitError: Error code: 429", "anthropic.APIStatusError: 529 overloaded", "google.api_core.exceptions.ServiceUnavailable: 503", "httpx.ReadTimeout: timed out",
    "Error: socket hang up"].map((raw) => ({ kind: "provider", family: "provider-error SDK lines (round 10)", raw })),
  ...["The RateLimitError in our client told me the vendor throttled us, so I batched the requests.", "A socket hang up from the proxy meant the change had broken keep-alive, so I rolled it back."]
    .map((raw) => ({ kind: "notProvider", family: "provider-error look-alike (round 10, legit)", raw })),
  ...["uh-huh", "mhm, okay", "right, okay, got it", "okay, I'm going to share my screen", "sorry, I'm on mute", "can everyone hear me okay"]
    .map((heard) => ({ kind: "smalltalk", family: "small talk (round 10)", heard })),
  // Failsafes for the round 9 tie rules: a new subject after "and", or mid-chain, is a new question.
  ...[["What is residual risk?", "And what is zero trust?"], ["Who signs it off — following up on: \"What is residual risk\"?", "Where are you based?"],
    ["Who signs it off — following up on: \"What is residual risk\"?", "Tell me about yourself."], ["Who signs it off — following up on: \"What is residual risk\"?", "What is least privilege?"],
    ["How do you test a control?", "And describe your last access review."]].map(([first, next]) => ({ kind: "notFollowup", family: "new question, failsafe for the tie rules (round 10)", first, next })),
]
export const ROUNDS = [R1, R2, R3, R4, R5, R6, R7, R8, [...R9, ...R9_MORE], [...R10, ...R10_MORE]]
export const INFO = []

// ------------------------------------------------------------------ checks
const FILLER = /\b(?:um+|uh+|erm|you know)\b/i
const resumeNumbers = new Set((RESUME.match(/\d+/g) || []))
function speakable(text) {
  const out = []
  if (/^#|\*\*|^\s*[-*•]\s|\[[^\]]*\]|https?:|[{}<>|]/m.test(text)) out.push("markup a person would not say")
  if (sentencesOf(text).some((s) => wordCount(s) > 40)) out.push("sentence over 40 words")
  return out
}
function firstPersonIssues(text, q) {
  const out = []
  if (!/\b(?:I|my|me|I'm|I've|I'd)\b/.test(text)) out.push("not first person")
  if (/\b(?:your|yourself)\b/i.test(text) && !/\byou\b/i.test("")) out.push("addresses the candidate as 'you/your'")
  if (/\bJordan\b|\b(?:he|she) (?:tracked|reviewed|told|sent)\b/.test(text)) out.push("third person")
  if (/\bI (?:how|what|why|where|when|who|um|uh|hi|hello|your|you|can your|residual|least|SQL|SOC|IAM|yourself)\b/i.test(text) || /\bI can your\b/i.test(text)) out.push("broken grammar around the question words")
  // Round 9: an object "you" turned into "I" ("senior to I", "with I").
  if (/\b(?:to|for|with|than|from|about|by|against) I\b(?!')/.test(text)) out.push("broken grammar: object 'I' instead of 'me'")
  if (FILLER.test(text)) out.push("echoes speech filler")
  return out
}
function invented(text, q) {
  const asked = new Set(String(q).match(/\d+/g) || [])
  return (text.match(/\b\d+\b/g) || []).filter((n) => !asked.has(n) && !resumeNumbers.has(n))
}

function judgeAnswerCase(c) {
  const fails = []
  const q = c.q
  const rows = LEVELS.map((level) => ({ question: q, level, text: draftSpokenAnswer(q, level, RESUME) }))
  const cut = dissectQuestion(q, RESUME)
  if (c.shapes && !c.shapes.includes(cut.shape)) fails.push(`shape ${cut.shape}, expected ${c.shapes.join("/")}`)
  if (c.garbled && cut.keywords.some((k) => FILLER.test(k) || /^(?:like|thing|kind|sort)$/i.test(k))) fails.push(`filler in keywords: ${cut.keywords.join("|")}`)
  for (const row of rows) {
    if (c.code) continue
    for (const issue of [...speakable(row.text), ...firstPersonIssues(row.text, q)]) fails.push(`${row.level}: ${issue}`)
    const nums = invented(row.text, q)
    if (nums.length) fails.push(`${row.level}: invented numbers ${nums.join(",")}`)
    const said = sentencesOf(row.text).map((s) => s.toLowerCase())
    if (new Set(said).size !== said.length) fails.push(`${row.level}: repeats a sentence`)
  }
  if (!c.code) {
    const judged = evaluateLiveAnswers(rows, RESUME)
    for (const f of judged.failures) fails.push(f.replace(/: .*$/, ""))
  }
  return { fails, rows }
}

export function judgeCase(c) {
  if (c.kind === "answer") return judgeAnswerCase(c).fails
  if (c.kind === "nearDup") {
    // Round 6: judged as asked live. Question b comes after a, so the previous answer is known (the production prompt
    // and settle both have it). Two things must hold: the stand-in answers b differently, and the production check
    // flags the previous answer if a model gave it again for b. The stand-in with no history is reported as info only,
    // because production never answers without the previous turn.
    const fails = []
    for (const level of LEVELS) {
      const a = draftSpokenAnswer(c.a, level, RESUME)
      const b = draftSpokenAnswer(c.b, level, RESUME, [a])
      const r = sameAnswerRatio(a, b)
      if (r >= 0.7) fails.push(`${level}: same answer (Jaccard ${r.toFixed(2)})`)
      if (answerEchoesPrevious(c.b, b, [{ q: c.a, a }]).same) fails.push(`${level}: the new answer is flagged as the previous one`)
      if (!answerEchoesPrevious(c.b, a, [{ q: c.a, a }]).same) fails.push(`${level}: a copy of the previous answer is not caught`)
      const cold = sameAnswerRatio(a, draftSpokenAnswer(c.b, level, RESUME))
      if (cold >= 0.7) INFO.push(`stand-in with no history, ${level}: "${c.a}" / "${c.b}" Jaccard ${cold.toFixed(2)}`)
    }
    return fails
  }
  if (c.kind === "echo") {
    const r = answerEchoesPrevious(c.b, c.bText, [{ q: c.a, a: c.aText }])
    return r.same === c.same ? [] : [c.same ? "copied answer not caught" : `real new answer flagged: ${r.reason}`]
  }
  if (c.kind === "echoExempt") {
    const prev = draftSpokenAnswer(c.a, "director", RESUME)
    return answerEchoesPrevious(c.b, prev, [{ q: c.a, a: prev }]).same ? ["a repeat or follow-up was flagged as an echo"] : []
  }
  if (c.kind === "echoChain") {
    const a = draftSpokenAnswer(c.a, "director", RESUME)
    const mid = draftSpokenAnswer(c.mid, "director", RESUME, [a])
    const turns = [{ q: c.a, a }, { q: c.mid, a: mid }]
    const fails = []
    if (!answerEchoesPrevious(c.c, a, turns).same) fails.push("the answer from two turns back given again is not caught")
    const fresh = draftSpokenAnswer(c.c, "director", RESUME, [a, mid])
    if (answerEchoesPrevious(c.c, fresh, turns).same) fails.push(`the new answer is flagged: ${fresh}`)
    return fails
  }
  if (c.kind === "voice") {
    const r = firstPersonRewrite(c.raw, RESUME)
    const fails = []
    if (r.thirdPerson !== c.flag) fails.push(`third person flag ${r.thirdPerson}, expected ${c.flag}: "${r.text}"`)
    if (!c.shape.test(r.text)) fails.push(`rewrite "${r.text}"`)
    const s = settleSpokenAnswer("What does residual risk mean?", c.raw, "architect", RESUME)
    if (!s.text) fails.push("settle blanked the answer")
    return fails
  }
  if (c.kind === "notDefinition") {
    const shape = dissectQuestion(c.q).shape
    return shape === "definition" ? [`"${c.q}" read as a definition`] : []
  }
  if (c.kind === "smalltalk") {
    const fails = []
    for (const heard of [`Them: ${c.heard}`, c.heard]) {
      const d = deriveByCode(heard, [])
      if (d) fails.push(`derive turned "${heard}" into a question: "${d}"`)
    }
    const q = questionForAnswer(c.heard, "", false, false, [])
    if (q) fails.push(`answer request would answer "${q}"`)
    return fails
  }
  if (c.kind === "followup") {
    const fails = []
    const history = [{ q: c.first, a: draftSpokenAnswer(c.first, "engineer", RESUME) }]
    const formed = questionForAnswer(c.follow, "", false, false, history)
    const tied = formed.includes(c.first.replace(/[?.!\s]+$/, ""))
    if (!tied) fails.push(`follow-up not tied to the previous question: "${formed}"`)
    for (const level of LEVELS) {
      const first = draftSpokenAnswer(c.first, level, RESUME)
      // Round 9: judged as asked live, like near-duplicates since round 6: production always has the previous answer for
      // a tied follow-up. The stand-in with no history is reported as info only.
      const next = draftSpokenAnswer(formed, level, RESUME, [first])
      const coldNext = draftSpokenAnswer(formed, level, RESUME)
      if (sameAnswerRatio(first, coldNext) >= 0.5) INFO.push(`follow-up stand-in with no history, ${level}: "${c.first}" / "${c.follow}" Jaccard ${sameAnswerRatio(first, coldNext).toFixed(2)}`)
      const r = sameAnswerRatio(first, next)
      if (r >= 0.5) fails.push(`${level}: follow-up repeats the first answer (Jaccard ${r.toFixed(2)})`)
      if (!next.toLowerCase().includes(c.keyword)) fails.push(`${level}: follow-up answer lacks "${c.keyword}"`)
      for (const issue of firstPersonIssues(next, formed)) fails.push(`${level}: ${issue}`)
      if (/following up on/i.test(next)) fails.push(`${level}: says the internal "following up on" tag aloud`)
    }
    const kw = questionKeywords(formed)
    if (!kw.some((k) => k.toLowerCase().includes(c.keyword.slice(0, 4)))) fails.push(`keywords miss the follow-up's word: ${kw.join("|")}`)
    return fails
  }
  if (c.kind === "followChain") {
    // Round 9: each follow-up is formed as live (history so far) and must stay tied to the conversation, not repeat an
    // earlier answer in the chain, and stay first person.
    const fails = []
    for (const level of LEVELS) {
      const history = [{ q: c.first, a: draftSpokenAnswer(c.first, level, RESUME) }]
      for (const follow of c.chain) {
        const formed = questionForAnswer(follow, "", false, false, history)
        if (level === "engineer" && !/following up on/i.test(formed)) fails.push(`not tied: "${follow}" -> "${formed}"`)
        const next = draftSpokenAnswer(formed, level, RESUME, history.map((h) => h.a))
        for (const h of history) { const r = sameAnswerRatio(h.a, next); if (r >= 0.5) fails.push(`${level}: "${follow}" repeats an earlier answer (Jaccard ${r.toFixed(2)})`) }
        for (const issue of firstPersonIssues(next, formed)) fails.push(`${level}: ${issue}`)
        if (/following up on/i.test(next)) fails.push(`${level}: says the internal tag aloud`)
        history.push({ q: formed, a: next })
      }
    }
    return fails
  }
  if (c.kind === "parts") {
    const got = askedPartList(c.q)
    const fails = []
    for (const p of c.parts) if (!got.some((g) => g.includes(p))) fails.push(`missing part "${p}": ${got.join("|")}`)
    for (const g of got) if (/^(?:so|uh|um|er|hmm|like|you know|okay|okay so|what would you)$/i.test(g) || FILLER.test(g)) fails.push(`filler read as a part: "${g}"`)
    return fails
  }
  if (c.kind === "provider") {
    const fails = []
    if (!isProviderErrorAnswer(c.raw)) fails.push("not recognised as a provider error")
    for (const level of LEVELS) if (settleSpokenAnswer("What is residual risk?", c.raw, level, RESUME).text) fails.push(`${level}: shown as an answer`)
    return fails
  }
  if (c.kind === "notProvider") return isProviderErrorAnswer(c.raw) ? ["a real answer is refused as a provider error"] : []
  if (c.kind === "numbers") {
    const out = applyGuards(c.sentence, null, new Set(), new Set()).text
    const kept = (c.sentence.match(/\d+/g) || []).filter((n) => out.includes(n))
    if (c.invented && kept.length) return [`invented figure kept: "${out}"`]
    if (!c.invented && out !== c.sentence) return [`structural figure rewritten: "${out}"`]
    return []
  }
  if (c.kind === "settle") {
    const fails = []
    for (const level of LEVELS) {
      const s = settleSpokenAnswer(c.q, c.raw, level, RESUME)
      for (const issue of [...speakable(s.text), ...firstPersonIssues(s.text, c.q).filter((i) => i !== "not first person")]) fails.push(`${level}: ${issue}`)
      if (/^(?:answer|short answer)\b/i.test(s.text)) fails.push(`${level}: reads out an "Answer" label`)
    }
    return fails
  }
  if (c.kind === "intake") {
    // As the live client sends it: the derived ask, unpinned (first try or retry) and pinned (the card).
    const heard = `Them: ${c.heard}`
    const derived = deriveByCode(heard, []) || ""
    const fails = []
    if (!derived.toLowerCase().includes(c.want)) fails.push(`derive lost the ask: "${derived}"`)
    if (derived.toLowerCase().includes(c.drop)) fails.push(`derive kept the chatter: "${derived}"`)
    for (const pinned of [false, true]) {
      const q = questionForAnswer(heard, derived, pinned, false, [])
      const low = q.toLowerCase()
      if (!low.includes(c.want)) fails.push(`${pinned ? "pinned" : "unpinned"}: ask lost: "${q}"`)
      if (low.split(c.want).length > 2) fails.push(`${pinned ? "pinned" : "unpinned"}: the ask is said twice: "${q}"`)
      if (pinned && low.includes(c.drop)) fails.push(`pinned: chatter kept in the ask: "${q}"`)
    }
    return fails
  }
  if (c.kind === "statement") {
    const q = questionForAnswer(c.heard, "", false, false, [])
    const d = deriveByCode(`Them: ${c.heard}`, [])
    const fails = []
    if (q && dissectQuestion(q).shape !== "acknowledgement") fails.push(`a statement became a question to answer: "${q}" (${dissectQuestion(q).shape})`)
    // Decision (yellow): a statement addressed to the candidate may be derived, as long as it is only acknowledged.
    if (d && dissectQuestion(d).shape !== "acknowledgement") fails.push(`derive turned a statement into a question: "${d}" (${dissectQuestion(d).shape})`)
    return fails
  }
  if (c.kind === "keywords") {
    const kw = dissectQuestion(c.q).keywords.map((k) => k.toLowerCase()) // what the answer prompt is given
    const fails = []
    for (const m of c.must) if (!kw.some((k) => k.includes(m))) fails.push(`missing keyword "${m}": ${kw.join("|")}`)
    for (const n of c.never) if (kw.some((k) => k === n || k.split(" ").includes(n))) fails.push(`keyword "${n}" should not lead: ${kw.join("|")}`)
    return fails
  }
  if (c.kind === "notFollowup") {
    const q = questionForAnswer(c.next, "", false, false, [{ q: c.first }])
    return /following up on/i.test(q) ? [`a new question was tied to the previous one: "${q}"`] : []
  }
  if (c.kind === "jargon") {
    const fails = []
    for (const level of LEVELS) {
      const s = settleSpokenAnswer(c.q, c.raw, level, RESUME)
      if (s.text.includes(c.term)) fails.push(`${level}: unasked "${c.term}" kept`)
      if (!s.text) fails.push(`${level}: the whole answer was dropped`)
    }
    return fails
  }
  if (c.kind === "jargonKept") {
    const s = settleSpokenAnswer(c.q, c.raw, "engineer", RESUME)
    return s.text.includes("Kerberoasting") ? [] : [`asked jargon was cut: "${s.text}"`]
  }
  if (c.kind === "repeat") {
    const s = settleSpokenAnswer(c.q, c.raw, "director", RESUME, c.previous)
    // Decision (yellow): a FULL read-back is kept, because an empty text shows the user "answer unavailable"; it is flagged.
    if (c.full) return s.repeated ? [] : ["full repeat is not flagged as repeated"]
    const old = sentencesOf(c.previous).map((x) => x.toLowerCase())
    return sentencesOf(s.text).some((x) => old.includes(x.toLowerCase())) ? [`a sentence from the previous answer is said again: "${s.text}"`] : []
  }
  return [`unknown case kind ${c.kind}`]
}

export function runRound(index) {
  const cases = ROUNDS[index]
  const failures = []
  for (const c of cases) {
    const fails = judgeCase(c)
    if (fails.length) failures.push({ round: index + 1, family: c.family, ask: c.q || c.a || c.first || c.heard || c.follow || c.raw || c.sentence, fails: [...new Set(fails)] })
  }
  return { round: index + 1, checks: cases.length, answers: cases.filter((c) => c.kind === "answer").length * 3, failures }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv[2] ? [Number(process.argv[2]) - 1] : ROUNDS.map((_, i) => i)
  let total = 0, failed = 0
  for (const i of only) {
    const r = runRound(i)
    total += r.checks
    failed += r.failures.length
    console.log(`\n=== round ${r.round}: ${r.checks} checks, ${r.failures.length} failing`)
    for (const f of r.failures) console.log(`- [${f.family}] ${String(f.ask).slice(0, 90)}\n    ${f.fails.join("\n    ")}`)
  }
  console.log(`\nTOTAL ${total} checks, ${failed} failing (offline, code-level only; not live answer quality)`)
  if (INFO.length) console.log(`\nINFO (not failures): ${INFO.length} stand-in pairs still alike with no history\n  ${INFO.join("\n  ")}`)
  process.exitCode = failed ? 1 : 0
}
