import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(import.meta.url), ts = require('typescript')
const exports = {}
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../../src/lib/whatsapp-resume-acceptance.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, module: { exports } })
const route = readFileSync(new URL('../../src/app/api/tailor/route.ts', import.meta.url), 'utf8')
const block = route.slice(route.indexOf('    // Web still withholds under 95%'), route.indexOf('    // Gel points:'))
assert.ok(block.includes('for (let repair'))
assert.ok(block.includes('acceptableWebResume'))
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const invoke = new AsyncFunction('result', 'run', 'sameFactsAsSource', 'began', 'acceptableWebResume', 'whatsappResumeRejectionReasons', 'NextResponse', block+'\nreturn {released: result.token}')
const good = { token: 'accepted', coverage: 100, supported_coverage: 100, diff: [{}], quality: { status: 'coverage_met', matched: 100, total: 100 }, quality_blockers: [], unverified_added_keywords: [], ats: { score: 100, passed: true, checks: [], issues: [] } }
const bad = { ...good, token: 'held', coverage: 70, quality: { status: 'needs_review', matched: 70, total: 100 }, keyword_analysis: { missing: ['AWS'] } }
async function evaluate(initial, candidates, elapsed=0, facts=async()=>true) {
  let calls=0
  const result = await invoke(initial, async()=>candidates[Math.min(calls++, candidates.length-1)], facts, Date.now()-elapsed, exports.acceptableWebResume, exports.whatsappResumeRejectionReasons, {json:(body,options)=>({body,...options})})
  return {result,calls}
}
test('WhatsApp may deliver a complete 70-94.9% draft that web still holds for repair', () => {
  const band = { ...good, coverage: 82, supported_coverage: 97, quality: { status: 'needs_review', matched: 82, total: 100, incomplete: false } }
  assert.equal(exports.acceptableWhatsAppResume(band), true)
  assert.equal(exports.acceptableWebResume(band), false)
})
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

const factSource = route.slice(route.indexOf('async function sameFactsAsSource'), route.indexOf('export const runtime'))
const factCompiled = ts.transpileModule(factSource+'\nexports.check = sameFactsAsSource', { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
function factCheck(blob, extractText=async()=> 'source', sameResumeIdentity=()=>true) {
  const exports={}; vm.runInNewContext(factCompiled,{exports,blob,extractText,sameResumeIdentity,keyOf:x=>x,console:{error:()=>{}}}); return exports.check({matched:{filepath:'source'},token:'output'})
}
test('missing source/export cannot pass identity verification', async()=>assert.equal(await factCheck({get:async()=>null}),false))
test('extraction failure cannot pass identity verification', async()=>assert.equal(await factCheck({get:async()=>Buffer.from('doc')},async()=>{throw Error('unreadable')}),false))
test('readable unchanged facts pass identity verification', async()=>assert.equal(await factCheck({get:async()=>Buffer.from('doc')}),true))
