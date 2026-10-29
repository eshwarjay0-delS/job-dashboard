import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { questionKernel } from "../../src/lib/kompasIntentKernel.ts"
import { rediscoverRelevance, relevanceRecoveryPrompt } from "../../src/lib/kompasRelevanceRecovery.ts"
import { namedQuestionTerms } from "../../src/lib/kompasRelevance.ts"

const cases=JSON.parse(readFileSync(new URL("../fixtures/kompas-54-intent-kernel.json",import.meta.url),"utf8"))
assert.equal(cases.length,54)
assert.equal(new Set(cases.map(c=>c.input)).size,54)

for(let fold=1;fold<=cases.length;fold++){
 test("Chief kernel cumulative fold "+String(fold).padStart(2,"0")+"/54",()=>{
  for(const c of cases.slice(0,fold)){
   const actual=questionKernel(c.input)
   const found=actual.ask.toLowerCase()
   assert.ok(found.includes(c.include.toLowerCase()),"case "+c.id+" answer kernel lost actual ask: "+actual.ask)
   if(c.exclude)assert.ok(!found.includes(c.exclude.toLowerCase()),"case "+c.id+" leaked extraneous setup: "+actual.ask)
   assert.ok(actual.ask.trim())
   assert.ok(actual.ask.length<=c.input.length)
   assert.equal(rediscoverRelevance(c.input).currentAsk,actual.ask)
  }
 })
}
test("Constraints from the same user turn are preserved as conditions, not achievements",()=>{
 const input="No production downtime is allowed. You must keep the original audit records. How would you verify access-remediation closure?"
 const k=questionKernel(input)
 assert.equal(k.ask,"How would you verify access-remediation closure?")
 assert.equal(k.constraints.length,2)
 assert.ok(k.constraints[0].includes("No production downtime"))
 assert.ok(k.constraints[1].includes("You must keep"))
 const contract=rediscoverRelevance(input)
 assert.equal(contract.constraints.length,2)
 assert.match(relevanceRecoveryPrompt(input),/Current-turn constraints/)
 assert.doesNotMatch(contract.currentAsk,/original audit records/)
})
test("An interrupted manager preface does not add unrelated security tools to a soft ask",()=>{
 const q="We run IAM, Azure Policy and ServiceNow GRC across 27 teams. We will coach you for the first 30 days. So what questions do you have about this role?"
 const c=rediscoverRelevance(q)
 assert.equal(c.intent,"closing-question")
 assert.match(c.currentAsk,/^what questions do you have/i)
 assert.deepEqual(c.requestedTopics,[])
 assert.equal(c.contextRelation,"none")
 assert.match(relevanceRecoveryPrompt(q),/Response action: ask/)
})
test("A question explicitly referring to preceding options keeps those current-turn choices",()=>{
 const q="We use NIST CSF, CRI Profile and NIST 800-53 in reviews. Which of those are you most familiar with?"
 const c=rediscoverRelevance(q)
 assert.equal(c.intent,"comparison")
 assert.equal(c.currentAsk,"Which of those are you most familiar with?")
 assert.deepEqual(c.requestedTopics,["NIST CSF","CRI Profile","NIST 800-53"])
})
test("An unrelated preface does not force every named setup term into the answer",()=>{
 const q="The team uses CyberArk, Splunk, Power BI and Qualys. What would you bring to the team?"
 const c=rediscoverRelevance(q)
 assert.equal(c.intent,"value")
 assert.deepEqual(c.requestedTopics,[])
 assert.ok(namedQuestionTerms(c.discardedSetup).includes("CyberArk"))
})
test("A compound question retains both genuine asks while dropping prior setup",()=>{
 const q="We want independent risk review. How would you validate the owner assessment? How would you explain remaining risk to the business?"
 const k=questionKernel(q)
 assert.match(k.ask,/How would you validate/)
 assert.match(k.ask,/How would you explain/)
 assert.doesNotMatch(k.ask,/want independent risk review/)
})
test("Do not reinterpret an interviewer statement ending in Right? as an implementation request",()=>{
 const q="You will work across all 27 control teams. Right?"
 const c=rediscoverRelevance(q)
 assert.equal(c.intent,"acknowledgement")
 assert.equal(c.requestedTopics.length,0)
 assert.equal(c.answerMode,"confirm")
})
test("Follow-up context is a relevant reference only, not evidence of previously performed work",()=>{
 const q="How did you verify that?"
 const history="Them: Tell me about a policy exception. \nYou: I invented a 98 percent risk reduction.\n"
 const c=rediscoverRelevance(q,history)
 assert.equal(c.intent,"follow-up")
 assert.equal(c.contextRelation,"follow-up")
 assert.match(c.contextSubject,/policy exception/)
 assert.doesNotMatch(c.contextSubject,/98 percent/)
 assert.equal(c.evidencePolicy,"no-personal-story")
})
test("The live answer service runs relevance recovery before building a user-facing answer",()=>{
 const s=readFileSync(new URL("../../src/lib/kompasAnswerService.ts",import.meta.url),"utf8")
 assert.match(s,/rediscoverRelevance\(question, history\)/)
 assert.match(s,/relevanceRecoveryPrompt\(question, history\)/)
 const kernel=readFileSync(new URL("../../src/lib/kompasRelevanceRecovery.ts",import.meta.url),"utf8")
 assert.match(kernel,/questionKernel\(question\)/)
})

test("Brief interviewer acknowledgments do not hijack a follow-up subject",()=>{
 const history="Them: Walk me through how you evaluated the policy exception.\\nYou: I checked source evidence.\\nThem: Great, makes sense.\\nThem: Okay.\\n"
 const context=rediscoverRelevance("How did you verify that?",history)
 assert.equal(context.intent,"follow-up")
 assert.match(context.contextSubject,/evaluated the policy exception/)
 assert.doesNotMatch(context.contextSubject,/Okay/)
})
