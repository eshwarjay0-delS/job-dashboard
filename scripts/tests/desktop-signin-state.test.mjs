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
const effect = page.slice(page.indexOf('let gone = false'), page.indexOf('return () => { gone = true'))
const STATE = 'Zm9yIGEgdGVzdCBvbmx5IC0gbm90IGEgcmVhbCBzdGF0ZQ' // 46 base64url characters, the shape the desktop sends
const CODE = 'A'.repeat(43)

async function visit(search, session = { access_token: 'aaa.bbb.ccc', refresh_token: 'r', expires_at: 9 }, extra = {}) {
  const went = []
  const notes = []
  const intervals = []
  const window = { location: { search, pathname: '/auth/desktop', assign: url => went.push(url), replace: url => went.push(url), set href(url) { went.push(url) } } }
  const fetch = extra.fetch || (async () => ({ ok: true, json: async () => ({ ok: true, code: CODE }) }))
  const context = vm.createContext({
    window, document: { cookie: 'sb-x-auth-token=' + 'v'.repeat(30) },
    setNote: note => notes.push(note), setContinueHref: () => {}, setRetryHref: () => {},
    btoa, unescape, encodeURIComponent, URLSearchParams, fetch, setInterval: (fn, ms) => { intervals.push(ms); return 1 }, clearInterval: () => {},
    createClient: () => ({ auth: { getSession: async () => ({ data: { session }, error: extra.sessionError || null }) } }),
  })
  vm.runInContext(helpers + '\n' + effect, context)
  await new Promise(resolve => setTimeout(resolve, 0))
  return { went, notes, intervals }
}

test('the desktop link carries the nonce and a one-time code, not the browser access token', async () => {
  const { went, notes } = await visit('?state=' + STATE)
  assert.equal(went.length, 1)
  const link = went[0]
  assert.match(link, /^marketfit-kompas:\/\/auth\?code=[A-Za-z0-9_-]{43}&state=/)
  assert.equal(new URL(link).searchParams.get('state'), STATE)
  assert.equal(new URL(link).searchParams.get('code'), CODE)
  assert.equal(link.includes('aaa.bbb.ccc'), false)
  assert.equal(link.includes('refresh_token'), false)
  assert.match(notes.at(-1), /Return to Kompas/)
  assert.doesNotMatch(notes.at(-1), /authenticated|You are signed in/i)
})

test('a missing or malformed state does not pretend the desktop is signed in', async () => {
  for (const search of ['', '?state=', '?state=short', '?state=' + 'a'.repeat(129), '?state=' + encodeURIComponent(STATE + '"><x'), '?state=' + encodeURIComponent(STATE + '&d=other')]) {
    const { went, notes } = await visit(search)
    assert.equal(went.length, 0, search)
    assert.match(notes.at(-1), /Return to Kompas/, search)
    assert.doesNotMatch(notes.at(-1), /authenticated|You are signed in/i, search)
  }
})

test('with no session in Chrome the state survives the sign-in page and the Google callback', async () => {
  const login = (await visit('?state=' + STATE, null)).went[0]
  const next = new URL(login, 'https://marketfit.test').searchParams.get('next')
  assert.equal(next, '/auth/desktop?state=' + STATE)
  assert.equal(safeAuthNext(next), '/auth/desktop?state=' + STATE, 'the login page keeps it')
  const callback = new URL('/auth/callback?next=' + encodeURIComponent(safeAuthNext(next)), 'https://marketfit.test')
  assert.equal(safeAuthNext(callback.searchParams.get('next')), '/auth/desktop?state=' + STATE, 'and so does the callback it returns through')
  assert.equal(new URL((await visit('', null)).went[0], 'https://marketfit.test').searchParams.get('next'), '/auth/desktop', 'no state, plain return as before')
})

test('the sign-in page passes on only a well-formed desktop state, nothing else from the query', () => {
  assert.equal(safeAuthNext('/auth/desktop?state=short'), '/auth/desktop')
  assert.equal(safeAuthNext('/auth/desktop?state=' + STATE + '&next=https://evil.example'), '/auth/desktop?state=' + STATE)
  assert.equal(safeAuthNext('/auth/desktop?other=1#x'), '/auth/desktop')
  assert.equal(safeAuthNext('/auth/desktop?state=' + encodeURIComponent(STATE + '&x=1')), '/auth/desktop')
})

// Regression: a completed Chrome session must not repeatedly spawn the Windows
// protocol handler, because each invocation can relaunch Kompas and trigger UAC.
test('a loopback return carries the one-time code and never another address or the access token', async () => {
  const loop = 'http://127.0.0.1:17321/cb'
  const { went } = await visit('?state=' + STATE + '&loopback=' + encodeURIComponent(loop))
  assert.equal(went.length, 1)
  const back = new URL(went[0])
  assert.equal(back.origin + back.pathname, loop)
  assert.equal(back.searchParams.get('state'), STATE)
  assert.equal(back.searchParams.get('code'), CODE)
  assert.equal(back.searchParams.has('d'), false)
  assert.equal(went[0].includes('aaa.bbb.ccc'), false)
  for (const bad of ['https://127.0.0.1:17321/cb', 'http://127.0.0.1:80/cb', 'http://localhost:17321/cb', 'http://evil.example/cb']) {
    const quiet = await visit('?state=' + STATE + '&loopback=' + encodeURIComponent(bad))
    assert.equal(quiet.went.length, 1, bad)
    assert.ok(quiet.went[0].startsWith('marketfit-kompas://auth?code='), bad)
    assert.equal(quiet.went[0].includes('aaa.bbb.ccc'), false, bad)
  }
})

test('a loopback code does not carry Chrome\'s refresh token', async () => {
  const loop = 'http://127.0.0.1:17321/cb'
  const session = { access_token: 'aaa.bbb.ccc', refresh_token: 'chrome-family-secret', expires_at: 9 }
  const { went } = await visit('?state=' + STATE + '&loopback=' + encodeURIComponent(loop), session)
  assert.equal(went[0].includes('chrome-family-secret'), false)
  assert.equal(new URL(went[0]).searchParams.has('d'), false)
  assert.match(page, /does not erase a stored desktop refresh/)
})

test('a silent renewal with no Chrome session does not open a login form', async () => {
  const { went } = await visit('?state=' + STATE + '&loopback=' + encodeURIComponent('http://127.0.0.1:17321/cb'), null)
  assert.equal(went.length, 0)
})

test('the desktop handoff launches once and polls claim status only while this page is open', async () => {
  const { went, intervals } = await visit('?state=' + STATE)
  assert.equal(went.length, 1)
  assert.ok(went[0].startsWith('marketfit-kompas://auth?code='))
  assert.equal(new URL(went[0]).searchParams.get('state'), STATE)
  assert.deepEqual(intervals, [2500])
})

test('a sign-in service error is shown as an error and never as authenticated', async () => {
  const { went, notes, intervals } = await visit('?state=' + STATE, undefined, {
    fetch: async () => ({ ok: false, status: 503, json: async () => ({ ok: false, error: 'sign_in_unavailable', message: 'MarketFit could not reach the sign-in service. Nothing was signed out. Return to Kompas and try again.' }) }),
  })
  assert.equal(went.length, 0)
  assert.equal(intervals.length, 0)
  assert.match(notes.at(-1), /could not reach the sign-in service/)
  assert.doesNotMatch(notes.join(' '), /authenticated|You are signed in/i)
})

test('native desktop never launches another automatic Chrome login on reconnect', () => {
  const native = readFileSync(new URL('../../legacy/perfact/desktop/main.js', import.meta.url), 'utf8')
  const handoff = readFileSync(new URL('../../legacy/perfact/desktop/chrome-handoff.cjs', import.meta.url), 'utf8')
  assert.match(native, /let chromeSignInAttempted = false/)
  assert.match(native, /if \(desktopAuth\.hasSession\(\)\) return/)
  assert.match(native, /chromeSignInAttempted = true/)
  assert.match(native, /beginChromeSignIn\(\{ interactive: true \}\)/)
  assert.match(handoff, /if \(!interactive && alreadyAttempted\) return \{ show: true, openChrome: false/)
  assert.doesNotMatch(native, /Date\.now\(\) - lastChromeSignIn < 8000/)
  assert.equal(native.includes('desktopAuth.clear('), false)
})

test('a first Chrome handoff keeps the loopback through Google sign-in', async () => {
  const loop = 'http://127.0.0.1:17321/cb'
  const login = (await visit('?state=' + STATE + '&loopback=' + encodeURIComponent(loop) + '&handoff=start', null)).went[0]
  const next = new URL(login, 'https://marketfit.test').searchParams.get('next')
  assert.equal(safeAuthNext(next), '/auth/desktop?state=' + STATE + '&loopback=' + encodeURIComponent(loop) + '&handoff=start')
  const back = await visit('?state=' + STATE + '&loopback=' + encodeURIComponent(loop) + '&handoff=start')
  const returned = new URL(back.went[0])
  assert.equal(returned.origin + returned.pathname, loop)
  assert.equal(returned.searchParams.get('state'), STATE)
  assert.equal(returned.searchParams.get('code'), CODE)
  assert.equal(returned.searchParams.has('d'), false)
})
