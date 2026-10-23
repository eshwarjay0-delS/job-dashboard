import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync('src/lib/portal-return.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{exports,URL})
const {portalSnapshot,readPortalReturn}=exports
const job={id:'a',title:'Engineer',company:'A',location:'Remote',url:'https://example.com/job/a',source:'ats',description:'private JD'}
test('return preserves the original posting and resume after selection changes',()=>{
 const selected={...job},snapshot=portalSnapshot(selected,'security','original.docx',1000)
 selected.id='b';selected.title='Different';selected.url='https://example.com/job/b'
 const restored=readPortalReturn(JSON.stringify(snapshot),2000)
 assert.equal(restored.job.id,'a');assert.equal(restored.job.url,job.url)
 assert.equal(restored.resume,'original.docx');assert.equal(restored.query,'security')
 assert.equal(restored.job.description,undefined)
})
test('legacy, corrupt, expired, future and unsafe snapshots cannot confirm a different current job',()=>{
 for(const raw of ['broken',JSON.stringify({title:'Old',company:'A',at:1000}),JSON.stringify(portalSnapshot(job,'','',-3600000)),JSON.stringify(portalSnapshot(job,'','',3000)),JSON.stringify(portalSnapshot({...job,url:'javascript:alert(1)'},'','',1000))]) assert.equal(readPortalReturn(raw,2000),null)
})
test('confirmation awaits persistence with original context; web and desktop capture context',()=>{
 const page=readFileSync('src/app/dashboard/apply/page.tsx','utf8')
 assert.match(page,/if\(await record\('submitted',portalReturn.job,undefined,portalReturn\)\)\{setPortalReturn\(null\)/)
 assert.match(page,/if\(!portalReturn\|\|confirmingReturn.current\)return/)
 assert.match(page,/disabled=\{returnBusy\} onClick=\{\(\)=>void confirmPortalReturn\(\)\}/)
 assert.match(page,/if\(job\)rememberPortal\(job\)/)
 assert.match(page,/onLaunch=\{\(\)=>\{rememberPortal\(job\)/)
})
