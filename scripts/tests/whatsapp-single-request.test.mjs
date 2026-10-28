import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
const require = createRequire(import.meta.url)
function load(file, mocks = {}, extra = '') {
  const testModule = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8') + extra
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module: testModule, exports: testModule.exports, process, console, Buffer, setTimeout,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return testModule.exports
}
const { sameResumeIdentity } = load('src/lib/resume-identity.ts')
test('rejects swapped identities and an extra identity, preserves unchanged email', () => {
  assert.equal(sameResumeIdentity('jayeshwar44@gmail.com', 'eshwarjay05@gmail.com'), false)
  assert.equal(sameResumeIdentity('jayeshwar44@gmail.com', 'jayeshwar44@gmail.com eshwarjay05@gmail.com'), false)
  assert.equal(sameResumeIdentity('JAYESHWAR44@gmail.com', 'jayeshwar44@gmail.com'), true)
})
test('concurrent storage claims produce exactly one winner and propagate storage failures', async () => {
  const root = await mkdtemp(path.join(tmpdir(), 'wa-claim-'))
  try {
    const { FsStorage, R2Storage } = load('src/lib/storage.ts', {
      '@/lib/paths': { DATA_DIR: root },
      '@/lib/storagePolicy': { storageSegments: key => key.split('/'), storageMode: () => 'local' },
    }, '\nexport { FsStorage, R2Storage };')
    const fs = new FsStorage(root)
    const won = await Promise.all(Array.from({ length: 30 }, () => fs.putIfAbsent('jobs/request', '1')))
    assert.equal(won.filter(Boolean).length, 1)
    const r2 = new R2Storage('bucket', 'account', 'key', 'secret')
    r2.s3 = { send: async command => { assert.equal(command.input.IfNoneMatch, '*'); throw { $metadata: { httpStatusCode: 412 } } } }
    assert.equal(await r2.putIfAbsent('jobs/request', '1'), false)
    r2.s3 = { send: async () => { throw new Error('storage offline') } }
    await assert.rejects(r2.putIfAbsent('jobs/request', '1'), /storage offline/)
  } finally { await rm(root, { recursive: true, force: true }) }
})
test('same JD starts once concurrently and its lease releases for a deliberate retry', async () => {
  const entries = new Map()
  let runs = 0, deliveries = 0, failNext = false, unchangedNext = false
  const said = []
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async key => entries.get(key) ?? null, delete: async key => { entries.delete(key) },
  }
  const mocks = {
    // These cases exercise resume tailoring; channel transport has its own acceptance suite.
    '@/lib/whatsapp-kompas-channel': { handleWhatsAppKompas: async () => false },
    '@/lib/whatsapp-voice': { speechToWhatsAppText: async () => { throw new Error('Unexpected voice transcription in tailoring test') } },
    'next/server': {}, '@/lib/storage': { blob, readPath: async () => Buffer.from('same@email.com'), writePath: async () => {}, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true },
    '@/lib/tailor': { runTailor: async () => { runs++; if (failNext) { failNext = false; throw new Error('provider timeout') } if (unchangedNext) { unchangedNext = false; return { token: 'unchanged-result', unchanged: true, score: 63, coverage: 63 } } return { token: 'result', score: 63, coverage: 63, quality: { status: 'needs_review' } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async (_to, message) => { said.push(message) }, sendDocument: async () => { deliveries++; return 'sent' } },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    // Delivery callbacks for inbox alerts (538d77d3, 22 Oct); no status callback is sent here.
    '@/lib/mail-update-store': { recordUpdateProviderStatus: async () => true },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/role-match': {}, '@/lib/library-choose': {}, '@/lib/chief-approvals': {}, '@/lib/resume-library-store': {}, '@/lib/resume-library': {}, '@/lib/made-floor': {},
    '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
  }
  const { generate, captionFor } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { generate, captionFor };')
  const session = { jdId: 'jd-message', jd: 'job description', resumePath: '/data/whatsapp/inbox/123/unique.docx' }
  await Promise.all([generate('123', session, 'user'), generate('123', session, 'user')])
  assert.equal(runs, 1)
  assert.equal(deliveries, 1)
  assert.equal([...entries.keys()].some(key => key.startsWith('whatsapp/jobs/')), false, 'completed work must not leave a permanent claim')
  await generate('123', session, 'user')
  assert.equal(runs, 2, 'resending the same pair deliberately can retry instead of disappearing')
  assert.equal(deliveries, 2)
  failNext = true
  await generate('123', session, 'user')
  assert.equal(runs, 3)
  assert.equal(deliveries, 2, 'a failed rewrite is not delivered')
  assert.match(said.at(-1), /I could not tailor your resume just now/)
  assert.doesNotMatch(said.at(-1), /provider timeout/)
  assert.equal([...entries.keys()].some(key => key.startsWith('whatsapp/jobs/')), false, 'a failed rewrite also releases its claim')
  await generate('123', session, 'user')
  assert.equal(runs, 4, 'the same request can recover immediately after provider failure')
  assert.equal(deliveries, 3)
  unchangedNext = true
  await generate('123', session, 'user')
  assert.equal(runs, 5)
  assert.equal(deliveries, 3, 'an unchanged rewrite must not be sent as tailored')
  assert.match(said.at(-1), /The rewrite produced no changes/)
  assert.equal([...entries.keys()].some(key => key.startsWith('whatsapp/jobs/')), false, 'unchanged rewrite releases its claim')
  const saved = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(saved.resumePath, undefined)
  assert.equal(saved.jd, undefined)
  const caption = captionFor('Eshwar', { role: 'Engineer' }, { coverage: 63, quality: { status: 'needs_review' } })
  const gapCaption = captionFor('Eshwar', {}, { coverage: 28.5, quality: { status: 'needs_review', missing: ['f5', 'cisco'] } })
  assert.ok(gapCaption.includes('28.5%'))
  assert.ok(gapCaption.includes('Not covered in this file: f5, cisco'))
  assert.ok(!gapCaption.includes('cut short'))
  assert.ok(!gapCaption.includes('could add'))
  assert.ok(caption.includes('63%'))
  assert.ok(caption.includes('incomplete'))
  assert.ok(!caption.includes('Draft:'))
  assert.ok(caption.split('\n').length <= 5)
})
