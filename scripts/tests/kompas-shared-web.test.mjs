import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {runInNewContext} from 'node:vm'
import ts from 'typescript'
const id='12345678-1111-4111-8111-111111111111'
function setup(){
 let user={id:'alice'}, calls=[], fail=false, outcome='answered'
 const session={id,owner:'alice',revision:3,sources:{resume:'private resume',jd:'private JD',documents:[{name:'Notes.txt',text:'secret'}]},history:[{q:'Why?',a:'Grounded answer'}],ledger:{private:'ledger'}}
 const m={exports:{}}
 const code=ts.transpileModule(readFileSync('src/app/api/kompas/shared/route.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText
 runInNewContext(code,{module:m,exports:m.exports,Date,require:name=>{
  if(name==='@/lib/whatsapp-kompas')return {}
  if(name==='next/server')return {NextResponse:Response}
  if(name==='@/lib/authBoundary')return {authenticatedUser:async()=>user}
  if(name==='@/lib/kompas-session-store')return {sharedKompasStore:()=>({list:async owner=>{calls.push(['list',owner]);if(fail)throw Error('private storage error');return owner==='alice'?[{id,addedAt:'2026-10-28T00:00:00Z'}]:[]},remember:async()=>true,read:async(owner,key)=>{calls.push(['read',owner,key]);if(fail)throw Error('private storage error');return owner===session.owner&&key===id?session:null}})}
  if(name==='@/lib/kompas-shared-turn')return {sharedKompasTurn:async(...args)=>{calls.push(['turn',...args]);return {status:outcome,session}}}
  throw Error(name)
 }})
 const request=(body,method='POST',key=id)=>({method,nextUrl:new URL('https://mfit.test/api/kompas/shared?id='+key),text:async()=>typeof body==='string'?body:JSON.stringify(body)})
 const body={id,revision:3,requestId:'request-1',question:'Explain DNS',owner:'mallory'}
 return {api:m.exports,request,body,session,calls,set user(v){user=v},set fail(v){fail=v},set outcome(v){outcome=v}}
}
test('unauthenticated reads and turns fail before touching session storage',async()=>{const h=setup();h.user=null;for(const method of ['GET','POST']){const r=await h.api[method](h.request(h.body,method));assert.equal(r.status,401);assert.equal(r.headers.get('cache-control'),'no-store')}assert.equal(h.calls.length,0)})
test('another account cannot discover or answer the session even with its exact link',async()=>{const h=setup();h.user={id:'bob'};for(const method of ['GET','POST'])assert.equal((await h.api[method](h.request(h.body,method))).status,404);assert.ok(h.calls.every(c=>c[1]==='bob'));assert.ok(!h.calls.some(c=>c[0]==='turn'))})
test('owned history view excludes source text, owner, ledger and pending question',async()=>{const h=setup();h.session.pending={expiresAt:Date.now()+10000,question:'private pending',requestId:'secret-id'};const r=await h.api.GET(h.request(null,'GET'));const v=await r.json();assert.equal(v.ready,true);assert.equal(v.pending,true);assert.equal(v.documentCount,1);assert.deepEqual(v.supportingDocuments,[{index:0,name:'Notes.txt',characters:6}]);assert.equal(v.history[0].a,'Grounded answer');for(const key of ['owner','sources','ledger'])assert.equal(v[key],undefined);assert.doesNotMatch(JSON.stringify(v),/private|secret/);assert.equal(r.headers.get('cache-control'),'no-store')})
test('turn uses verified owner and expected revision through the shared service',async()=>{const h=setup();const r=await h.api.POST(h.request(h.body));assert.equal(r.status,200);assert.deepEqual(h.calls.find(c=>c[0]==='turn'),['turn','alice',id,3,'request-1','Explain DNS'])})
test('missing sources cannot call the answer engine',async()=>{const h=setup();delete h.session.sources.jd;assert.equal((await h.api.POST(h.request(h.body))).status,409);assert.ok(!h.calls.some(c=>c[0]==='turn'))})
test('conflicts and provider failures are explicit and non-cacheable',async()=>{for(const [outcome,status]of [['conflict',409],['unavailable',503]]){const h=setup();h.outcome=outcome;const r=await h.api.POST(h.request(h.body));assert.equal(r.status,status);assert.equal(r.headers.get('cache-control'),'no-store')}})
test('invalid or oversized turns make no storage or provider call',async()=>{for(const patch of [{id:'../alice'},{revision:-1},{revision:1.2},{question:''},{question:'x'.repeat(4001)},{requestId:''}]){const h=setup();assert.equal((await h.api.POST(h.request({...h.body,...patch}))).status,400);assert.equal(h.calls.length,0)}const h=setup();assert.equal((await h.api.POST(h.request('x'.repeat(10001)))).status,413);assert.equal(h.calls.length,0)})
test('storage exceptions never leak provider details',async()=>{const h=setup();h.fail=true;const r=await h.api.GET(h.request(null,'GET'));assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private storage error/)})

test('catalog uses authenticated owner and never takes caller owner from URL',async()=>{const h=setup();const req={nextUrl:new URL('https://mfit.test/api/kompas/shared?owner=mallory')};const r=await h.api.GET(req);assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal((await r.json()).sessions[0].id,id);assert.deepEqual(h.calls,[['list','alice']]);h.user={id:'bob'};assert.equal((await (await h.api.GET(req)).json()).sessions.length,0)})
test('catalog signed-out and storage failure responses reveal no metadata',async()=>{const h=setup(),req={nextUrl:new URL('https://mfit.test/api/kompas/shared')};h.user=null;assert.equal((await h.api.GET(req)).status,401);assert.equal(h.calls.length,0);h.user={id:'alice'};h.fail=true;const r=await h.api.GET(req);assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/private storage error/)})
