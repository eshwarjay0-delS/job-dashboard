import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(import.meta.url), ts = require('typescript')
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/lib/whatsapp-resume-acceptance.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, module: { exports } })
const route = readFileSync(new URL('../../src/app/api/tailor/route.ts', import.meta.url), 'utf8')
const block = route.slice(route.indexOf('    // Same release target on web'), route.indexOf('    // Gel points:'))
assert.ok(block.includes('for (let repair'))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const invoke = new AsyncFunction('result', 'run', 'sameFactsAsSource', 'began', 'acceptableWhatsAppResume', 'whatsappResumeRejectionReasons', 'NextResponse', block+'\nreturn {released: result.token}')
const good = { token: 'accepted', coverage: 100, supported_coverage: 100, diff: [{}], quality: { status: 'coverage_met', matched: 100, total: 100 }, quality_blockers: [], unverified_added_keywords: [] }
const bad = { ...good, token: 'held', coverage: 70, quality: { status: 'needs_review', matched: 70, total: 100 }, keyword_analysis: { missing: ['AWS'] } }
async function evaluate(initial, candidates, elapsed=0, facts=async()=>true) {
  let calls=0
  const result = await invoke(initial, async()=>candidates[Math.min(calls++, candidates.length-1)], facts, Date.now()-elapsed, exports.acceptableWhatsAppResume, exports.whatsappResumeRejectionReasons, {json:(body,options)=>({body,...options})})
  return {result,calls}
}
test('95-100% complete safe result needs no retry', async()=>{
  const {result,calls}=await evaluate(good, [bad]); assert.equal(calls,0); assert.equal(result.released,'accepted')
})
test('low result is iteratively repaired then released', async()=>{
  const {result,calls}=await evaluate(bad, [bad,good]); assert.equal(calls,2); assert.equal(result.released,'accepted')
})
test('exhausted repair returns measured gaps without a download token', async()=>{
  const {result,calls}=await evaluate(bad, [bad]); assert.equal(calls,2); assert.equal(result.status,422); assert.equal(result.body.coverage,70); assert.equal(result.body.token,undefined); assert.deepEqual(result.body.missing,['AWS'])
})
test('a perfect keyword score cannot override unverified claims', async()=>{
  const risky={...good, unverified_added_keywords:['AWS']}; const {result}=await evaluate(risky,[risky]); assert.equal(result.status,422)
})
test('fact-mutating repair is never released', async()=>{
  const {result}=await evaluate(bad,[good],0,async()=>false); assert.equal(result.status,422)
})
test('expired request budget holds the file rather than looping indefinitely', async()=>{
  const {result,calls}=await evaluate(bad,[good],121000); assert.equal(calls,0); assert.equal(result.status,422)
})
