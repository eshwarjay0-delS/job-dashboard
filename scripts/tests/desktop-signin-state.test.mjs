// The desktop accepts only a sign-in it started: it opens /auth/desktop with ?state=, and this page must hand the
// same state back on the kompas:// link, including after a detour through /login when Chrome had no session.
// Runs the page's real effect body and helpers, sliced out of page.tsx, against a fake browser.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import { safeAuthNext } from '../../src/lib/authRedirect.ts'

const page = readFileSync(new URL('../../src/app/auth/desktop/page.tsx', import.meta.url), 'utf8')
const helpers = stripTypeScriptTypes(page.slice(page.indexOf('function desktopState'), page.indexOf('export default')))
const effect = page.slice(page.indexOf('let gone = false'), page.indexOf('return () => { gone = true }'))
const STATE = 'Zm9yIGEgdGVzdCBvbmx5IC0gbm90IGEgcmVhbCBzdGF0ZQ' // 46 base64url characters, the shape the desktop sends

async function visit(search, session = { access_token: 'aaa.bbb.ccc', refresh_token: 'r', expires_at: 9 }) {
  const went = []
  const window = { location: { search, assign: url => went.push(url), set href(url) { went.push(url) } } }
  const context = vm.createContext({ window, document: { cookie: 'sb-x-auth-token=' + 'v'.repeat(30) }, setNote: () => {}, btoa, unescape, encodeURIComponent, URLSearchParams,
    createClient: () => ({ auth: { getSession: async () => ({ data: { session } }) } }) })
  vm.runInContext(helpers + '\n' + effect, context)
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(went.length, 1)
  return went[0]
}

test('the desktop link carries back the state the desktop opened the page with', async () => {
  const link = await visit('?state=' + STATE)
  assert.match(link, /^kompas:\/\/auth\?d=[A-Za-z0-9_-]+&state=/)
  assert.equal(new URL(link).searchParams.get('state'), STATE)
  assert.equal(JSON.parse(Buffer.from(new URL(link).searchParams.get('d'), 'base64url').toString()).access_token, 'aaa.bbb.ccc', 'the session itself is unchanged')
})

test('a missing or malformed state is left off the link, as an older desktop expects', async () => {
  for (const search of ['', '?state=', '?state=short', '?state=' + 'a'.repeat(129), '?state=' + encodeURIComponent(STATE + '"><x'), '?state=' + encodeURIComponent(STATE + '&d=other')]) {
    const link = await visit(search)
    assert.match(link, /^kompas:\/\/auth\?d=[A-Za-z0-9_-]+$/, search)
  }
})

test('with no session in Chrome the state survives the sign-in page and the Google callback', async () => {
  const login = await visit('?state=' + STATE, null)
  const next = new URL(login, 'https://marketfit.test').searchParams.get('next')
  assert.equal(next, '/auth/desktop?state=' + STATE)
  assert.equal(safeAuthNext(next), '/auth/desktop?state=' + STATE, 'the login page keeps it')
  const callback = new URL('/auth/callback?next=' + encodeURIComponent(safeAuthNext(next)), 'https://marketfit.test')
  assert.equal(safeAuthNext(callback.searchParams.get('next')), '/auth/desktop?state=' + STATE, 'and so does the callback it returns through')
  assert.equal(new URL(await visit('', null), 'https://marketfit.test').searchParams.get('next'), '/auth/desktop', 'no state, plain return as before')
})

test('the sign-in page passes on only a well-formed desktop state, nothing else from the query', () => {
  assert.equal(safeAuthNext('/auth/desktop?state=short'), '/auth/desktop')
  assert.equal(safeAuthNext('/auth/desktop?state=' + STATE + '&next=https://evil.example'), '/auth/desktop?state=' + STATE)
  assert.equal(safeAuthNext('/auth/desktop?other=1#x'), '/auth/desktop')
  assert.equal(safeAuthNext('/auth/desktop?state=' + encodeURIComponent(STATE + '&x=1')), '/auth/desktop')
})
