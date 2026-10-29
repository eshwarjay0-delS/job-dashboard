import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {rediscoverRelevance,relevanceRecoveryPrompt} from '../../src/lib/kompasRelevanceRecovery.ts'
const questions=JSON.parse(readFileSync(new URL('../fixtures/kompas-50fold-intents.json',import.meta.url),'utf8'))
test('All one hundred asks keep current intent and cannot import historical keywords',()=>{
 assert.equal(questions.length,100)
 for(const c of questions){
  const p=rediscoverRelevance(c.question,'Them: Tell me how CyberArk PSM, DCSync and SQL injection work.\nYou: I know Burp Suite.\n')
  assert.equal(p.intent,c.intent,'case '+c.id+': '+c.question)
  assert.equal(p.currentAsk,c.question)
  assert.equal(p.requestedTopics.includes('DCSync'),false)
  assert.equal(p.contextRelation,c.intent==='follow-up'?'follow-up':'none','case '+c.id+' must resolve history only for a true follow-up')
  assert.match(relevanceRecoveryPrompt(c.question),/Does sentence one answer the current request/)
 }
})
for(let fold=1;fold<=questions.length;fold++){
 test('Rediscovery fold '+String(fold).padStart(3,'0')+'/'+questions.length+' cumulative',()=>{
  for(const item of questions.slice(0,fold)){
   const r=rediscoverRelevance(item.question)
   assert.equal(r.intent,item.intent,'fold '+fold+', case '+item.id)
   assert.ok(r.excludedMoves.length>=2)
   assert.ok(['confirm','describe','compare','ask','decide','explain','demonstrate'].includes(r.answerMode))
   if(item.intent==='value'||item.intent==='closing-question'||item.intent==='acknowledgement')
    assert.ok(r.excludedMoves.some(x=>/Do not import a generated project/.test(x)))
   if(item.intent==='scenario')
    assert.equal(r.evidencePolicy,'hypothetical-only')
  }
 })
}
test('Elliptical follow-up may recover last INTERVIEWER subject, never random earlier technical background',()=>{
 const history='Them: Tell me about the policy exception approval process.\nYou: I would check documented controls and expiry.\n'
 const q='How did you verify that?'
 const r=rediscoverRelevance(q,history)
 assert.equal(r.intent,'follow-up')
 assert.equal(r.contextRelation,'follow-up')
 assert.match(r.contextSubject,/policy exception approval process/)
 assert.doesNotMatch(r.contextSubject,/I would check/)
})
test('An unrelated earlier experience cannot be treated as a new answer requirement',()=>{
 const history='Them: How did you remediate Kerberos issues?\nYou: I checked the Windows log.\n'
 const r=rediscoverRelevance('What would you bring to this team?',history)
 assert.equal(r.intent,'value')
 assert.equal(r.contextSubject,'')
 assert.deepEqual(r.requestedTopics,[])
})
test('Compound BNY issue review questions preserve user-named components in human phrasing',()=>{
 const r=rediscoverRelevance('How do you assess business impact, root cause, compensating controls, and residual risk?')
 assert.deepEqual(r.requestedTopics,['business impact','root cause','compensating controls','residual risk'])
 assert.equal(r.answerMode,'describe')
})
test('Technical mechanics asked directly are allowed depth, without invented project history',()=>{
 const r=rediscoverRelevance('How does TLS work with PKI?')
 assert.deepEqual(r.requestedTopics,['TLS','PKI'])
 assert.equal(r.evidencePolicy,'no-personal-story')
})
test('Soft manager comments are not treated as a cybersecurity assessment',()=>{
 const r=rediscoverRelevance('You will work with all 27 cybersecurity control leads, and each has their team. Right?')
 assert.equal(r.intent,'acknowledgement')
 assert.equal(r.answerMode,'confirm')
 assert.ok(r.excludedMoves.some(x=>/not demanding an architecture proposal/.test(x)))
})
test('Live service actually uses rediscovery in both prompt paths',()=>{
 const s=readFileSync(new URL('../../src/lib/kompasAnswerService.ts',import.meta.url),'utf8')
 assert.match(s,/rediscovered = rediscoverRelevance\(originalTurnAsk, history\)/)
 assert.equal((s.match(/relevanceRecoveryPrompt\(originalAsk, history\)/g)||[]).length,1,'preserve setup constraints once while answering only the extracted ask')
 assert.match(s,/const originalAsk = originalTurnAsk/)
 assert.match(s,/classify\(rediscovered\.currentAsk \|\| question\)/)
 assert.match(s,/canonicalQuestion\(rediscovered\.currentAsk \|\| question, tier\)/)
 assert.match(s,/const storyMode = rediscovered\.intent === "experience-story"/)
})

test('Closing question is recovered from a long interviewer explanation',()=>{
 const q='We have 27 security control leads and you will work across the teams. The first ninety days are about learning. So what questions do you have from me about the role?'
 const r=rediscoverRelevance(q)
 assert.equal(r.intent,'closing-question')
 assert.ok(r.currentAsk.startsWith('what questions'))
 assert.deepEqual(r.requestedTopics,[])
 assert.equal(r.answerMode,'ask')
})
