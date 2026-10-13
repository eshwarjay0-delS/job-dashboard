import test from 'node:test';
import assert from 'node:assert/strict';
import {RATE,PART_SECONDS,partsOf} from '../../src/app/dashboard/kompas/transcribe/audio.ts';
const cut=RATE*PART_SECONDS, total=RATE*51;
function covered(parts,n){let at=0;for(const p of parts){assert.equal(p.from,at);assert.ok(p.to>p.from);at=p.to}assert.equal(at,n)}
test('quiet interval near 25 seconds moves boundary without losing samples',()=>{
 const a=new Float32Array(total).fill(.1);a.fill(0,cut+1600,cut+4800);
 const p=partsOf(total,a);assert.ok(p[0].to>cut+1500&&p[0].to<cut+4800);covered(p,total);
});
test('continuous speech keeps the legacy fixed split',()=>{
 const p=partsOf(total,new Float32Array(total).fill(.1));assert.equal(p[0].to,cut);covered(p,total);
});
test('very quiet speech does not invent a better boundary',()=>{
 const p=partsOf(total,new Float32Array(total).fill(.0005));assert.equal(p[0].to,cut);covered(p,total);
});
test('missing or incomplete samples fall back without loss',()=>{
 for(const samples of [undefined,new Float32Array(cut)]){const p=partsOf(total,samples);assert.equal(p[0].to,cut);covered(p,total)}
});
test('a tiny tail is kept inside the previous part',()=>{
 const n=cut+RATE/5;const p=partsOf(n,new Float32Array(n));assert.equal(p.length,1);covered(p,n);
});
