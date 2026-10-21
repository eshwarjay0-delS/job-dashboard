import test from 'node:test'
import assert from 'node:assert/strict'
import {REA_SESSIONS,filterReaSessions} from '../../src/lib/rea-register.ts'
import {readFileSync,existsSync} from 'node:fs'
import path from 'node:path'
const root=path.resolve(import.meta.dirname,'../..')
test('each REA session retains source, ordered findings, boundaries and next action',()=>{
 assert.equal(new Set(REA_SESSIONS.map(s=>s.id)).size,REA_SESSIONS.length)
 for(const s of REA_SESSIONS){assert.ok(s.request&&s.limits&&s.next&&s.sources.length&&s.steps.length);for(const step of s.steps)assert.ok(step.label&&step.finding&&step.evidence);for(const source of s.sources)if(source.path)assert.ok(existsSync(path.join(root,source.path)),source.path)}
})
test('filters find Parakeet and keep tool failures distinct from public reviews',()=>{
 assert.ok(filterReaSessions('Parakeet','kompas','all').some(s=>s.id==='parakeet-kompas'))  // later sessions may cite Parakeet too
 const tool=filterReaSessions('','all','REA tool attempt');assert.ok(tool.length>=1);assert.equal(tool.find(s=>s.id==='rea-tool-inventory').state,'Blocked')
 assert.ok(filterReaSessions('','all','Public reference review').every(s=>s.method==='Public reference review'))
 assert.equal(filterReaSessions('Parakeet','gmail','all').length,0)
})
test('REA route inherits existing admin gate and is discoverable from hub',()=>{
 assert.match(readFileSync(path.join(root,'src/app/dashboard/admin/vision/layout.tsx'),'utf8'),/await requireVisionAdmin\(\)/)
 assert.match(readFileSync(path.join(root,'src/app/dashboard/admin/vision/page.tsx'),'utf8'),/href="\/dashboard\/admin\/vision\/rea"/)
})
