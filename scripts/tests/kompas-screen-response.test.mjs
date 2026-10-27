import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync('public/kompas/app.js','utf8')
const code=source.slice(source.indexOf('async function analyseScreen()'),source.indexOf('/* ---- Follow along:'))
async function run(response, captureError) {
 const card={}, requests=[]
 const context=vm.createContext({current:{id:"session-a"},aiBusy:false, aiBusySince:0, AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=>{if(captureError)throw captureError;return 'data:image/jpeg;base64,fixture'},fetch:async(url,init)=>{requests.push({url,body:JSON.parse(init.body)});return response},slimPrep:()=>({role:'security'}),liveConfig:()=>({level:'technical'}),cards:[card],idx:0})
 vm.runInContext(code,context);await context.analyseScreen();return {card,requests}
}
for(const status of [401,403,429,500,503]) test(`screen HTTP ${status} is a visible failure, not an answer`,async()=>{
 const {card}=await run({ok:false,json:async()=>({error:`Failure ${status}`})})
 assert.match(String(card.answer),new RegExp(`Failure ${status}`));assert.equal(card.streaming,false)
})
for(const text of ['', '   ', null]) test(`empty screen answer ${JSON.stringify(text)} is rejected`,async()=>{
 const {card}=await run({ok:true,json:async()=>({text})});assert.match(String(card.answer),/No screen answer/);assert.equal(card.streaming,false)
})
test('capture cancellation sends no frame',async()=>{const e=new Error('cancel');e.name='NotAllowedError';const {card,requests}=await run(null,e);assert.equal(requests.length,0);assert.match(String(card.answer),/share was cancelled/);assert.equal(card.streaming,false)})
test('successful answer carries capture, preparation and configuration together',async()=>{
 const {card,requests}=await run({ok:true,json:async()=>({question:'Explain the diagram',text:'Inspect the trust boundaries.'})});assert.equal(requests.length,1);assert.equal(requests[0].body.image,'data:image/jpeg;base64,fixture');assert.equal(requests[0].body.prep.role,'security');assert.equal(requests[0].body.config.level,'technical');assert.equal(card.answer,'Inspect the trust boundaries.');assert.equal(card.streaming,false)
})
test('extracted screen question uses the existing answer engine exactly once',async()=>{
 const card={},answers=[]
 const ctx=vm.createContext({current:{id:"session-a"},aiBusy:false, aiBusySince:0, AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=> 'frame',fetch:async()=>({ok:true,json:async()=>({question:'Explain this code',needsAnswer:true})}),slimPrep:()=>({}),liveConfig:()=>({}),cards:[card],idx:0,generateAnswer:async(q,c,opts)=>{answers.push({q,opts});c.answer='Grounded answer';c.streaming=false;c.meta='answer timing'}})
 vm.runInContext(code,ctx);await ctx.analyseScreen();assert.equal(answers.length,1);assert.equal(answers[0].q,'Explain this code');assert.equal(answers[0].opts.pinned,true);assert.equal(card.answer,'Grounded answer');assert.equal(card.meta,'answer timing')
})
test('a second screen click cannot interrupt the pending answer',async()=>{
 let calls=0;const ctx=vm.createContext({current:{id:"session-a"},aiBusy:true,status:()=>{},addCard:()=>{calls++}});vm.runInContext(code,ctx);await ctx.analyseScreen();assert.equal(calls,0)
})
for(const scenario of ['play error','ended track','zero dimensions','missing canvas','success'])test(`capture cleanup: ${scenario}`,async()=>{
 let paused=false, drawn=false
 const track={readyState:scenario==='ended track'?'ended':'live'}
 const video={muted:false,playsInline:false,readyState:2,videoWidth:scenario==='zero dimensions'?0:1920,videoHeight:1080,play:async()=>{if(scenario==='play error')throw Error('play failed')},pause:()=>{paused=true}}
 const canvas={getContext:()=>scenario==='missing canvas'?null:{drawImage:()=>{drawn=true}},toDataURL:()=> 'frame'}
 const ctx=vm.createContext({displayVideo:track,navigator:{mediaDevices:{getDisplayMedia:async()=>({getVideoTracks:()=>[track]})}},document:{createElement:t=>t==='video'?video:canvas},MediaStream:class{},setTimeout})
 vm.runInContext(source.slice(source.indexOf('async function grabFrame()'),source.indexOf('async function analyseScreen()')),ctx)
 if(scenario==='success'){assert.equal(await ctx.grabFrame(),'frame');assert.equal(drawn,true);assert.equal(canvas.width,1600);assert.equal(canvas.height,900)}else await assert.rejects(ctx.grabFrame())
 assert.equal(paused,true);assert.equal(video.srcObject,null)
})
for(const change of ['switch session','clear cards'])test(`${change} during extraction cannot answer with a different context`,async()=>{
 const card={};let answers=0,ctx
 ctx=vm.createContext({current:{id:'a'},aiBusy:false,aiBusySince:0,AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=> 'frame',fetch:async()=>{if(change==='switch session')ctx.current={id:'b'};else ctx.cards=[];return {ok:true,json:async()=>({needsAnswer:true,question:'Explain DNS'})}},slimPrep:()=>({}),liveConfig:()=>({}),cards:[card],idx:0,generateAnswer:async()=>{answers++}})
 vm.runInContext(code,ctx);await ctx.analyseScreen();assert.equal(answers,0);assert.equal(ctx.aiBusy,false);assert.match(String(card.answer),/Session changed/)
})
for(const action of ['collect','cancel','answer'])test(`region review action ${action} controls answer generation`,async()=>{
 const card={};let answers=0
 const ctx=vm.createContext({current:{id:'a'},aiBusy:false,aiBusySince:0,AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=> 'frame',fetch:async()=>({ok:true,json:async()=>({needsReview:true,tasks:[{question:'Which option?'}]})}),slimPrep:()=>({}),liveConfig:()=>({}),cards:[card],idx:0,window:{KompasScreenReview:async()=>({action,question:'Question 1: Which option? A: first B: second'})},generateAnswer:async(q,c,opts)=>{answers++;assert.equal(opts.source,'screen');assert.match(q,/A: first B: second/);c.streaming=false}})
 vm.runInContext(code,ctx);await ctx.analyseScreen();assert.equal(answers,action==='answer'?1:0);assert.equal(ctx.aiBusy,false)
})
test('an answer started during review is not aborted or unlocked by the screen flow',async()=>{
 const card={};let ctx,answers=0
 ctx=vm.createContext({current:{id:'a'},aiBusy:false,aiBusySince:0,AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=> 'frame',fetch:async()=>({ok:true,json:async()=>({needsReview:true,tasks:[{}]})}),slimPrep:()=>({}),liveConfig:()=>({}),cards:[card],idx:0,window:{KompasScreenReview:async()=>{ctx.aiBusy=true;return {action:'answer',question:'Complete question and options'}}},generateAnswer:async()=>{answers++}})
 vm.runInContext(code,ctx);await ctx.analyseScreen();assert.equal(answers,0);assert.equal(ctx.aiBusy,true);assert.equal(card.question,'Complete question and options');assert.equal(card.screenTask,true)
})
