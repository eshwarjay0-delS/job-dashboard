import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../kompas-voice-quality.mjs';
const clip=(reference,hypothesis,more={})=>({consented:true,reference,hypothesis,...more});
test('technical terms count repeated occurrences',()=>{
 const r=score([clip('Sentinel and Sentinel','Sentinel and nothing',{technicalTerms:['Sentinel']})]);
 assert.equal(r.technicalTermRecall,0.5);
});
test('speaker accuracy and edit rate need observations',()=>{
 const r=score([clip('hi','hi')]);
 assert.equal(r.zeroEditRate,null);
 assert.equal(r.speakerAttributionAccuracy,null);
});
