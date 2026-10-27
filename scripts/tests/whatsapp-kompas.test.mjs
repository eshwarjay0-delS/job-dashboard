import test from 'node:test'
import assert from 'node:assert/strict'
import {kompasTransition as step} from '../../src/lib/whatsapp-kompas.ts'
const text=text=>({kind:'text',text})
test('ordinary MFit messages pass through; exact command enters Kompas',()=>{assert.equal(step(undefined,text('kompas engineer JD')).action,'tailor');assert.equal(step(undefined,text(' KOMPAS ')).state.mode,'kompas')})
test('resume and JD are collected before questions',()=>{let s=step(undefined,text('kompas')).state;s=step(s,text('resume source')).state;assert.equal(step(s,text('job source')).action,'setup');s=step(s,text('job source')).state;assert.equal(step(s,text('DNS')).question,'DNS')})
test('revert clears source state at every setup stage',()=>{for(const s of [undefined,{mode:'kompas',documents:[]},{mode:'kompas',resume:'private',jd:'job',documents:[]}])assert.deepEqual(step(s,text('revert')),{action:'revert',prompt:'Back to MFit resume tailoring.'})})
test('support documents remain separate and input state is unchanged',()=>{const s={mode:'kompas',documents:[]};const r=step(s,{kind:'document',role:'support',name:'notes',text:'source'});assert.equal(r.state.documents.length,1);assert.equal(s.documents.length,0);assert.equal(r.state.resume,undefined)})
