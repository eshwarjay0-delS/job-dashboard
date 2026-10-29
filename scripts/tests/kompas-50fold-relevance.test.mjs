import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {
 interviewIntent, focusPlan, focusPrompt, applyFocusBudget, tangentSignals
} from '../../src/lib/kompasRelevance.ts'

const cases=JSON.parse(readFileSync(new URL('../fixtures/kompas-50fold-intents.json',import.meta.url),'utf8'))
assert.equal(cases.length,50,'exactly fifty distinct interview prompts')
assert.equal(new Set(cases.map(x=>x.question.toLowerCase())).size,50,'no duplicate benchmark prompts')
const valid=new Set(['introduction','closing-question','acknowledgement','value','experience-story','comparison','definition','scenario','technical-process','logistics','follow-up','direct'])
for(let n=1;n<=cases.length;n++){
 test('Relevance fold '+String(n).padStart(2,'0')+' of 50 — cumulative question intent and scope',()=>{
   for(const {id,question,intent} of cases.slice(0,n)){
     assert.ok(valid.has(intent),'valid expected intent at '+id)
     const classified=interviewIntent(question)
     assert.equal(classified,intent,'intent should match the exact ask at fold '+id+': '+question)
     for(const level of ['engineer','director']){
      const p=focusPlan(question,2,level)
      assert.equal(p.intent,intent)
      assert.ok(p.maxWords >= p.minWords)
      assert.ok(p.maxWords <= 250,'bounded answer for '+intent)
      const words=applyFocusBudget(240,p)
      assert.ok(words<=p.maxWords,'cap respects exact question intent at '+id)
      assert.ok(words>=p.minWords)
      const prompt=focusPrompt(question,2,level)
      assert.match(prompt,/Never turn a short\/direct\/soft question into a technical architecture lecture/)
      assert.match(prompt,/the interviewer.s exact technical nouns/i)
     }
   }
 })
}
test('Soft closing question never becomes an unrelated technical lecture',()=>{
 const q='What questions do you have about our team?'
 const clean='Which control area is the biggest challenge right now, and what would success look like by day ninety?'
 const drift='I would use DCSync, Cobalt Strike, SQL injection, and a service mesh.'
 assert.deepEqual(tangentSignals(q,clean),[])
 assert.ok(tangentSignals(q,drift).length>=2)
 assert.equal(focusPlan(q,2,'director').technicalDepth,'surface')
})
test('A personal fit question with an advanced attack stack flags tangent risk',()=>{
 const q='What would you bring to this role?'
 const clean='I can independently challenge control assessments and make the remaining business risk clear.'
 const drift='I perform AS-REP roasting with BloodHound and then a reverse shell before the team approves anything.'
 assert.deepEqual(tangentSignals(q,clean),[])
 assert.ok(tangentSignals(q,drift).length>=2)
})
test('Technical drill-down can name specialized terms when asked',()=>{
 const q='Explain how Kerberoasting and DCSync differ technically.'
 const answer='Kerberoasting and DCSync rely on different permissions and attack paths.'
 assert.deepEqual(tangentSignals(q,answer),[])
 assert.equal(focusPlan(q,3,'engineer').intent,'comparison')
 assert.equal(focusPlan(q,3,'engineer').technicalDepth,'deep')
})
test('A manager statement produces a brief acknowledgement, not a story',()=>{
 const q='We have twenty seven control leads, and you will work across each of their teams.'
 assert.equal(interviewIntent(q),'acknowledgement')
 assert.ok(focusPlan(q,2,'director').maxWords<=65)
})
test('Follow-up remains a follow-up and retains room for the existing subject',()=>{
 for(const q of ['How did you verify that?','Why is that important?','Tell me more about that exception.']){
  assert.equal(interviewIntent(q),'follow-up')
  assert.equal(focusPlan(q,3,'director').technicalDepth,'asked-only')
 }
})
test('Direct terminology questions stay short across seniority levels',()=>{
 for(const q of ['What is least privilege?','What is NLA?','What does residual risk mean?']){
  assert.equal(interviewIntent(q),'definition')
  assert.ok(focusPlan(q,3,'director').maxWords<=75)
 }
})
test('The named role/company does not change the value of a direct preference',()=>{
 const q='Which framework are you stronger with, NIST CSF or the CRI Profile?'
 assert.equal(interviewIntent(q),'comparison')
 assert.match(focusPrompt(q,4,'director'),/Intent: comparison/)
 assert.ok(focusPlan(q,4,'director').maxWords<=100)
})
test('Code integration keeps answer scope and avoids forced random project rotation',()=>{
 const s=readFileSync(new URL('../../src/lib/kompasAnswerService.ts',import.meta.url),'utf8')
 assert.match(s,/focusPrompt\(question, tier, level\)/)
 assert.match(s,/applyFocusBudget\(plan\.words, focus\)/)
 assert.match(s,/const focus = focusPlan\(question, tier, level\)/)
 assert.match(s,/focus\.intent === "experience-story"/)
})
