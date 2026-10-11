import test from 'node:test';
import assert from 'node:assert/strict';
import { score, evaluate } from '../kompas-voice-quality.mjs';
const clip=(reference,hypothesis,more={})=>({consented:true,reference,hypothesis,...more});
test('condition slices are aggregates',()=>{
 const r=evaluate([clip('azure sentinel','azure',{conditions:['quiet']})]);
 assert.equal(r.byCondition.quiet.clips,1);
 assert.equal(r.byCondition.quiet.deletionRate,0.5);
});
test('raw WER and normalized WER differ',()=>{
 const r=score([clip('Hello, World.','hello world')]);
 assert.equal(r.normalizedWer,0);assert.equal(r.rawWer,1);
});
test('insertion rate is not capped',()=>{
 const r=score([clip('yes','yes no maybe')]);
 assert.equal(r.normalizedWer,2);
});
