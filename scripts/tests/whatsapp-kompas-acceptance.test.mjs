import test from 'node:test'
import assert from 'node:assert/strict'
import {kompasTransition as step} from '../../src/lib/whatsapp-kompas.ts'
const t=text=>({kind:'text',text}), fresh=()=>step(undefined,t('kompas')).state
const ready=()=>({...fresh(),resume:'verified resume',jd:'job requirements'})
const doc=(role,text)=>({kind:'document',role,name:'source.docx',text})
test('01 ordinary JD stays in tailor',()=>assert.equal(step(undefined,t('Endpoint analyst JD')).action,'tailor'))
test('02 keyword matching is exact and case insensitive',()=>{assert.equal(step(undefined,t(' KOMPAS ')).state.mode,'kompas');assert.equal(step(undefined,t('kompas engineer')).action,'tailor')})
test('03 start cannot become the resume',()=>{assert.equal(step(fresh(),t('start')).state.resume,undefined)})
test('04 start cannot become the JD',()=>{assert.equal(step({...fresh(),resume:'resume'},t('start')).state.jd,undefined)})
test('05 resume then JD unlock questions',()=>{let s=step(fresh(),doc('resume','resume')).state;s=step(s,doc('jd','job')).state;assert.equal(step(s,t('DNS')).action,'answer')})
test('06 supporting documents do not replace resume or JD',()=>{const s=step(ready(),doc('support','notes')).state;assert.equal(s.resume,'verified resume');assert.equal(s.jd,'job requirements');assert.equal(s.documents[0].text,'notes')})
test('07 empty and oversized attachments rejected without mutation',()=>{const s=ready();for(const value of ['', 'x'.repeat(60001)])assert.equal(step(s,doc('support',value)).action,'reject');assert.equal(s.documents.length,0)})
test('08 oversized pasted sources rejected',()=>assert.equal(step(fresh(),t('x'.repeat(60001))).action,'reject'))
test('09 revert removes Kompas state at every stage',()=>{for(const s of [fresh(),{...fresh(),resume:'r'},ready()])assert.equal(step(s,t(' REVERT ')).state,undefined)})
test('10 two setup states do not share documents',()=>{const a=fresh(),b=fresh();step(a,doc('support','private'));assert.equal(b.documents.length,0);assert.equal(a.documents.length,0)})
test('attached JD uses the same limit as a pasted JD',()=>{assert.equal(step(fresh(),doc('jd','x'.repeat(8001))).action,'reject');assert.equal(step(fresh(),doc('jd','x'.repeat(8000))).action,'setup')})
test('support budget includes document names and separators so the engine drops no text',()=>{
 const s=ready();const first=step(s,{kind:'document',role:'support',name:'a',text:'x'.repeat(7995)})
 assert.equal(first.action,'setup')
 assert.equal(step(first.state,doc('support','one more')).action,'reject')
 assert.equal(first.state.documents.length,1)
})
