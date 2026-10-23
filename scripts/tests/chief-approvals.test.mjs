// Chief Phase 4: approval-card loop self-test (real code, mocked blob storage).
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}) {
  const module = { exports: {} }
  const src = readFileSync(new URL('../../' + file, import.meta.url), 'utf8')
  runInNewContext(ts.transpileModule(src, { compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, process, console,
    require: id => id in mocks ? mocks[id] : require(id),
  })
  return module.exports
}

const store = new Map()
const blobMock = {
  getText: async k => (store.has(k) ? store.get(k) : null),
  put: async (k, v) => { store.set(k, v) },
}
const A = load('src/lib/chief-approvals.ts', {
  '@/lib/storage': { blob: blobMock },
  '@/lib/whatsapp': { sendInteractiveButtons: async () => 'wamid.1', waConfigured: () => true },
  '@/lib/whatsapp-trace': { trace: () => {} },
  // Every draft goes through the guard before a card exists (23 Oct 2026): the real one, not a stand-in.
  '@/lib/chief-guard': load('src/lib/chief-guard.ts'),
})

test('button ids parse back exactly', () => {
  const id = A.cardButtonId('a'.repeat(24), 'send')
  const p = A.parseCardButton(id)
  assert.equal(p?.cardId, 'a'.repeat(24))
  assert.equal(p?.action, 'send')
  assert.equal(A.parseCardButton('send'), null)
  assert.equal(A.parseCardButton('appr:short:send'), null)          // wrong length
  assert.equal(A.parseCardButton('appr:' + 'b'.repeat(24) + ':delete'), null) // bad action
})

test('card lifecycle: create -> pending -> sent drops from pending', async () => {
  const card = await A.createApprovalCard({
    userId: 'u1', to: '15551234567', kind: 'followup-draft', toEmail: 'r@example.com',
    subject: 'Follow-up', body: 'Hi, following up.', draftId: 'd1', accountEmail: 'a@gmail.com',
  })
  assert.equal(card.status, 'pending')
  const got = await A.getApprovalCard(card.id)
  assert.equal(got?.subject, 'Follow-up')
  let pending = await A.listPendingCards('15551234567')
  assert.equal(pending.length, 1)
  card.status = 'sent'
  await A.saveApprovalCard(card)
  pending = await A.listPendingCards('15551234567')
  assert.equal(pending.length, 0)
})

test('pending is scoped to the recipient number', async () => {
  const card = await A.createApprovalCard({
    userId: 'u1', to: '15559998888', kind: 'followup-draft', toEmail: 'r@example.com',
    subject: 'S', body: 'B',
  })
  assert.equal((await A.listPendingCards('15559998888')).length, 1)
  assert.equal((await A.listPendingCards('15551112222')).length, 0)
  card.status = 'skipped'
  await A.saveApprovalCard(card)
})
