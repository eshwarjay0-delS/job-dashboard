import test from "node:test"
import assert from "node:assert/strict"
import {readFileSync} from "node:fs"
import vm from "node:vm"

const src=readFileSync(new URL("../../public/kompas/app.js",import.meta.url),"utf8")
const begin=src.indexOf("function preserveSpokenQuestion(")
const end=src.indexOf("function lastAsk(",begin)
assert.ok(begin>=0 && end>begin,"question preservation helper must exist")
const box=vm.createContext({})
vm.runInContext(src.slice(begin,end)+"\nthis.preserve = preserveSpokenQuestion;",box)
const keep=(full,derived)=>box.preserve(full,derived)

const long=[
  ["For this production bank application, explain what you would first investigate when the identity governance ticket says removal was successful but the user can still sign in to the target application.","What would you investigate?"],
  ["Can you describe your approach to handling a large-scale endpoint privilege removal when the software estate includes legacy internal tools and teams cannot tell which binaries require elevation?","Which binaries require elevation?"],
  ["Before we talk about implementation, please explain the full architecture of a SIEM in a financial environment, including ingestion pipelines, parsing, correlation and what would make the resulting alert actionable.","What makes an alert actionable?"],
  ["Talk about a time your team found a control issue where the first remediation looked successful but the same problem appeared on a different server during the monthly production audit cycle.","What happened during the audit cycle?"],
  ["We already discussed the vulnerability scanner, but I want to know the specific evidence you would use to prove the complete affected population was patched rather than just the first asset in the ticket.","How do you prove it was patched?"],
  ["Imagine we have a critical banking service that cannot be restarted on a settlement day and must still satisfy access-control policy; describe the alternative controls and whose authority is needed.","Whose authority is needed?"],
  ["I want you to explain the underlying technical mechanism of OAuth state, what it protects against in a browser login callback and how you would validate the implementation.","How would you validate it?"],
  ["Describe the precise troubleshooting order you would use after a developer requests temporary elevation for an internal unsigned utility that has a new release version and a different parent process.","What parent process?"],
  ["Suppose the CTO asks why the risk metric looks better despite five high-risk remediation tasks having no evidence and there is a material inconsistency in the reporting data.","Why did the metric look better?"],
  ["Explain how you would distinguish a failed token refresh in the installed Windows app from a problem with the server session and what you would preserve while a long meeting is running.","What would you preserve?"],
  ["In this case the application owner says the access review was already certified but the account belongs to nested groups with privileged delegated rights not shown by the report.","What rights were not shown?"],
  ["I would like you to discuss the design of just-in-time access with an approval workflow, timeout, identity mapping and a concrete mechanism for ensuring the privileges are revoked afterward.","How are privileges revoked afterward?"],
  ["Walk through what you would inspect on the endpoint when a normally trusted application starts launching an unsigned child process in a way that bypasses your previous application-control exception.","What exception was bypassed?"],
  ["Can you explain what you did in the scenario where an exception kept getting extended after its formal expiry and your team could not identify its actual risk owner or operating controls?","Who was the risk owner?"],
  ["In a real production incident, if the SOC reports zero privileged events but the organization has not deployed a logging source across all the critical applications, what would you verify first?","What would you verify first?"],
  ["Describe the full situation that caused the company to revise onboarding after one unattended dependency blocked a service-account rotation even though the initial automated task had succeeded.","Why did rotation fail?"],
  ["Suppose we start with one user who has an entitlement directly through the application as well as a separately inherited directory group, and both can grant the same privileged operation.","What granted the operation?"],
  ["In a system that captures computer audio and microphone speech simultaneously, how would you separate the actual interviewer from duplicated echo so that the original long question stays together?","How does the question stay together?"],
  ["After quitting and reopening the desktop, you continue the same unfinished interview session, and then the interviewer asks a detailed question with several conditions, which are in the recorded transcript.","Which conditions are in the transcript?"],
  ["During a technical interview, the person asks you to describe the control objective, who owned each action, exactly what artifact you personally produced, and what proved that remediation worked in practice.","What proved the remediation worked?"],
]

test("Twenty varied long-question tails retain all originally captured context",()=>{
  assert.equal(long.length,20)
  for(const [source,derived] of long)assert.equal(keep(source,derived),source,derived)
})
test("Direct short questions and faithful derivations are not rewritten",()=>{
  assert.equal(keep("What is IAM?","What is IAM?"),"What is IAM?")
  assert.equal(keep("What is IAM?","Define identity and access management."),"Define identity and access management.")
  assert.equal(keep("","How would you verify?"),"How would you verify?")
  assert.equal(keep("Short question",""),"Short question")
  assert.equal(keep("Explain how OAuth state prevents CSRF attacks.","Explain how OAuth state prevents CSRF attacks."),"Explain how OAuth state prevents CSRF attacks.")
})
test("Full question persists through source, derive and SSE update, not only initial card render",()=>{
  assert.match(src,/card\.singleSpokenTurn\s*=\s*heardOnly/)
  assert.match(src,/card\.fullSpokenQuestion\s*=\s*heardOnly/)
  assert.match(src,/derivedQ = card\.singleSpokenTurn \? preserveSpokenQuestion\(card\.fullSpokenQuestion, dj\.derived\)/)
  assert.match(src,/displayQ = card\.singleSpokenTurn \? preserveSpokenQuestion\(card\.fullSpokenQuestion, ev\.derived\)/)
  assert.match(src,/page\.singleSpokenTurn = cur\.singleSpokenTurn/)
  assert.match(src,/page\.fullSpokenQuestion = cur\.fullSpokenQuestion/)
  assert.match(src,/page\.singleSpokenTurn = c\.singleSpokenTurn/)
  assert.match(src,/page\.fullSpokenQuestion = c\.fullSpokenQuestion/)
})
test("Continue and cold relaunch persist and restore the source question with the card",()=>{
  assert.match(src,/JSON\.stringify\(cards,/)
  assert.match(src,/cards = snap\.cards/)
  assert.match(src,/if \(opts\.resume\) restoreLive\(s\)/)
  // The card's full source question isn't listed as transient or removed.
  const ephemeral=src.slice(src.indexOf("const CARD_TRANSIENT"),src.indexOf("let liveSavedAt"))
  assert.ok(!ephemeral.includes("fullSpokenQuestion"))
  assert.ok(!ephemeral.includes("singleSpokenTurn"))
})
