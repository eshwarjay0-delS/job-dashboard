import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../kompas-voice-quality.mjs';
const clip=(reference,hypothesis,more={})=>({consented:true,reference,hypothesis,...more});
test('latency percentiles are measured',()=>{
 const r=score([100,200,300,400,500].map(latencyMs=>clip('yes','yes',{latencyMs})));
 assert.equal(r.p50LatencyMs,300);assert.equal(r.p95LatencyMs,500);
});
test('silence hallucination is reported',()=>{
 const r=score([clip('','invented words')]);
 assert.equal(r.silenceFalsePositiveRate,1);
});
test('consent required',()=>{
 assert.throws(()=>score([{reference:'yes',hypothesis:'yes'}]),/consent/);
});
