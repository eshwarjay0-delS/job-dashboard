// One server-side auth decision for every page route (src/lib/authGate.ts,
// run by src/proxy.ts): a signed-in user never sees the marketing page or the
// sign-in form, and a signed-out user never opens a dashboard page. The
// decision is pure so it can be tested without a Supabase session; the proxy
// supplies hasUser from a verified getUser(), never from a raw cookie value.
// The gate source is sliced and run in a vm (the repo's node runner does not
// resolve extensionless relative imports), with the real safeAuthNext.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import { safeAuthNext } from '../../src/lib/authRedirect.ts'

const src = readFileSync(new URL('../../src/lib/authGate.ts', import.meta.url), 'utf8')
  .replace(/import \{ safeAuthNext \} from "\.\/authRedirect";?\n?/, '')
  .replace('export function authGateRedirect', 'function authGateRedirect')
const context = vm.createContext({ safeAuthNext })
vm.runInContext(stripTypeScriptTypes(src), context)
const { authGateRedirect } = context

const STATE = 'Zm9yIGEgdGVzdCBvbmx5IC0gbm90IGEgcmVhbCBzdGF0ZQ' // 46 base64url characters, the shape the desktop sends

test('a signed-in user on the marketing page goes to the dashboard', () => {
  assert.equal(authGateRedirect('/', '', null, true), '/dashboard')
})

test('a signed-out user on the marketing page sees it', () => {
  assert.equal(authGateRedirect('/', '', null, false), null)
})

test('a signed-in user on the sign-in page goes to next, or the dashboard', () => {
  assert.equal(authGateRedirect('/login', '', null, true), '/dashboard')
  assert.equal(authGateRedirect('/login', '', '/dashboard/kompas', true), '/dashboard/kompas')
  assert.equal(authGateRedirect('/login', '', '/dashboard', true), '/dashboard')
})

test('a signed-in user on the sign-in page keeps the desktop handoff state', () => {
  assert.equal(authGateRedirect('/login', '', '/auth/desktop?state=' + STATE, true), '/auth/desktop?state=' + STATE)
  assert.equal(authGateRedirect('/login', '', '/auth/desktop', true), '/auth/desktop')
  assert.equal(authGateRedirect('/login', '', '/auth/desktop?state=short', true), '/auth/desktop')
})

test('a signed-in user on the sign-in page never leaves the site through next', () => {
  assert.equal(authGateRedirect('/login', '', 'https://evil.example/x', true), '/dashboard')
  assert.equal(authGateRedirect('/login', '', '/login', true), '/dashboard')
})

test('a signed-out user on the sign-in page sees the form', () => {
  assert.equal(authGateRedirect('/login', '', null, false), null)
  assert.equal(authGateRedirect('/login', '', '/auth/desktop?state=' + STATE, false), null)
})

test('a signed-out user on a dashboard page goes to sign-in with the way back', () => {
  assert.equal(authGateRedirect('/dashboard', '', null, false), '/login?next=%2Fdashboard')
  assert.equal(authGateRedirect('/dashboard/kompas', '?tab=mail', null, false), '/login?next=%2Fdashboard%2Fkompas%3Ftab%3Dmail')
})

test('a signed-in user on a dashboard page stays there', () => {
  assert.equal(authGateRedirect('/dashboard', '', null, true), null)
  assert.equal(authGateRedirect('/dashboard/kompas', '', null, true), null)
})

test('routes outside the gate are never redirected by it', () => {
  for (const path of ['/kompas', '/kompas/app.js', '/auth/desktop', '/auth/callback', '/api/kompas/answer', '/downloads/kompas']) {
    assert.equal(authGateRedirect(path, '', null, true), null, path + ' signed in')
    assert.equal(authGateRedirect(path, '', null, false), null, path + ' signed out')
  }
})
