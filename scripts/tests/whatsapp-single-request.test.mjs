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
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8') + extra
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console, Buffer, setTimeout,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
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
test('same JD can start only one generation across concurrent input handlers', async () => {
  const entries = new Map()
  let runs = 0, deliveries = 0
  const blob = {
    putIfAbsent: async (key, value) => { if (entries.has(key)) return false; entries.set(key, value); return true },
    put: async (key, value) => entries.set(key, value),
    get: async () => Buffer.from('same@email.com'), getText: async () => null, delete: async () => {},
  }
  const mocks = {
    'next/server': {}, '@/lib/storage': { blob, readPath: async () => Buffer.from('same@email.com'), writePath: async () => {}, deletePath: async () => {} },
    '@/lib/paths': { DATA_DIR: '/data' },
    '@/lib/llm': { keysFor: async () => ({}), hasAnyKey: () => true },
    '@/lib/tailor': { runTailor: async () => { runs++; return { token: 'result', score: 63, coverage: 63, quality: { status: 'needs_review' } } } },
    '@/lib/claude': { extractJdMeta: async () => ({ role: 'Engineer' }) },
    '@/lib/whatsapp': { sendText: async () => {}, sendDocument: async () => { deliveries++; return 'sent' } },
    '@/lib/owner': {}, '@/lib/whatsapp-who': {}, '@/lib/whatsapp-link': {}, '@/lib/whatsapp-who-core': {},
    '@/lib/profile': { extractProfile: async () => ({ firstName: 'Eshwar' }) }, '@/lib/plain-failure': {},
    '@/lib/resume-identity': { sameResumeIdentity }, '@/lib/docx': { extractText: async b => b.toString() },
    '@/lib/supabase/service': { serviceClientAvailable: () => false },
    '@/lib/keyword-targets': { isCertification: t => /pcnse|cissp/i.test(t) },
    '@/lib/whatsapp-trace': { trace: () => {} },
    '@/lib/library-pick-store': {}, '@/lib/library-pick': {}, '@/lib/resume-library-store': {}, '@/lib/resume-library': {},
    '@/lib/library-agent': {}, '@/lib/keywords': {}, '@/lib/resumeOrganization': {},
  }
  const { generate, captionFor } = load('src/app/api/whatsapp/webhook/route.ts', mocks, '\nexport { generate, captionFor };')
  const session = { jdId: 'jd-message', jd: 'job description', resumePath: '/data/whatsapp/inbox/123/unique.docx' }
  await Promise.all([generate('123', session, 'user'), generate('123', session, 'user')])
  assert.equal(runs, 1)
  assert.equal(deliveries, 1)
  const saved = JSON.parse(entries.get('whatsapp/session-123.json'))
  assert.equal(saved.resumePath, undefined)
  assert.equal(saved.jd, undefined)
  const caption = captionFor('Eshwar', { role: 'Engineer' }, { coverage: 63, quality: { status: 'needs_review' } })
  assert.ok(caption.includes('63%'))
  assert.ok(caption.includes('incomplete'))
  assert.ok(!caption.includes('Draft:'))
  assert.ok(caption.split('\n').length <= 5)
})
