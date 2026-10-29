import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRequire} from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const {NextRequest}=require('next/server')
const task=(question='Explain zero trust')=>({question,kind:'free-text',options:[],choiceMode:'unknown',complete:true,bounds:[0,0,1000,1000]})
const jpeg='data:image/jpeg;base64,/9j/AA=='
function harness(options={}) {
 const calls=[],ledger=[]
 const mocks={
  '@/lib/authBoundary':{authenticatedUser:async()=>options.auth===false?null:{id:'fixture'}},
  '@/lib/rateLimit':{checkRateLimit:()=>({ok:options.limited!==true})},
  '@/lib/llm':{keysFor:async()=>options.noKey?{}:{openrouter:'fixture-key'},resolveKeys:()=>({})},
  '@/lib/llmLedger':{scheduleLlmRecord:r=>ledger.push(r)},
 }
 function load(file){const module={exports:{}};vm.runInNewContext(ts.transpileModule(readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,Buffer,AbortSignal,process:{env:{}},fetch:async(url,init)=>{calls.push(JSON.parse(init.body));if(options.reject)throw Error('private provider data');return {ok:!options.status,status:options.status||200,json:async()=>options.data||{choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[task()]})}}],usage:{prompt_tokens:20,completion_tokens:10}}}},require:n=>mocks[n]||(n==='@/lib/kompasScreen'?load('src/lib/kompasScreen.ts'):require(n))});return module.exports}
 const {POST}=load('src/app/api/kompas/screen/route.ts')
 return {calls,ledger,post:body=>POST(new NextRequest('http://localhost/api/kompas/screen',{method:'POST',body:typeof body==='string'?body:JSON.stringify(body)}))}
}
for(const [name,opt,status] of [['unauthenticated',{auth:false},401],['rate limited',{limited:true},429],['disabled provider',{noKey:true},503]])test(name,async()=>{const h=harness(opt);assert.equal((await h.post({image:jpeg})).status,status);assert.equal(h.calls.length,0)})
for(const image of [null,'','https://example.com/a.png','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,AAAA', 'data:image/png;base64,/9j/AA=='])test(`reject invalid image ${image}`,async()=>{const h=harness();assert.equal((await h.post({image})).status,400);assert.equal(h.calls.length,0)})
for(const body of ['{', 'null', '[]'])test(`malformed or absent body ${body}`,async()=>{const h=harness();assert.equal((await h.post(body)).status,400);assert.equal(h.calls.length,0)})
test('oversized body rejected before provider',async()=>{const h=harness();assert.equal((await h.post({image:'x'.repeat(4000001)})).status,413);assert.equal(h.calls.length,0)})
for(const status of [401,429,500])test(`provider ${status} sanitized`,async()=>{const h=harness({status});const r=await h.post({image:jpeg});assert.equal(r.status,status===429?429:502);assert.equal(h.ledger[0].ok,false)})
for(const content of ['not json','{}','{"question":null}','{"question":"  "}','{"question":42}'])test(`unreadable extraction ${content}`,async()=>{const h=harness({data:{choices:[{finish_reason:'stop',message:{content}}]}});assert.equal((await h.post({image:jpeg})).status,422)})
test('truncated extraction cannot become answer input',async()=>{const h=harness({data:{choices:[{finish_reason:'length',message:{content:'{"question":"partial"}'}}]}});assert.equal((await h.post({image:jpeg})).status,422)})
test('network failure does not disclose provider error',async()=>{const h=harness({reject:true});const r=await h.post({image:jpeg});assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/private provider/);assert.equal(h.ledger[0].ok,false)})
test('success requests image extraction, returns question and records only usage',async()=>{const h=harness();const r=await h.post({image:jpeg,prep:{resume:'private resume'}});assert.equal(r.status,200);assert.deepEqual(await r.json(),{needsAnswer:true,question:'Question 1 (free-text; unknown choice):\nExplain zero trust'});assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(h.calls[0].messages[1].content[1].image_url.url,jpeg);assert.doesNotMatch(JSON.stringify(h.calls),/private resume/);assert.doesNotMatch(JSON.stringify(h.ledger),/image|question|resume/);assert.equal(h.ledger[0].input,20)})
for(const [name,bytes,mime] of [['png',[137,80,78,71,13,10,26,10],'png'],['webp',Buffer.from('RIFF0000WEBP'),'webp']])test(`accept ${name} signature`,async()=>{const h=harness();assert.equal((await h.post({image:`data:image/${mime};base64,${Buffer.from(bytes).toString('base64')}`})).status,200)})
for(const [name,question] of [['oversized','x'.repeat(12001)],['object',{}],['array',[]]])test(`reject extracted question ${name}`,async()=>{const h=harness({data:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[{...task(),question}]})}}]}});assert.equal((await h.post({image:jpeg})).status,422)})
for(const finish_reason of ['content_filter','error',null])test(`reject finish reason ${finish_reason}`,async()=>{const h=harness({data:{choices:[{finish_reason,message:{content:'{"question":"Explain DNS"}'}}]}});assert.equal((await h.post({image:jpeg})).status,422)})
test('code and multiple related subquestions preserved verbatim',async()=>{const question='Explain this function:\nif (x < 0) return -1;\nWhat is the complexity? How would you test it?';const h=harness({data:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[{...task(),question}]})}}]}});assert.equal((await(await h.post({image:jpeg})).json()).question,`Question 1 (free-text; unknown choice):
${question}`)})
test('one complete MCQ answers directly without review',async()=>{
 const mcq={...task('What does the following code snippet do?'),kind:'mcq',options:[{label:'A',text:'Reads two numbers from the console'},{label:'B',text:'Adds two numbers and prints the result'}],choiceMode:'single'}
 const h=harness({data:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[mcq]})}}]}})
 const r=await h.post({image:jpeg});assert.equal(r.status,200);const body=await r.json();assert.equal(body.needsAnswer,true);assert.match(body.question,/Question 1 \(mcq; single choice\):/);assert.match(body.question,/Adds two numbers and prints the result/);assert.equal(body.tasks,undefined)
})
test('one incomplete question still answers directly, no dialog',async()=>{
 const h=harness({data:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[{...task(),complete:false}]})}}]}})
 const body=await (await h.post({image:jpeg})).json();assert.equal(body.needsAnswer,true);assert.match(body.question,/Explain zero trust/);assert.equal(body.tasks,undefined)
})
test('two questions answer directly as one formatted question',async()=>{
 const h=harness({data:{choices:[{finish_reason:'stop',message:{content:JSON.stringify({tasks:[task('First?'),task('Second?')]})}}]}})
 const body=await (await h.post({image:jpeg})).json();assert.equal(body.needsAnswer,true);assert.match(body.question,/First\?/);assert.match(body.question,/Second\?/);assert.equal(body.tasks,undefined)
})
test('the answer follows the screen question, not the capture label', async () => {
  const { stripScreenChrome, questionForAnswer } = await import('../../src/lib/kompasAnswer.ts')
  const shown = 'Question 1 (free-text; unknown choice):\nExplain zero trust\n\nQuestion 2 (mcq; single choice):\nWhat is IDOR?\nOptions:\nA: a missing check'
  assert.equal(stripScreenChrome(shown), 'Explain zero trust\n\nWhat is IDOR?\nOptions:\nA: a missing check')
  const told = questionForAnswer(shown, shown, true, false, [])
  assert.match(told, /Explain zero trust/)
  assert.match(told, /What is IDOR\?/)
  assert.match(told, /A: a missing check/)
  assert.doesNotMatch(told, /free-text|unknown choice|Question 1/)
})
