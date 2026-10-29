import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { questionKernel } from "../../src/lib/kompasIntentKernel.ts"
import { interviewIntent,focusPlan,focusPrompt,tangentSignals } from "../../src/lib/kompasRelevance.ts"
import { rediscoverRelevance } from "../../src/lib/kompasRelevanceRecovery.ts"

const cases=JSON.parse(readFileSync(new URL("../fixtures/kompas-crossdomain-50.json",import.meta.url),"utf8"))
test("Fifty independent prompts cover multiple professional domains and every reply intent",()=>{
 assert.equal(cases.length,50)
 assert.equal(new Set(cases.map(c=>c.question.toLowerCase())).size,50)
 assert.ok(new Set(cases.map(c=>c.domain)).size>=9)
 const required=["introduction","value","experience-story","definition","comparison","scenario","technical-process","direct","logistics","follow-up","closing-question","acknowledgement"]
 for(const intent of required)assert.ok(cases.some(c=>c.intent===intent),intent+" has no fixture")
})
for(const c of cases){
 test("Cross-domain fold "+String(c.id).padStart(2,"0")+"/50 — "+c.domain+" / "+c.intent,()=>{
  const kernel=questionKernel(c.input)
  assert.equal(kernel.ask.trim().toLowerCase(),c.question.toLowerCase(),"current ask must win over interview setup")
  assert.equal(interviewIntent(c.question),c.intent,"question classifier")
  const recovered=rediscoverRelevance(c.input)
  assert.equal(recovered.currentAsk.toLowerCase(),c.question.toLowerCase())
  assert.equal(recovered.intent,c.intent,"recovery classifier")
  if(c.input!==c.question)assert.ok(recovered.discardedSetup,"preface must remain non-mandatory context")
  for(const tier of [0,2,3]) for(const level of ["engineer","director"]){
   const p=focusPlan(c.question,tier,level)
   assert.equal(p.intent,c.intent)
   assert.ok(p.minWords<=p.maxWords,"minimum exceeds ceiling")
   assert.ok(p.minWords>=0&&p.maxWords<=250,"bounded spoken answer")
   assert.match(focusPrompt(c.question,tier,level),/QUESTION-FIRST SCOPE/)
  }
 })
}
test("No fabricated experiences are required by scenario or definition prompts",()=>{
 for(const c of cases.filter(x=>["scenario","definition","technical-process"].includes(x.intent))){
  assert.notEqual(rediscoverRelevance(c.question).evidencePolicy,"source-supported-history")
 }
})
test("A soft interviewer question must not pull in an irrelevant attack inventory",()=>{
 assert.ok(tangentSignals("What would you bring to a QA team?","I used BloodHound, DCSync and Cobalt Strike.").length>=2)
 assert.deepEqual(tangentSignals("How does Kerberos authentication work?","Kerberos issues tickets; DCSync is unrelated."),[])
})
test("Comparison survives a verb such as 'explain' rather than becoming an architecture walkthrough",()=>{
 assert.equal(interviewIntent("Explain how OAuth and OIDC differ."),"comparison")
})
test("An explicit subject in a follow-up is taken from a previous interviewer turn, not AI-generated candidate claims",()=>{
 const history="Them: How did you validate that Salesforce Flow?\nYou: I invented a 95 percent speedup.\n"
 const r=rediscoverRelevance("How did you verify that?",history)
 assert.equal(r.intent,"follow-up")
 assert.equal(r.contextRelation,"follow-up")
 assert.match(r.contextSubject,/Salesforce Flow/)
 assert.doesNotMatch(r.contextSubject,/95 percent/)
})
test("Short definition stays short even at tier zero",()=>{
 const p=focusPlan("What is GMP?",0,"director")
 assert.ok(p.minWords<=p.maxWords)
 assert.ok(p.maxWords<=75)
})
