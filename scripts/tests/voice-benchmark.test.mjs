import test from 'node:test'
import assert from 'node:assert/strict'
import {words,editCounts,evaluate} from '../voice-benchmark.mjs'
const sample=(reference,hypothesis,extra={})=>({reference,hypothesis,...extra})
test('normalizes punctuation and case without changing words',()=>assert.deepEqual(words('Hello, AD!'),['hello','ad']))
test('perfect transcript has zero edits',()=>assert.deepEqual(editCounts('DNS is up','DNS is up'),{s:0,d:0,i:0,referenceWords:3,hypothesisWords:3}))
test('counts one deletion',()=>assert.equal(editCounts('alpha beta gamma','alpha gamma').d,1))
test('counts one insertion',()=>assert.equal(editCounts('alpha gamma','alpha beta gamma').i,1))
test('counts one substitution',()=>assert.equal(editCounts('alpha beta','alpha delta').s,1))
test('computes WER and deletion rate',()=>{const r=evaluate([sample('one two three','one three')]);assert.equal(r.wer,1/3);assert.equal(r.deletionRate,1/3)})
test('counts technical phrases only when reference contains them',()=>{const r=evaluate([sample('Azure Active Directory and DNS','Azure Directory and DNS',{technicalTerms:['Active Directory','DNS','Kerberos']})]);assert.equal(r.technicalTermRecall,.5);assert.equal(r.technicalTermsEvaluated,2)})
test('zero-edit rate is per utterance',()=>assert.equal(evaluate([sample('a','a'),sample('b','c')]).zeroEditRate,.5))
test('speaker labels evaluated at aligned turns',()=>assert.equal(evaluate([sample('a','a',{speakerReference:['mic','system'],speakerHypothesis:['mic','mic']})]).speakerAttributionAccuracy,.5))
test('latency percentiles are nearest rank',()=>{const r=evaluate([10,20,30,40,50].map(x=>sample('a','a',{latencyMs:x})));assert.equal(r.p50LatencyMs,30);assert.equal(r.p95LatencyMs,50)})
test('missing denominators are null, not invented accuracy',()=>{const r=evaluate([]);assert.equal(r.wer,null);assert.equal(r.technicalTermRecall,null);assert.equal(r.speakerAttributionAccuracy,null);assert.equal(r.p95LatencyMs,null)})
test('rejects invalid latency',()=>assert.throws(()=>evaluate([sample('a','a',{latencyMs:-1})]),RangeError))
