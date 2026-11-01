/**
 * 20-fold independent desktop/auth/account-session regression set.
 * Executes production Supabase request-client code in a Node VM with a
 * deterministic local identity-provider stub; does NOT impersonate real
 * users, read private account rows or claim Windows installation testing.
 *
 * All real HTTP auth, executable launching and mobile microphone checks
 * remain separate manual/consented acceptance gates.
 */
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { createRequire } from "node:module"
const require = createRequire(import.meta.url)
const ts = require("typescript")
const { delta, combine } = require("../../public/kompas/account-sync.js")

const serverSource = readFileSync(new URL("../../src/lib/supabase/server.ts",import.meta.url),"utf8")
const issueSource = readFileSync(new URL("../../src/app/api/kompas/desktop-handoff/route.ts",import.meta.url),"utf8")
const redeemSource = readFileSync(new URL("../../src/app/api/kompas/desktop-handoff/redeem/route.ts",import.meta.url),"utf8")
const desktopSignInSource = readFileSync(new URL("../../src/app/auth/desktop/page.tsx",import.meta.url),"utf8")
const appSource = readFileSync(new URL("../../public/kompas/app.js",import.meta.url),"utf8")
const compiled=ts.transpileModule(serverSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText

function requestClient(header,{configured=true}={}){
 const calls={cookie:0,bearer:[],stub:0}
 const cookieAccount={auth:{getUser:async()=>({data:{user:{id:"cookie-account-B"}},error:null})}}
 const noSession={auth:{getUser:async()=>({data:{user:null},error:null})}}
 const mod={exports:{}}
 const stub=(id)=>{
   if(id==="next/headers")return {cookies:async()=>({getAll:()=>[],set(){}})}
   if(id==="@supabase/ssr")return {createServerClient:()=>{calls.cookie++;return cookieAccount}}
   if(id==="@supabase/supabase-js")return {createClient:(_url,_key,opts)=>{
     const authorization=opts?.global?.headers?.Authorization||""
     calls.bearer.push(authorization)
     const identity=authorization==="Bearer valid-A"?"bearer-account-A":null
     return identity?{auth:{getUser:async()=>({data:{user:{id:identity}},error:null})}}:noSession
   }}
   throw Error("Unexpected auth module: "+id)
 }
 const env=configured?{NEXT_PUBLIC_SUPABASE_URL:"https://fake.supabase.test",NEXT_PUBLIC_SUPABASE_ANON_KEY:"test-publishable-only"}:{}
 vm.runInNewContext(compiled,{module:mod,exports:mod.exports,require:stub,process:{env},Buffer,console})
 return mod.exports.createClientFromRequest({headers:{get:(key)=>key==="authorization"?header:null}})
   .then(async client=>({identity:(await client.auth.getUser()).data.user?.id||null,calls}))
}
const scenarios=[]
function scenario(name,fn){scenarios.push({name,fn})}

scenario("No Authorization header may use same-browser cookie account",async()=>{
 const x=await requestClient(null);assert.equal(x.identity,"cookie-account-B");assert.equal(x.calls.cookie,1)
})
scenario("Explicit desktop Bearer selects its own verified account",async()=>{
 const x=await requestClient("Bearer valid-A");assert.equal(x.identity,"bearer-account-A");assert.equal(x.calls.cookie,0)
})
scenario("Lowercase bearer scheme remains valid",async()=>{
 const x=await requestClient("bearer valid-A");assert.equal(x.identity,"bearer-account-A");assert.equal(x.calls.cookie,0)
})
scenario("Mixed-case BEARER scheme remains valid",async()=>{
 const x=await requestClient("BeArEr valid-A");assert.equal(x.identity,"bearer-account-A")
})
scenario("Horizontal-tab bearer separator remains supported",async()=>{
 const x=await requestClient("Bearer\tvalid-A");assert.equal(x.identity,"bearer-account-A")
})
scenario("Explicit empty Authorization never uses another account's cookies",async()=>{
 const x=await requestClient("");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Bearer scheme with missing payload cannot adopt cookie account",async()=>{
 const x=await requestClient("Bearer");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Bearer scheme with whitespace only fails closed",async()=>{
 const x=await requestClient("Bearer    ");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Basic credentials cannot silently switch to cookie account",async()=>{
 const x=await requestClient("Basic YWJj");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Two whitespace-separated Bearer tokens fail closed",async()=>{
 const x=await requestClient("Bearer valid-A extra");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Unknown bearer token stays on bearer pathway and is rejected",async()=>{
 const x=await requestClient("Bearer invalid-B");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0);assert.equal(x.calls.bearer.length,1)
})
scenario("Expired bearer is not replaced by ambient cookie account",async()=>{
 const x=await requestClient("Bearer expired-A");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0);assert.equal(x.calls.bearer.length,1)
})
scenario("Header newline injection never adopts another account",async()=>{
 const x=await requestClient("Bearer valid-A\nInjected");assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Unconfigured Supabase fails closed even with browser cookie",async()=>{
 const x=await requestClient(null,{configured:false});assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Unconfigured Supabase fails closed even with a bearer",async()=>{
 const x=await requestClient("Bearer valid-A",{configured:false});assert.equal(x.identity,null);assert.equal(x.calls.cookie,0)
})
scenario("Cloud read makes sessions saved on another device visible",()=>{
 const a=combine([{id:"desktop",session:{id:"desktop",role:"Security Engineer",createdAt:10}}],[],{})
 assert.deepEqual(a.map(x=>x.id),["desktop"])
})
scenario("Disjoint desktop and web edits generate independent minimal patches",()=>{
 const original=[{id:"s1",role:"Engineer",instructions:"Rules",company:"Bank"}]
 const a=delta(original,[{...original[0],role:"Architect"}])
 const b=delta(original,[{...original[0],company:"Healthcare"}])
 assert.deepEqual(a.map(x=>Object.keys(x.patch).sort()),[["id","role"]])
 assert.deepEqual(b.map(x=>Object.keys(x.patch).sort()),[["company","id"]])
})
scenario("Cloud tombstones defeat an offline device's stale pending updates",()=>{
 const result=combine([{id:"s1",deleted:true,session:null}],[{id:"s1",role:"Old"}],{s1:{id:"s1",patch:{role:"Stale"},deleted:false}})
 assert.equal(result.length,0)
})
scenario("Pending edit overlays latest remote row without dropping its other fields",()=>{
 const result=combine([{id:"s1",session:{id:"s1",company:"Updated",role:"Engineer"}}],
 [{id:"s1",company:"Old",role:"Engineer"}],{s1:{id:"s1",patch:{role:"Architect"},deleted:false}})
 assert.equal(result[0].company,"Updated");assert.equal(result[0].role,"Architect")
})
scenario("Desktop launch uses authenticated short-lived single-use ticket, never full instructions in URL",()=>{
 assert.match(issueSource,/authenticatedUser\(request\)/)
 assert.match(issueSource,/randomBytes\(32\)/)
 assert.match(redeemSource,/claim_kompas_desktop_handoff/)
 assert.match(redeemSource,/status:\s*410/)
 assert.match(appSource,/marketfit-kompas:\/\/open\?ticket=/)
 assert.doesNotMatch(appSource,/window\.location\.assign\(packSession\(s\)\)/)
 assert.match(desktopSignInSource,/desktopState/)
})

test("Exactly twenty distinct desktop, authentication and account-session scenarios are specified",()=>{
 assert.equal(scenarios.length,20)
 assert.equal(new Set(scenarios.map(s=>s.name)).size,20)
})
for(const {name,fn} of scenarios)test(name,fn)
