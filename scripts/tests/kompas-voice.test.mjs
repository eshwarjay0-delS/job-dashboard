import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { patchKompasVoice } from '../patch-kompas-voice.mjs';
const source = await readFile(new URL('../../public/kompas/app.js', import.meta.url), 'utf8');
function section(start, end) { return source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start))); }
function env(extra = {}) {
 const state = { entries: [], errors: [], current: { id: 'one', role: 'Security', voiceVocabulary: ['CyberArk'] }, transcriptionEpoch: 0, transcriptionOrder: Promise.resolve(), interimOffUntil: 0, running: true, performance, AbortController, setTimeout, clearTimeout, Blob, ...extra };
 state.status = m => state.errors.push(m);
 state.onTranscript = (who, text) => state.entries.push({ who, text });
 state.showCaption = () => {};
 vm.createContext(state);
 vm.runInContext(section('function whisperPrompt()', '// Owner, 2026-09-30'), state);
 vm.runInContext(section('async function transcribe(', '/* ---- what was heard'), state);
 return state;
}
test('keeps short answers and rejects empty/noise-only transcripts', () => {
 const s = env();
 for (const text of ['Yes.', 'No.', 'Okay', 'Thank you', 'You']) assert.equal(s.cleanTranscript(text), text);
 for (const text of ['', '...', '[Music]', '(silence)']) assert.equal(s.cleanTranscript(text), '');
});
test('rebuilds Whisper vocabulary after corrections without stale cache', () => {
 const s = env(); assert.match(s.whisperPrompt(), /CyberArk/);
 s.current.voiceVocabulary.push('Janjirala'); assert.match(s.whisperPrompt(), /Janjirala/);
 s.current = {id: 'two'}; assert.doesNotMatch(s.whisperPrompt(), /Janjirala/);
});
test('commits concurrent transcriptions in capture order', async () => {
 const pending = []; const s = env({fetch: () => new Promise(r => pending.push(r))});
 const a = s.transcribe(new Blob(['a']), 'Them', {final:true});
 const b = s.transcribe(new Blob(['b']), 'Them', {final:true});
 pending[1]({ok:true, json:async()=>({text:'Second phrase'})});
 await Promise.resolve(); assert.equal(s.entries.length, 0);
 pending[0]({ok:true, json:async()=>({text:'First phrase'})});
 await Promise.all([a,b]); assert.deepEqual(s.entries.map(e=>e.text), ['First phrase','Second phrase']);
});
test('discards a response after switching sessions', async () => {
 let resolve; const s = env({fetch: () => new Promise(r=>resolve=r)});
 const p = s.transcribe(new Blob(['a']), 'You', {final:true});
 s.transcriptionEpoch++; resolve({ok:true,json:async()=>({text:'Old session'})});
 await p; assert.equal(s.entries.length,0);
});
test('failed request does not block the next phrase and reports the loss', async () => {
 let n=0; const s=env({fetch:async()=>++n===1?{ok:false,status:429}:{ok:true,json:async()=>({text:'Recovered phrase'})}});
 await Promise.all([s.transcribe(new Blob(['a']),'You',{final:true}),s.transcribe(new Blob(['b']),'You',{final:true})]);
 assert.equal(s.entries[0].text,'Recovered phrase'); assert.match(s.errors[0],/not transcribed/);
});
test('stop flushes final recorder data without restarting it', async () => {
 const s=env({VAD:{MIN_SPEECH_MS:280}, finals:new Set(), startSegment:()=>{throw Error('must not restart');}, transcribe:undefined});
 const sent=[]; s.transcribe=async(blob,who)=>sent.push({size:blob.size,who});
 vm.runInContext(section('function endSegment(', '// AI Answer pressed'),s);
 const chunks=[];
 const rec={mimeType:'audio/webm',stop(){chunks.push(new Blob(['tail']));this.onstop();}};
 await s.endSegment({rec,chunks,speechMs:400,who:'You',stopped:true},true,false);
 assert.equal(sent.length,1); assert.equal(sent[0].size,4);
});
test('sync patch is idempotent and fails on unknown upstream source',()=>{
 assert.equal(patchKompasVoice(source),source);
 assert.throws(()=>patchKompasVoice('unknown upstream'),/needs review/);
});

test('permission result from a stopped capture cannot attach after restart', async () => {
 let released = 0;
 const s = env({ sourceGeneration: {You: 2}, srcOn: {mic:true}, captures: [], getCtx: () => { throw Error('stale source must not initialize audio'); } });
 vm.runInContext(section('async function attachSource(', 'function stopSource('), s);
 await s.attachSource({getTracks:()=>[{stop:()=>released++}]}, 'You', null, 1);
 assert.equal(released, 1);
});
test('stop during audio initialization releases microphone and shared video', async () => {
 let ready, released = 0;
 const track = {stop:()=>released++};
 const s = env({ sourceGeneration: {Them:0}, srcOn: {sys:true}, captures: [], getCtx: () => new Promise(resolve=>{ready=resolve;}) });
 vm.runInContext(section('async function attachSource(', 'function stopSource('), s);
 const attaching = s.attachSource({getTracks:()=>[track]}, 'Them', {getTracks:()=>[track,track]}, 0);
 s.running = false;
 ready({createMediaStreamSource:()=>{throw Error('stopped capture must not attach');}});
 await attaching;
 assert.equal(released, 3);
});
