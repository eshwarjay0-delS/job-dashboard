import test from 'node:test'
import assert from 'node:assert/strict'
import {ANGLES,normLedger,pickAngle,commit,pickProject} from '../../src/lib/kompasAnswer.ts'
test('60 turns rotate every angle without consecutive repetition',()=>{
 const ledger=normLedger(null), picks=[]
 for(let i=0;i<60;i++){const a=pickAngle(ledger);picks.push(a);commit(ledger,'p',a,'',2)}
 for(let i=0;i<60;i++) assert.equal(picks[i],ANGLES[i%ANGLES.length])
})
test('source changes cannot reuse an absent drilldown project',()=>{
 const ledger=normLedger({last_project:'old'})
 assert.equal(pickProject('endpoint',3,ledger,[{id:'new',title:'Endpoint',terms:'endpoint',bottlenecks:[]}]).id,'new')
 ledger.last_project='new'
 assert.equal(pickProject('endpoint',3,ledger,[{id:'new',title:'Endpoint',terms:'endpoint',bottlenecks:[]}]).reason,'drill-down: holding previous project')
})
