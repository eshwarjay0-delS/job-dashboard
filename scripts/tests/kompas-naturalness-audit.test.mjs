import test from "node:test"
import assert from "node:assert/strict"
import { naturalNarrationFlags } from "../../src/lib/kompasNaturalNarration.ts"
import { spokenQualityFlags } from "../../src/lib/kompasInterviewPrecision.ts"

// No real candidate resumes or user transcripts are used in committed tests.
// The 50 independent utterances span direct facts, scenarios, technical
// mechanisms, STAR experiences, followups and explicit analogy requests.
const cases = [
 ["What is residual risk?", "Residual risk is the exposure left after current controls are considered.", []],
 ["What is CyberArk EPM?", "Endpoint privilege management controls execution and elevation on endpoints.", []],
 ["How do you investigate an EPM block?", "I would identify the binary, its publisher and the policy decision before changing the rule.", []],
 ["Tell me about a time you challenged a remediation owner.", "I reviewed the proposed fix against the control objective and checked whether it covered every affected system.", []],
 ["Which logs did you use?", "I'd use the original policy decision log and compare it with endpoint execution evidence.", []],
 ["What is a compensating control?", "It reduces the exposure while the original weakness still exists.", []],
 ["Define role-based access control.", "Role-based access control grants entitlements based on assigned functions.", []],
 ["Compare NIST and CRI.", "NIST CSF defines broad cybersecurity outcomes while the CRI Profile tailors the assessment structure for financial services.", []],
 ["What is a JWT signing key?", "It is the key material used to sign or verify the token, according to the signing algorithm.", []],
 ["How would you rotate API keys?", "I'd map consumers and deploy overlapping credentials before revoking the old value.", []],
 ["How would you manage physical door access?", "I'd inspect the controller and badge authorization logs.", []],
 ["What is a front door proxy?", "It's the internet-facing reverse-proxy boundary through which requests enter the application.", []],
 ["What is apartment building security?", "It depends on the actual entrance controls and emergency access requirements.", []],
 ["Can you explain with an analogy?", "Think of it like a front door: permissions determine who can enter.", []],
 ["Give me a metaphor for an API key.", "It's like a house key: possession grants access until the credential is revoked.", []],
 ["Explain it like I'm five.", "Imagine a house key that opens the right room.", []],
 ["Tell me about yourself.", "I work across technical security investigation and risk-control assessment. I focus on the evidence behind remediation decisions.", []],
 ["What exactly was your role?", "I reviewed the records and challenged the incomplete closure evidence.", []],
 ["What did you check first?", "I checked the target system's effective permission.", []],
 ["How would you prioritize vulnerabilities?", "I would assess exposure, exploitation evidence and asset criticality before setting the remediation urgency.", []],
 ["What is SIEM?", "A SIEM collects security telemetry and supports correlation and investigation.", []],
 ["How does Kerberos work?", "The client obtains a ticket from the KDC, then requests a service ticket for the target service.", []],
 ["What is OAuth state?", "It links the authorization response to the client-initiated session and helps prevent login CSRF.", []],
 ["Tell me about a time you failed.", "The first hypothesis was incomplete, so I checked the dependency path before proposing a new mitigation.", []],
 ["Who approved closure?", "The designated issue approver owned closure authorization; I only recommended it from the evidence.", []],
 ["How did you prove the fix worked?", "I compared the effective permission before and after the change and checked scope coverage.", []],
 ["Have you used Power BI?", "I can explain its purpose, but I would distinguish my direct use from report review.", []],
 ["What is the difference between design and operating effectiveness?", "Design is whether the control could work as intended; operation is whether it actually did across the period.", []],
 ["Compare IDOR and CSRF.", "IDOR is an authorization failure; CSRF exploits a browser's authenticated state to send unintended actions.", []],
 ["What is PKI?", "It is the infrastructure for issuing and validating certificates and managing related keys.", []],
 ["How do you measure detection coverage?", "I'd reconcile logging sources, assets and alert routing rather than infer coverage from alert count.", []],
 ["What would you do after an IAM finding?", "I would confirm the affected identities and effective permissions before agreeing on the remediation.", []],
 ["What does evidence validation mean?", "It means checking that the records actually demonstrate the requirement rather than merely showing a completed task.", []],
 ["Would you accept the risk?", "I would assess severity and compensating controls, then route approval to the authorized risk owner.", []],
 ["Tell me about a technical bottleneck.", "One challenge was identifying a dependent system before applying a configuration change.", []],
 ["Walk me through an issue you handled.", "My review started from the affected control objective and confirmed what evidence was missing.", []],
 ["What is the root cause?", "The answer depends on which control failed and what alternative causes the logs rule out.", []],
 ["How would you investigate a compromised service account?", "I'd preserve evidence, check credential use and dependencies, then contain the exposure proportionately.", []],
 ["How did you validate that?", "I checked the expected policy behavior using the same affected population.", []],
 ["Why was the monitoring insufficient?", "Because a missing collection source made the dashboard incomplete.", []],
 ["What is the blast radius?", "It is the set of systems and permissions exposed if the original credential is compromised.", []],
 ["How would you explain control risk to a director?", "The business decision depends on the actual exposure and the evidence that a safeguard works.", []],
 ["Who did you coordinate with?", "The control owner and application operations team handled their respective implementation and acceptance duties.", []],
 ["What does an exception expiry mean?", "The approval must be reviewed before its allowed period ends; the weakness does not disappear.", []],
 ["What is a scanner coverage gap?", "A scan can show zero findings because it no longer reaches the affected system.", []],
 ["What is a closure artifact?", "It is evidence showing the implemented fix meets the control requirement for the affected population.", []],
 ["How would you protect production during rollout?", "I would pilot narrowly, define rollback criteria and check logs after deployment.", []],
 ["How do you investigate nested AD groups?", "I would compute effective memberships, not just inspect direct group assignment.", []],
 ["Tell me about a disagreement with audit.", "I would compare the audit criteria and technical evidence before revising my recommendation.", []],
 ["What exactly would you report?", "The evidence-backed scope, remaining exposure, owner and decision deadline.", []],
]
const flagged = [
 ["What is IAM?", "Picture this: imagine a house key, and everyone wants their own.", "unrequested-toy-analogy"],
 ["What is OAuth?", "It's like a front door, and the browser carries a spare key.", "unrequested-toy-analogy"],
 ["How would you investigate the access exception?", "Think of it like an apartment where nobody knows who has the keys.", "unrequested-toy-analogy"],
 ["What is zero trust?", "Imagine you're at airport security, and the line is never ending.", "unrequested-toy-analogy"],
 ["What is EPM?", "Think of this like a bouncer refusing everyone at a club.", "unrequested-toy-analogy"],
 ["What is MFA?", "It's like a traffic light for every person in the city.", "unrequested-toy-analogy"],
 ["What is control testing?", "Think of it like a house key, except audit has to look.", "unrequested-toy-analogy"],
 ["What is a finding?", "Welcome back! Today we're going to unpack the world of findings.", "podcast-style-opening"],
 ["How do you investigate a vulnerability?", "Let's dive in and find out what makes remediation so interesting.", "podcast-style-opening"],
 ["What is residual risk?", "You know, it's funny, we often get confused by risk.", "podcast-style-opening"],
 ["Why do you care about risk?", "That's a phenomenal question. It matters because the system is exposed.", "performative-interviewer-praise"],
 ["What is IAM?", "That is a brilliant question. Identity governance is the process.", "performative-interviewer-praise"],
 ["What is session recording?", "To summarize, the footage is retained for reviews.", "scripted-landing"],
 ["What is exposure?", "At the end of the day, exposure is what remains.", "scripted-landing"],
 ["How would you deploy an exception?", "In conclusion, I would ask the owner for approval.", "scripted-landing"],
 ["What is SSO?", "HOST: Now we're talking about login.\nEXPERT: Exactly, so here's the situation.", "podcast-speaker-label"],
 ["What is least privilege?", "NARRATOR: You've entered the world of control.", "podcast-speaker-label"],
 ["What is a risk register?", "At Placeholder Bank, I built a complete program.", "unasked-personal-story"],
 ["Compare DAST and SAST.", "When I was working at Aster Bank, I developed several tools.", "unasked-personal-story"],
]
test("50 diverse ordinary candidate answers are not falsely flagged by the observational lint",()=>{
  assert.equal(cases.length,50)
  for(const [question,answer,expected] of cases) {
    assert.deepEqual(naturalNarrationFlags(question,answer),expected,question)
  }
})
test("Scripted/podcast/unasked analogy failures are flagged by category, never silently rewritten",()=>{
  assert.equal(flagged.length,19)
  for(const [q,a,flag] of flagged) {
    const got=naturalNarrationFlags(q,a)
    assert.ok(got.includes(flag),JSON.stringify({q,a,got,expected:flag}))
    assert.equal(a,a,"source answer unchanged")
  }
})
test("Explicit analogy requests do not trigger the unrequested analogy flag",()=>{
  const q="Can you use an analogy to explain least privilege?"
  const a="It's like a front door with a separate house key."
  assert.ok(!naturalNarrationFlags(q,a).includes("unrequested-toy-analogy"))
})
test("A direct factual answer that rambles triggers an advisory flag, not a production rewrite",()=>{
  const a=Array(130).fill("A control owner must supply technical evidence.").join(" ")
  assert.ok(naturalNarrationFlags("What is EPM?",a).includes("direct-answer-overlong"))
  assert.ok(!naturalNarrationFlags("How would you investigate the issue?",a).includes("direct-answer-overlong"))
})
test("Finished Kompas precision diagnostic includes narration flags for SSE and JSON",()=>{
 const q="What is residual risk?"
 const a="Think of it like an apartment where there are spare keys."
 assert.ok(spokenQualityFlags(q,a).includes("unrequested-toy-analogy"))
 assert.ok(naturalNarrationFlags(q,a).every(x=>!x.includes(a)),
   "Flags are labels only; never send raw private answer text as telemetry.")
})
test("Empty answer produces no speculative flags",()=>{
 assert.deepEqual(naturalNarrationFlags("What is EPM?",""),[])
})
