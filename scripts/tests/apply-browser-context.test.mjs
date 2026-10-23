import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import crypto from 'node:crypto'
import ts from 'typescript'

function route(user) {
 const source=readFileSync(new URL('../../src/app/api/apply/browser-context/route.ts',import.meta.url),'utf8')
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText
 const exports={}
 vm.runInNewContext(js,{exports,Response,require:name=>{
  if(name==='node:crypto')return crypto
  if(name==='@/lib/authBoundary')return{authenticatedUserId:async()=>user,signInRequired:()=>Response.json({code:'AUTH_REQUIRED'},{status:401})}
  throw Error(name)
 }})
 return exports.GET
}
test('unauthenticated browser-context request cannot obtain an account partition',async()=>{
 const response=await route(null)({});assert.equal(response.status,401)
 assert.equal((await response.json()).account,undefined)
})
test('context is stable per account, distinct across accounts and never exposes raw identity',async()=>{
 const first=await route('user-one')({}), repeat=await route('user-one')({}), second=await route('user-two')({})
 assert.equal(first.headers.get('cache-control'),'no-store')
 const a=await first.json(),b=await repeat.json(),c=await second.json()
 assert.match(a.account,/^[a-f0-9]{64}$/);assert.equal(a.account,b.account);assert.notEqual(a.account,c.account)
 assert.deepEqual(Object.keys(a),['account']);assert.ok(!JSON.stringify(a).includes('user-one'))
})
