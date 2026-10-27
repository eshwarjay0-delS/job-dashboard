import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const mod={exports:{}}
runInNewContext(ts.transpileModule(readFileSync('src/lib/kompas-shared-turn.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 module:mod,exports:mod.exports,require:id=>id==='./kompasAnswerService'?{}:id==='./kompas-session-store'?{}:require(id),Date,
})
const turn=mod.exports.sharedKompasTurn
function setup(answer){
 let state={id:'session',owner:'alice',revision:0,sources:{mode:'kompas',resume:'Original resume',jd:'Original JD',documents:[{name:'Notes',text:'Original evidence'}]},history:[{q:'Old question',a:'Old answer'}]}
 let calls=0
 const deps={now:()=>1000,store:{read:async(owner,id)=>owner===state.owner&&id===state.id?structuredClone(state):null,commit:async(owner,expected,next)=>{if(owner!==state.owner||state.revision!==expected)return false;state=structuredClone(next);return true}},answer:async(req,user)=>{calls++;return answer?answer(req,user):Response.json({text:'Answer',ledger:{turn:1}})}}
 return {deps,get state(){return state},get calls(){return calls},run:(revision=0)=>turn('alice','session',revision,'request','DNS',deps)}
}
test('shared engine receives verified identity, original sources and previous turns',async()=>{
 const h=setup(async(req,user)=>{assert.equal(user.id,'alice');const b=await req.json();assert.equal(b.config.resume,'Original resume');assert.equal(b.config.jd,'Original JD');assert.match(b.config.documents,/Original evidence/);assert.equal(b.history[0].q,'Old question');return Response.json({text:'Grounded answer',ledger:{turn:2}})})
 assert.equal((await h.run()).status,'answered');assert.equal(h.state.history.at(-1).a,'Grounded answer');assert.equal(h.state.ledger.turn,2)
})
test('duplicate or simultaneous request calls provider only once',async()=>{
 const h=setup();const results=await Promise.all([h.run(),h.run()]);assert.equal(h.calls,1);assert.equal(results.filter(r=>r.status==='answered').length,1);assert.equal((await h.run()).status,'conflict')
})
test('another account cannot read or answer a session',async()=>{
 const h=setup();assert.equal((await turn('bob','session',0,'r','DNS',h.deps)).status,'conflict');assert.equal(h.calls,0)
})
test('source change during generation suppresses stale answer',async()=>{
 let finish,started;const begun=new Promise(r=>started=r)
 const h=setup(async()=>{started();return new Promise(r=>finish=r)})
 const pending=h.run();await begun
 const current=h.state
 assert.equal(await h.deps.store.commit('alice',current.revision,{...current,revision:current.revision+1,pending:undefined,sources:{...current.sources,jd:'Updated JD'}}),true)
 finish(Response.json({text:'Old result'}));assert.equal((await pending).status,'conflict');assert.equal(h.state.sources.jd,'Updated JD');assert.equal(h.state.history.length,1)
})
test('provider failure releases claim without appending fabricated answer',async()=>{
 const h=setup(async()=>Response.json({error:'Unavailable'},{status:503}));assert.equal((await h.run()).status,'unavailable');assert.equal(h.state.pending,undefined);assert.equal(h.state.history.length,1)
})
test('missing sources reject before provider call',async()=>{
 const h=setup();await h.deps.store.commit('alice',0,{...h.state,revision:1,sources:{mode:'kompas',documents:[]}});await assert.rejects(h.run(1),/Resume/);assert.equal(h.calls,0)
})
test('expired claims can recover; live claims cannot create overlapping calls',async()=>{
 const h=setup();await h.deps.store.commit('alice',0,{...h.state,revision:1,pending:{requestId:'old',question:'Old',expiresAt:2000}})
 assert.equal((await h.run(1)).status,'conflict');h.deps.now=()=>3000;assert.equal((await h.run(1)).status,'answered');assert.equal(h.calls,1)
})
