import test from 'node:test';
import assert from 'node:assert/strict';
import { score } from '../kompas-voice-quality.mjs';
const clip=(reference,hypothesis,more={})=>({consented:true,reference,hypothesis,...more});
test('zero edit and speaker adjudication',()=>{
 const r=score([clip('one','one',{editCount:0,speakerCorrect:true}),clip('two','two',{editCount:2,speakerCorrect:false})]);
 assert.equal(r.zeroEditRate,0.5);assert.equal(r.speakerAttributionAccuracy,0.5);
});
test('Unicode text and raw spelling remain measurable',()=>{
 const r=score([clip('నాకు Azure తెలుసు और ठीक','నాకు Azure తెలుసు और ठीक')]);
 assert.equal(r.normalizedWer,0);
});
