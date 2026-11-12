import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'
import { recipients, attachments, encodeGmailMessage } from '../../src/lib/gmail-message.ts'

const nodeRequire = createRequire(import.meta.url)
const routeSource = readFileSync(new URL('../../src/app/api/gmail-send/route.ts', import.meta.url), 'utf8')
const ACCOUNTS = [
  { id: 'acct-a', google_email: 'one@example.com', gmail_enabled: true },
  { id: 'acct-b', google_email: 'two@example.com', gmail_enabled: true },
]

function request(body, origin = 'https://marketfit.test') {
  return {
    headers: { get: name => name === 'origin' ? origin : null },
    nextUrl: { origin },
    json: async () => body,
  }
}

function harness({ accounts = ACCOUNTS, tokens = { 'acct-a': 'token-a', 'acct-b': 'token-b' }, fetchHandler } = {}) {
  const calls = { tokens: [], fetch: [] }
  const moduleMock = { exports: {} }
  const compiled = ts.transpileModule(routeSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const mocks = {
    'next/server': {
      NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) },
    },
    '@/lib/supabase/server': {
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) } }),
    },
    '@/lib/googleWorkspace': {
      listGoogleWorkspaceAccounts: async () => accounts,
      getGoogleWorkspaceAccessToken: async (userId, accountId) => {
        calls.tokens.push({ userId, accountId })
        return tokens[accountId] ?? null
      },
    },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
    '@/lib/gmail-message': { recipients, attachments, encodeGmailMessage },
  }
  const send = fetchHandler || (async () => ({ ok: true, json: async () => ({ id: 'sent-1', threadId: 'thread-1' }) }))
  runInNewContext(compiled, {
    module: moduleMock,
    exports: moduleMock.exports,
    require: id => mocks[id] ?? nodeRequire(id),
    fetch: async (url, init) => {
      calls.fetch.push({ url: String(url), init })
      return send(String(url), init)
    },
    AbortSignal,
    Buffer,
    console,
  })
  return { POST: moduleMock.exports.POST, calls }
}

const message = {
  to: 'recipient@example.com',
  cc: '',
  bcc: '',
  attachments: [],
  subject: 'Account-bound reply',
  body: 'Hello from the selected inbox.',
}

test('compose uses the selected From address and OAuth token, not a different connected inbox', async () => {
  const h = harness()
  const response = await h.POST(request({ ...message, accountEmail: 'TWO@EXAMPLE.COM', accountId: 'acct-a' }))
  assert.equal(response.status, 200)
  assert.deepEqual(h.calls.tokens, [{ userId: 'user-1', accountId: 'acct-b' }])
  assert.equal(h.calls.fetch.length, 1)
  assert.equal(h.calls.fetch[0].init.headers.Authorization, 'Bearer token-b')
  const payload = JSON.parse(h.calls.fetch[0].init.body)
  const mime = Buffer.from(payload.raw, 'base64url').toString('utf8')
  assert.match(mime, /^From: two@example\.com$/m)
})

test('a thread missing from the selected inbox is rejected before any message is sent', async () => {
  const h = harness({
    fetchHandler: async url => {
      assert.match(url, /\/threads\/thread-owned-by-one\?/)
      return { ok: false, status: 404, json: async () => ({}) }
    },
  })
  const response = await h.POST(request({ ...message, accountEmail: 'two@example.com', threadId: 'thread-owned-by-one' }))
  assert.equal(response.status, 409)
  assert.deepEqual(h.calls.tokens, [{ userId: 'user-1', accountId: 'acct-b' }])
  assert.equal(h.calls.fetch.length, 1, 'the failed thread lookup must stop before messages/send')
})

test('a selected account token failure asks for that inbox to reconnect and never falls back to another inbox', async () => {
  const h = harness({ tokens: { 'acct-a': 'token-a', 'acct-b': null } })
  const response = await h.POST(request({ ...message, accountEmail: 'two@example.com', accountId: 'acct-a' }))
  assert.equal(response.status, 403)
  assert.equal(response.body.error, 'Reconnect this Gmail account.')
  assert.deepEqual(h.calls.tokens, [{ userId: 'user-1', accountId: 'acct-b' }])
  assert.equal(h.calls.fetch.length, 0)
})

test('an unknown selected From address does not silently fall back to a different account id', async () => {
  const h = harness()
  const response = await h.POST(request({ ...message, accountEmail: 'unknown@example.com', accountId: 'acct-a' }))
  assert.equal(response.status, 400)
  assert.equal(response.body.error, 'Choose a connected sending account.')
  assert.equal(h.calls.tokens.length, 0)
  assert.equal(h.calls.fetch.length, 0)
})

test('a disabled inbox cannot be selected for sending', async () => {
  const h = harness({
    accounts: [...ACCOUNTS, { id: 'acct-c', google_email: 'paused@example.com', gmail_enabled: false }],
  })
  const response = await h.POST(request({ ...message, accountEmail: 'paused@example.com' }))
  assert.equal(response.status, 400)
  assert.equal(h.calls.tokens.length, 0)
  assert.equal(h.calls.fetch.length, 0)
})


// Calendar must use the selected Google Workspace account too; a missing token
// for that account must never fall back to another connected inbox.
const calendarRouteSource = readFileSync(new URL('../../src/app/api/calendar-sync/route.ts', import.meta.url), 'utf8')

function calendarHarness({ user = { id: 'user-1' }, tokens = { 'acct-a': 'token-a', 'acct-b': 'token-b' }, fetchHandler } = {}) {
  const calls = { tokens: [], fetch: [] }
  const moduleMock = { exports: {} }
  const compiled = ts.transpileModule(calendarRouteSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  }).outputText
  const mocks = {
    'next/server': {
      NextResponse: { json: (body, init = {}) => ({ body, status: init.status ?? 200 }) },
    },
    '@/lib/supabase/server': {
      createClient: async () => ({ auth: { getUser: async () => ({ data: { user } }) } }),
    },
    '@/lib/googleWorkspace': {
      getGoogleWorkspaceAccessToken: async (userId, accountId) => {
        calls.tokens.push({ userId, accountId })
        return tokens[accountId] ?? null
      },
    },
    '@/lib/rateLimit': { checkRateLimit: () => ({ ok: true }) },
  }
  const fetchCalendar = fetchHandler || (async () => ({
    ok: true,
    json: async () => ({ items: [{ id: 'event-1', summary: 'Interview', start: { dateTime: '2026-11-12T12:00:00Z' }, end: { dateTime: '2026-11-12T12:30:00Z' } }] }),
  }))
  runInNewContext(compiled, {
    module: moduleMock,
    exports: moduleMock.exports,
    require: id => mocks[id] ?? nodeRequire(id),
    fetch: async (url, init) => {
      calls.fetch.push({ url: String(url), init })
      return fetchCalendar(String(url), init)
    },
    AbortSignal,
    URL,
    URLSearchParams,
    Date,
    console,
  })
  return { GET: moduleMock.exports.GET, calls }
}

test('Calendar sync uses only the selected Google Workspace account token', async () => {
  const h = calendarHarness()
  const response = await h.GET({ url: 'https://marketfit.test/api/calendar-sync?accountId=acct-b' })
  assert.equal(response.status, 200)
  assert.deepEqual(h.calls.tokens, [{ userId: 'user-1', accountId: 'acct-b' }])
  assert.equal(h.calls.fetch.length, 1)
  assert.equal(h.calls.fetch[0].init.headers.Authorization, 'Bearer token-b')
  assert.equal(response.body.accountId, 'acct-b')
  assert.equal(response.body.events[0].title, 'Interview')
})

test('Calendar sync fails closed when the selected account is disconnected; it does not fall back', async () => {
  const h = calendarHarness({ tokens: { 'acct-a': 'token-a', 'acct-b': null } })
  const response = await h.GET({ url: 'https://marketfit.test/api/calendar-sync?accountId=acct-b' })
  assert.equal(response.status, 403)
  assert.equal(response.body.connected, false)
  assert.equal(response.body.events.length, 0)
  assert.deepEqual(h.calls.tokens, [{ userId: 'user-1', accountId: 'acct-b' }])
  assert.equal(h.calls.fetch.length, 0)
})
