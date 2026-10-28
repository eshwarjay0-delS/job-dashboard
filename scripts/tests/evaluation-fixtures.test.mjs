import test from 'node:test'
import assert from 'node:assert/strict'
import {fixtureName,caseInput} from '../lib/evaluation-fixtures.mjs'
test('selector keeps baseline default and rejects arbitrary paths',()=>{assert.equal(fixtureName(),'interview-50');assert.throws(()=>fixtureName('../other'))})
test('dependent acceptance cases require reviewed history before execution',()=>{const c={id:'x',category:'drilldown'},s={x:{resume:'r',jd:'j'}};assert.throws(()=>caseInput(c,s,'intent-acceptance-v1'));s.x.history=[{q:'q',a:'a'}];assert.equal(caseInput(c,s,'intent-acceptance-v1').history.length,1)})
test('isolated acceptance cases reject unrelated history rather than silently discard it',()=>{assert.throws(()=>caseInput({id:'x',category:'definition'},{x:{resume:'r',jd:'j',history:[{q:'q',a:'a'}]}},'intent-acceptance-v1'),/Isolated case/);const v=caseInput({id:'x',category:'definition'},{x:{resume:'r',jd:'j',level:'wrong'}},'intent-acceptance-v1');assert.deepEqual(v.history,[]);assert.deepEqual(v.config,{resume:'r',jd:'j'})})

test('isolated acceptance cases also reject ledger-only context leakage',()=>{assert.throws(()=>caseInput({id:'x',category:'definition'},{x:{resume:'r',jd:'j',ledger:{previous:'answer'}}},'intent-acceptance-v1'),/Isolated case/)})
