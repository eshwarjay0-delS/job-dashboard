import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const require=createRequire(import.meta.url)
const mod={exports:{}}
runInNewContext(ts.transpileModule(readFileSync('src/lib/kompas-session-store.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
 module:mod,exports:mod.exports,require:id=>id==='@/lib/storage'?{blob:{}}:require(id),
})
function setup(){
 const files=new Map()
 const storage={list:async()=>{throw new Error('ListObjectsV2 forbidden')},getText:async key=>files.get(key)??null,putIfAbsent:async(key,value)=>{if(files.has(key))return false;files.set(key,value);return true}}
 return mod.exports.sharedKompasStore(storage)
}
for(let fold=1;fold<=10;fold++){
 test(`fold ${fold}: only one concurrent source revision commits; stale writes cannot erase it`,async()=>{
  const db=setup(),s=await db.create('owner-'+fold)
  const attempts=Array.from({length:fold+1},(_,i)=>db.commit(s.owner,0,{...s,revision:1,sources:{...s.sources,resume:'resume-'+i}}))
  const outcomes=await Promise.all(attempts)
  assert.equal(outcomes.filter(Boolean).length,1)
  const latest=await db.read(s.owner,s.id)
  assert.equal(latest.revision,1)
  assert.equal(await db.commit(s.owner,0,{...s,revision:1}),false)
  assert.equal((await db.read(s.owner,s.id)).sources.resume,latest.sources.resume)
 })
 test(`fold ${fold}: account isolation and ordered follow-up history`,async()=>{
  const db=setup(),s=await db.create('alice-'+fold)
  assert.equal(await db.read('bob-'+fold,s.id),null)
  await assert.rejects(db.commit('bob-'+fold,0,{...s,revision:1}),/ownership|revision/)
  let current=s
  for(let i=0;i<fold;i++){
   const next={...current,revision:current.revision+1,history:[...current.history,{q:'Q'+i,a:'A'+i}]}
   assert.equal(await db.commit(s.owner,current.revision,next),true)
   current=next
  }
  const restored=await db.read(s.owner,s.id)
  assert.equal(restored.history.length,fold)
  assert.equal(restored.history.at(-1).q,'Q'+(fold-1))
 })
}
test('invalid owner, session paths and skipped revisions fail closed',async()=>{
 const db=setup()
 await assert.rejects(db.create(' '),/account/)
 await assert.rejects(db.read('owner','../other'),/Invalid/)
 const s=await db.create('owner')
 await assert.rejects(db.commit('owner',0,{...s,revision:2}),/revision/)
 assert.equal(await db.commit('owner',5,{...s,revision:6}),false)
})

test('sessions support deep revision histories with no ListObjects access',async()=>{
 const db=setup()
 let curr=await db.create('verified')
 for(let i=0;i<55;i++){
   const next={...curr,revision:curr.revision+1,history:[...curr.history,{q:'Q'+i,a:'A'+i}]}
   assert.equal(await db.commit(curr.owner,curr.revision,next),true)
   curr=next
 }
 const again=await db.read(curr.owner,curr.id)
 assert.equal(again.revision,55)
 assert.equal(again.history.length,55)
})
