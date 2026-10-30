import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
const source=readFileSync('public/kompas/app.js','utf8')
const code=source.slice(source.indexOf('function stripScreenChrome'),source.indexOf('/* ---- Follow along:'))
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
 const canvas={getContext:()=>scenario==='missing canvas'?null:{drawImage:()=>{drawn=true},getImageData:()=>({data:Uint8ClampedArray.from([0,0,0,255,255,255,255,255])})},toDataURL:()=> 'frame'}
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
test('the card shows the screen question without the capture label', async () => {
  const card = {}
  const shown = 'Question 1 (free-text; unknown choice):\nExplain zero trust'
  const ctx = vm.createContext({ current: { id: 'a' }, aiBusy: false, aiBusySince: 0, AbortSignal, addCard: () => card, renderCard: () => {}, performance: { now: () => 0 }, grabFrame: async () => 'frame', fetch: async () => ({ ok: true, json: async () => ({ needsAnswer: true, question: shown }) }), slimPrep: () => ({}), liveConfig: () => ({}), cards: [card], idx: 0, generateAnswer: async (q) => { assert.equal(q, 'Explain zero trust'); card.streaming = false } })
  vm.runInContext(code, ctx)
  await ctx.analyseScreen()
  assert.equal(card.question, 'Explain zero trust')
})
test('a review payload answers directly without opening any dialog',async()=>{
 const card={};let answers=0, dialogCalls=0
 const ctx=vm.createContext({current:{id:'a'},aiBusy:false,aiBusySince:0,AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=> 'frame',fetch:async()=>({ok:true,json:async()=>({needsReview:true,tasks:[{question:'Which option?'}]})}),slimPrep:()=>({}),liveConfig:()=>({}),cards:[card],idx:0,window:{KompasScreenReview:async()=>{dialogCalls++;return {action:'answer',question:'Should never be used'}},KompasScreenCore:{format:tasks=>tasks.map(t=>t.question).join('\n\n')}},generateAnswer:async(q,c,opts)=>{answers++;assert.equal(opts.source,'screen');assert.match(q,/Which option\?/);c.streaming=false}})
 vm.runInContext(code,ctx);await ctx.analyseScreen();assert.equal(answers,1);assert.equal(dialogCalls,0);assert.equal(ctx.aiBusy,false);assert.equal(card.screenTask,true);assert.equal(card.question,'Which option?')
})
test('a review payload without the formatter still answers from question text',async()=>{
 const card={};const seen=[]
 const ctx=vm.createContext({current:{id:'a'},aiBusy:false,aiBusySince:0,AbortSignal,addCard:()=>card,renderCard:()=>{},performance:{now:()=>0},grabFrame:async()=> 'frame',fetch:async()=>({ok:true,json:async()=>({needsReview:true,tasks:[{question:'First?'},{question:'Second?'}]})}),slimPrep:()=>({}),liveConfig:()=>({}),cards:[card],idx:0,window:{},generateAnswer:async(q)=>{seen.push(q)}})
 vm.runInContext(code,ctx);await ctx.analyseScreen();assert.deepEqual(seen,['First?','Second?']);assert.equal(ctx.aiBusy,false)
})
test('two captured questions are answered separately and the options stay with their question', async () => {
  const cards = []
  const seen = []
  const shown = 'Question 1 (free-text; unknown choice):\nExplain zero trust\n\nQuestion 2 (mcq; single choice):\nWhat is IDOR?\nOptions:\nA: a missing check'
  const ctx = vm.createContext({ current: { id: 'a' }, aiBusy: false, aiBusySince: 0, AbortSignal, addCard: (q) => { const c = { question: q }; cards.push(c); return c }, renderCard: () => {}, performance: { now: () => 0 }, grabFrame: async () => 'frame', fetch: async () => ({ ok: true, json: async () => ({ needsAnswer: true, question: shown }) }), slimPrep: () => ({}), liveConfig: () => ({}), cards, idx: 0, generateAnswer: async (q, c, opts) => { seen.push({ q, pinned: opts.pinned, source: opts.source }); c.streaming = false } })
  vm.runInContext(code, ctx)
  await ctx.analyseScreen()
  assert.equal(seen.length, 2)
  assert.equal(seen[0].q, 'Explain zero trust')
  assert.equal(seen[0].pinned, true)
  assert.equal(seen[0].source, 'screen')
  assert.match(seen[1].q, /What is IDOR\?/)
  assert.match(seen[1].q, /A: a missing check/)
  assert.doesNotMatch(seen[0].q, /IDOR/)
  assert.doesNotMatch(seen[1].q, /zero trust/)
  assert.doesNotMatch(seen[1].q, /Question 2/)
})
