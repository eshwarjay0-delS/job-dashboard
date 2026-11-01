import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { workbenchTrack, notebookCausalGuidance, notebookCausalFlags, NOTEBOOK_CAUSAL_VERSION } from "../../src/lib/kompasNotebookCausal.ts"

const cases = [
  ["brief", "What is CyberArk EPM?"], ["brief", "Define least privilege."], ["brief", "Explain MFA."],
  ["brief", "Have you used ServiceNow?"], ["brief", "What does NIST stand for?"], ["brief", "Can you start next month?"],
  ["comparison", "Difference between SAST and DAST?"], ["comparison", "Compare RBAC versus ABAC."],
  ["comparison", "How does authentication differ from authorization?"], ["comparison", "What are the tradeoffs between password and certificate authentication?"],
  ["comparison", "NIST CSF vs ISO 27001?"], ["comparison", "Compare local admin accounts and just-in-time elevation."],
  ["mechanism", "How does Kerberos authentication work?"], ["mechanism", "Explain how OAuth state works."],
  ["mechanism", "What happens when a token expires?"], ["mechanism", "Why does an API gateway validate signatures?"],
  ["mechanism", "Under the hood, where does the request go?"], ["mechanism", "How is a certificate chain evaluated?"],
  ["diagnosis", "How would you verify an EPM policy block?"], ["diagnosis", "What caused the authentication failure?"],
  ["diagnosis", "Why did the service fail under load?"], ["diagnosis", "How did you isolate root cause?"],
  ["diagnosis", "How do you confirm the remediation worked?"], ["diagnosis", "Investigate a missing security event."],
  ["scenario", "How would you design an on-call escalation?"], ["scenario", "What would you do if the cloud region goes down?"],
  ["scenario", "Suppose the bank cannot patch until month-end."], ["scenario", "Imagine two teams disagree on scope."],
  ["scenario", "How do you handle a rollout under a change freeze?"], ["scenario", "If you found an exposed endpoint, what would you do?"],
  ["decision", "Why did you choose a rollback over a hotfix?"], ["decision", "Which should you choose for the deployment?"],
  ["decision", "How would you prioritize the risks?"], ["decision", "What would change your mind about this exception?"],
  ["decision", "Why would you recommend compensating controls?"], ["decision", "How do you decide whether to accept the risk?"],
  ["experience", "Tell me about a time you challenged an access owner."], ["experience", "Describe a situation when the deployment failed."],
  ["experience", "Share an example when you found an IDOR."], ["experience", "Give me an example from your previous role."],
  ["experience", "Walk me through an incident you handled."], ["experience", "Tell me about a time you resolved a disagreement."],
  ["follow-up", "Which logs did you inspect?"], ["follow-up", "What exactly did you configure?"],
  ["follow-up", "How did you prove the fix?"], ["follow-up", "Who signed off?"],
  ["follow-up", "What happened next?"], ["follow-up", "And what did you check?"],
  ["coding", "Write a Python function to classify alerts."], ["coding", "Implement an algorithm to detect duplicates."],
  ["coding", "Show me SQL code for the join."], ["coding", "Refactor this JavaScript function."],
  ["coding", "Debug the Python script."], ["coding", "LeetCode tree traversal."],
  ["brief", "What is DeltaV?"], ["brief", "What is PAS-X?"], ["comparison", "Compare fail-open and fail-closed."],
  ["diagnosis", "Root cause for missing audit logs?"], ["scenario", "What would you do tonight during an incident?"],
  ["decision", "Why did you reject the exception?"],
]

test("Notebook v2: sixty diverse source-neutral questions select the right causal route", () => {
  assert.equal(NOTEBOOK_CAUSAL_VERSION, "notebook-causal-v2")
  assert.equal(cases.length, 60)
  for (const [expected, question] of cases) {
    assert.equal(workbenchTrack(question), expected, question)
    const guidance = notebookCausalGuidance(question, "engineer")
    assert.match(guidance, /NOTEBOOK CAUSAL DEPTH/)
    assert.match(guidance, /single candidate voice/)
    assert.match(guidance, /original resume and active documents/)
    assert.match(guidance, /never prove a personal achievement/)
    assert.doesNotMatch(guidance, /Speaker 1:|Speaker 2:/)
  }
})

test("Notebook v2 keeps direct facts brief and first-person stories strictly source-bound", () => {
  const direct = notebookCausalGuidance("What is IDOR?", "technical_hr")
  assert.match(direct, /stop\. Do not turn a definition into an incident/)
  assert.match(direct, /lead with a plain explanation/)
  const story = notebookCausalGuidance("Tell me about a time you challenged a stakeholder", "director")
  assert.match(story, /original-resume\/document-supported responsibility/)
  assert.match(story, /A rehearsal transcript cannot supply missing incident details/)
  assert.match(story, /Executive lens/)
  const code = notebookCausalGuidance("Write a Python function to parse logs", "engineer")
  assert.match(code, /existing coding-answer contract/)
})

test("Notebook v2 maintains the same project on followups without promoting previous answer to proof", () => {
  const follow = notebookCausalGuidance(
    "Which logs did you inspect?", "architect",
    "How did you test the EPM just-in-time policy for the incident?"
  )
  assert.match(follow, /SAME case/)
  assert.match(follow, /previous AI-generated claim/)
  assert.match(follow, /"How did you test the EPM just-in-time policy for the incident\?"/)
  assert.match(follow, /Architecture lens/)
  assert.doesNotMatch(notebookCausalGuidance("What is least privilege?", "engineer", "Tell me about Citi"), /Previous interviewer question/)
})

test("Notebook v2 diagnostics flag weak response structure without erasing or inventing text", () => {
  assert.deepEqual(notebookCausalFlags(
    "How would you verify that the access was really revoked?",
    "The process is robust, and the team has excellent operational capabilities in this environment."
  ), ["notebook:missing-discriminating-evidence"])
  assert.deepEqual(notebookCausalFlags(
    "Compare SAST and DAST",
    "SAST inspects source code, whereas DAST observes a running application."
  ), [])
  assert.deepEqual(notebookCausalFlags(
    "Compare SAST and DAST",
    "SAST finds source-level issues. DAST analyzes behavior at runtime during dynamic execution."
  ), ["notebook:contrast-not-explicit"])
  assert.deepEqual(notebookCausalFlags(
    "Why did you choose to hold the release?",
    "I decided to hold it and told the team immediately after the review was completed."
  ), ["notebook:decision-reason-unclear"])
  assert.deepEqual(notebookCausalFlags("Define SAML", "SAML carries federated authentication assertions."), [])
  assert.deepEqual(notebookCausalFlags("How do you validate the control?",
    "I check the entitlement record and compare effective permissions with the approved grant."), [])
})

test("The canonical answer service applies one plan for web, Windows and WhatsApp and exposes both output diagnostics", () => {
  const service = readFileSync(new URL("../../src/lib/kompasAnswerService.ts", import.meta.url), "utf8")
  const route = readFileSync(new URL("../../src/app/api/kompas/answer/route.ts", import.meta.url), "utf8")
  const channel = readFileSync(new URL("../../src/lib/kompas-shared-turn.ts", import.meta.url), "utf8")
  assert.match(service, /notebookCausalGuidance\(question, level, priorInterviewerQuestion\)/)
  assert.match(service, /const notebookWorkbench = tier === 0 \? ""/)
  assert.match(service, /\$\{notebookWorkbench\}/)
  assert.equal((service.match(/notebookCausalFlags\(job\.question, (?:finalText|out)\)/g) || []).length, 2)
  assert.match(route, /answerForVerifiedUser\(request, user\)/)
  assert.match(channel, /answerForVerifiedUser/)
  assert.match(service, /candidateEvidenceForVerification/)
  assert.match(service, /masterBibleContext/)
  assert.match(service, /DOCUMENTS FIRST/)
  assert.doesNotMatch(service, /consumer\.notebooklm\.google\.com/)
})

test("No fake realism: a generated rehearsal answer and third-party teaching cannot become candidate history", () => {
  for (const q of [
    "Which logs did you inspect?", "What actually happened?", "Why did you choose CyberArk?",
    "Tell me about a time your production change failed."
  ]) {
    const guidance = notebookCausalGuidance(q, "engineer", "Tell me about your team")
    assert.match(guidance, /Do not invent logs, incidents, employers/)
    assert.match(guidance, /transcript or teaching recording can shape explanation, never prove/)
  }
})
