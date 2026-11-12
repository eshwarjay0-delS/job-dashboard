import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const notifyRules = loadSource('src/lib/notify-rules.ts')
const policy = loadSource('src/lib/mail-update-policy.ts')
const secret = 'test-cron-secret-at-least-16'

function loadSource(path, mocks = {}, env = {}) {
  const module = { exports: {} }
  const js = ts.transpileModule(readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText
  runInNewContext(js, {
    module, exports: module.exports,
    require: id => id in mocks ? mocks[id] : require(id),
    Buffer, console, Date, AbortSignal, process: { env },
  })
  return module.exports
}

const NextResponse = { json: (body, init = {}) => ({ body, status: init.status ?? 200, headers: init.headers ?? {} }) }
const rule = { account: 'a@example.com', email: 'sender@example.com', mode: 'never' }
const authRequest = value => ({ headers: { get: name => name.toLowerCase() === 'authorization' ? value : null } })

test('notify-rule cache blocks pending updates and only exports completed admin state', async () => {
  const rows = new Map()
  const blob = {
    getText: async key => rows.get(key) ?? null,
    put: async (key, value) => rows.set(key, value),
    putIfAbsent: async (key, value) => { if (rows.has(key)) return false; rows.set(key, value); return true },
    delete: async key => rows.delete(key),
    list: async prefix => [...rows.keys()].filter(key => key.startsWith(prefix)),
  }
  const store = loadSource('src/lib/mail-update-store.ts', {
    '@/lib/storage': { blob },
    '@/lib/mail-update-policy': policy,
    '@/lib/notify-rules': notifyRules,
  })
  await store.beginNotifyRulesUpdate('owner-1')
  await assert.rejects(store.beginNotifyRulesUpdate('owner-1'), /already in progress/)
  await assert.rejects(store.loadNotifyRules('owner-1'), /pending/)
  await assert.rejects(store.listAdminNotifyRules(), /pending/)
  await store.completeNotifyRulesUpdate('owner-1', [rule], true)
  assert.deepEqual(JSON.parse(JSON.stringify(await store.loadNotifyRules('owner-1'))), [rule])
  assert.deepEqual(JSON.parse(JSON.stringify(await store.listAdminNotifyRules())), [[rule]])
  await store.beginNotifyRulesUpdate('owner-1')
  await store.completeNotifyRulesUpdate('owner-1', [], false)
  assert.deepEqual(JSON.parse(JSON.stringify(await store.listAdminNotifyRules())), [])
  rows.set('gmail/notify-rules/pending/users/owner-3.json', JSON.stringify({ at: Date.now() - 11 * 60 * 1000 }))
  rows.set('gmail/notify-rules/pending/admin/owner-3.json', JSON.stringify({ at: Date.now() - 11 * 60 * 1000 }))
  await store.migrateNotifyRulesIfMissing('owner-3', [rule], true)
  assert.deepEqual(JSON.parse(JSON.stringify(await store.loadNotifyRules('owner-3'))), [rule], 'stale crashed-update markers recover from authenticated metadata')
  await assert.rejects(store.loadNotifyRules('owner-2'), /not synchronized/)
})

test('public callers cannot read notify rules; cron export returns sender-only fields from R2 cache', async () => {
  let reads = 0
  const route = loadSource('src/app/api/gmail/notify-rules/export/route.ts', {
    'next/server': { NextResponse },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
    '@/lib/mail-update-store': { listAdminNotifyRules: async () => { reads++; return [[rule]] } },
    '@/lib/notify-rules': notifyRules,
  }, { CRON_SECRET: secret })
  const denied = await route.GET(authRequest(null))
  assert.equal(denied.status, 401)
  assert.equal(reads, 0)
  const allowed = await route.GET(authRequest(`Bearer ${secret}`))
  assert.equal(allowed.status, 200)
  assert.deepEqual(JSON.parse(JSON.stringify(allowed.body.rules)), [{ email: 'sender@example.com', mode: 'never' }])
  assert.equal(JSON.stringify(allowed.body).includes('a@example.com'), false)
  assert.equal(reads, 1)
})

test('tick worker stays disabled until the explicit scheduler flag is enabled', async () => {
  let collected = 0, delivered = 0, listed = 0
  const mocks = {
    'next/server': { NextResponse },
    '@/lib/storage': { blob: { list: async () => { listed++; return ['mail/updates/user/preferences.json'] }, getText: async () => '0', put: async () => {} } },
    '@/lib/gmail-updates': { collectInboxUpdates: async () => { collected++; return { synced: 0, issues: [] } } },
    '@/lib/mail-update-delivery': { deliverInboxUpdates: async () => { delivered++; return { accepted: 0, blocked: 0 } } },
  }
  const disabled = loadSource('src/app/api/gmail/updates/tick/route.ts', mocks, { CRON_SECRET: secret, GMAIL_UPDATES_SCHEDULER_ENABLED: 'false' })
  assert.equal((await disabled.GET(authRequest(null))).status, 401)
  const held = await disabled.GET(authRequest(`Bearer ${secret}`))
  assert.equal(held.status, 503)
  assert.equal(collected + delivered + listed, 0)

  const enabled = loadSource('src/app/api/gmail/updates/tick/route.ts', mocks, { CRON_SECRET: secret, GMAIL_UPDATES_SCHEDULER_ENABLED: 'true' })
  const result = await enabled.GET(authRequest(`Bearer ${secret}`))
  assert.equal(result.status, 200)
  assert.equal(collected, 1)
  assert.equal(delivered, 1)
  assert.equal(listed, 1)
})

test('authenticated notify-rules GET migrates existing owner metadata to the secure cache', async () => {
  const calls = []
  const user = { id: 'owner-1', email: 'owner@example.com', user_metadata: { gmail_notify_rules: [rule] } }
  const sb = { auth: {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async ({ data }) => { user.user_metadata = { ...user.user_metadata, ...data }; return { error: null } },
  } }
  const route = loadSource('src/app/api/gmail/notify-rules/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/server': { createClient: async () => sb },
    '@/lib/googleWorkspace': { listGoogleWorkspaceAccounts: async () => [{ google_email: 'a@example.com' }] },
    '@/lib/notify-rules': notifyRules,
    '@/lib/owner': { isAdminEmail: email => email === 'owner@example.com' },
    '@/lib/mail-update-store': {
      migrateNotifyRulesIfMissing: async (...args) => calls.push(args),
      beginNotifyRulesUpdate: async () => {},
      completeNotifyRulesUpdate: async () => {},
      abortNotifyRulesUpdate: async () => {},
    },
  })
  const result = await route.GET()
  assert.equal(result.status, 200)
  assert.deepEqual(JSON.parse(JSON.stringify(result.body.rules)), [rule])
  assert.deepEqual(calls, [['owner-1', [rule], true]])
})

test('notify-rules PUT leaves a fail-closed pending marker when cache commit fails', async () => {
  const calls = []
  const user = { id: 'owner-1', email: 'owner@example.com', user_metadata: {} }
  const sb = { auth: {
    getUser: async () => ({ data: { user }, error: null }),
    updateUser: async ({ data }) => { user.user_metadata = { ...user.user_metadata, ...data }; return { error: null } },
  } }
  const route = loadSource('src/app/api/gmail/notify-rules/route.ts', {
    'next/server': { NextResponse },
    '@/lib/supabase/server': { createClient: async () => sb },
    '@/lib/googleWorkspace': { listGoogleWorkspaceAccounts: async () => [{ google_email: 'a@example.com' }] },
    '@/lib/notify-rules': notifyRules,
    '@/lib/owner': { isAdminEmail: email => email === 'owner@example.com' },
    '@/lib/mail-update-store': {
      syncNotifyRules: async () => {},
      beginNotifyRulesUpdate: async uid => calls.push(['begin', uid]),
      completeNotifyRulesUpdate: async () => { throw Error('R2 unavailable') },
      abortNotifyRulesUpdate: async uid => calls.push(['abort', uid]),
    },
  })
  const result = await route.PUT({ json: async () => ({ rules: [rule] }) })
  assert.equal(result.status, 503)
  assert.equal(result.body.saved, true)
  assert.equal(result.body.workerExportUpdated, false)
  assert.deepEqual(calls, [['begin', 'owner-1']])
})
