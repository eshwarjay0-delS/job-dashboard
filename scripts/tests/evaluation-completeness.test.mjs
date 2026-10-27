import test from 'node:test'
import assert from 'node:assert/strict'
import {captureSummary} from '../lib/evaluation-completeness.mjs'
const cases=[{id:'a'},{id:'b'}]
const answer=id=>({id,text:'answer',meta:{model:'synthetic'}})
test('complete capture still leaves quality unverified',()=>assert.deepEqual(captureSummary(cases,cases.map(c=>answer(c.id))),{status:'capture-complete',expected:2,captured:2,quality:'unverified'}))
test('partial duplicate unknown failed and empty captures cannot complete',()=>{
 for(const rows of [[],[answer('a')],[answer('a'),answer('a')],[answer('a'),answer('x')],[answer('a'),{...answer('b'),status:'failed'}],[answer('a'),{...answer('b'),text:' '}],[answer('a'),answer('b'),{stage:'preflight',status:'failed'}]]) assert.equal(captureSummary(cases,rows).status,'capture-incomplete')
})
test('invalid fixture is rejected',()=>{assert.throws(()=>captureSummary([],[]));assert.throws(()=>captureSummary([{id:'a'},{id:'a'}],[]))})
