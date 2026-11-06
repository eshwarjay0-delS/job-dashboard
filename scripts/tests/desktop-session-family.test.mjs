// A desktop refresh family stays valid when two website tabs rotate the cookie
// family. The website path and the desktop path do not present each other's
// tokens. A second desktop presentation of a token this process already
// rotated is already_used, and that second call does not ask the provider
// again, so the successor keeps working.
import test, { describe, after } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  classifyRefreshFailure,
  createDesktopSessionMemory,
  exchangeDesktopSession,
  readDesktopSessionRequest,
  resetDesktopSessionMemory,
} from '../../src/lib/desktopSession.ts'

after(() => resetDesktopSessionMemory())

const ALREADY_USED = 'Invalid Refresh Token: Already Used'

function createFamilies() {
  let n = 0
  const families = new Map()
  function issue(userId) {
    const familyId = 'fam-' + (++n)
    const refreshToken = familyId + '-r0'
    families.set(familyId, {
      userId,
      current: refreshToken,
      generation: 0,
      seen: new Set([refreshToken]),
      revoked: false,
    })
    return credential(familyId, 0)
  }
  function credential(familyId, generation) {
    const family = families.get(familyId)
    return {
      accessToken: familyId + '-a' + generation,
      refreshToken: familyId + '-r' + generation,
      expiresAt: 1_800_000_000 + generation,
      familyId,
      userId: family?.userId || '',
    }
  }
  function refresh(token) {
    for (const family of families.values()) {
      if (!family.revoked && family.current === token) {
        family.generation += 1
        const next = credential([...families.entries()].find(([, value]) => value === family)[0], family.generation)
        family.current = next.refreshToken
        family.seen.add(next.refreshToken)
        return { session: next, error: null }
      }
    }
    for (const family of families.values()) {
      if (family.seen.has(token)) {
        family.revoked = true
        return { session: null, error: { message: ALREADY_USED, code: 'refresh_token_already_used' } }
      }
    }
    if (/revok/i.test(token)) {
      return { session: null, error: { message: 'Refresh token revoked', code: 'refresh_token_revoked' } }
    }
    return { session: null, error: { message: 'invalid_grant', code: 'invalid_grant' } }
  }
  return {
    issue,
    refresh,
    family(id) { return families.get(id) },
    familyOf(refreshToken) {
      for (const [id, family] of families) if (family.seen.has(refreshToken)) return id
      return ''
    },
  }
}

function portFor(server, calls) {
  return {
    async userFromAccessToken(accessToken) {
      calls.bearers.push(accessToken)
      return accessToken === 'live-bearer' ? { id: 'user-1', email: 'person@example.com' } : null
    },
    async refreshPresented(refreshToken) {
      calls.refreshed.push(refreshToken)
      return server.refresh(refreshToken)
    },
    async mintIndependentSession(user) {
      calls.minted.push(user.id)
      return { session: server.issue(user.id), error: null }
    },
  }
}

describe('desktop session refresh family', { concurrency: 1 }, () => {
  test('two website tabs rotating the cookie family leave the desktop family usable', async () => {
    const server = createFamilies()
    const memory = createDesktopSessionMemory()
    const calls = { bearers: [], refreshed: [], minted: [] }
    const port = portFor(server, calls)
    const web = server.issue('user-1')

    const opened = await exchangeDesktopSession({ accessToken: 'live-bearer', refreshToken: '' }, port, memory)
    assert.equal(opened.status, 200)
    assert.equal(opened.body.ok, true)
    assert.equal(opened.body.session, 'desktop')
    assert.equal(opened.body.user_id, 'user-1')
    assert.equal(typeof opened.body.expires_at, 'number')
    assert.notEqual(opened.body.refresh_token, web.refreshToken)
    const desktopFamily = server.familyOf(opened.body.refresh_token)
    assert.notEqual(desktopFamily, web.familyId)
    assert.equal(calls.refreshed.length, 0, 'opening a desktop session does not rotate any refresh token')

    const firstTab = server.refresh(web.refreshToken)
    const secondTab = server.refresh(web.refreshToken)
    assert.equal(firstTab.session.familyId, web.familyId)
    assert.equal(secondTab.error.message, ALREADY_USED)
    assert.equal(server.family(web.familyId).revoked, true)
    assert.equal(server.family(desktopFamily).revoked, false)
    assert.deepEqual(calls.refreshed, [], 'website tab rotation never presented the desktop token')

    const renewed = await exchangeDesktopSession(
      { accessToken: 'expired.bearer.token', refreshToken: opened.body.refresh_token },
      port,
      memory,
    )
    assert.equal(renewed.status, 200)
    assert.equal(renewed.body.session, 'desktop')
    assert.equal(server.familyOf(renewed.body.refresh_token), desktopFamily)
    assert.notEqual(renewed.body.refresh_token, opened.body.refresh_token)
    assert.equal(server.family(desktopFamily).revoked, false)
    assert.deepEqual(calls.refreshed, [opened.body.refresh_token])
  })

  test('a desktop renewal that loses does not revoke the winner or the website family', async () => {
    const server = createFamilies()
    const memory = createDesktopSessionMemory()
    const calls = { bearers: [], refreshed: [], minted: [] }
    const port = portFor(server, calls)
    const web = server.issue('user-1')
    const opened = await exchangeDesktopSession({ accessToken: 'live-bearer', refreshToken: '' }, port, memory)
    const original = opened.body.refresh_token

    const [first, second] = await Promise.all([
      exchangeDesktopSession({ accessToken: null, refreshToken: original }, port, memory),
      exchangeDesktopSession({ accessToken: null, refreshToken: original }, port, memory),
    ])
    assert.equal(first.status, 200)
    assert.equal(second.status, 200)
    assert.equal(first.body.refresh_token, second.body.refresh_token)
    assert.equal(calls.refreshed.length, 1)

    const late = await exchangeDesktopSession({ accessToken: null, refreshToken: original }, port, memory)
    assert.equal(late.status, 401)
    assert.deepEqual(late.body, { ok: false, error: 'already_used', error_description: ALREADY_USED })
    assert.equal(Object.hasOwn(late.body, 'clear'), false)
    assert.equal(calls.refreshed.length, 1, 'the loser does not present the used token again')

    const winner = await exchangeDesktopSession(
      { accessToken: null, refreshToken: first.body.refresh_token },
      port,
      memory,
    )
    assert.equal(winner.status, 200)
    assert.equal(server.family(web.familyId).revoked, false)
    const website = server.refresh(web.refreshToken)
    assert.equal(website.session.familyId, web.familyId)
  })

  test('a bearer with an empty refresh token does not erase a stored desktop refresh', async () => {
    const server = createFamilies()
    const memory = createDesktopSessionMemory()
    const calls = { bearers: [], refreshed: [], minted: [] }
    const port = portFor(server, calls)
    const first = await exchangeDesktopSession({ accessToken: 'live-bearer', refreshToken: '   ' }, port, memory)
    const stored = first.body.refresh_token
    const again = await exchangeDesktopSession({ accessToken: 'live-bearer', refreshToken: '' }, port, memory)
    assert.notEqual(again.body.refresh_token, '')
    assert.notEqual(again.body.refresh_token, stored)
    assert.equal(Object.hasOwn(again.body, 'clear'), false)
    const still = await exchangeDesktopSession({ accessToken: null, refreshToken: stored }, port, memory)
    assert.equal(still.status, 200)
    assert.equal(server.familyOf(still.body.refresh_token), server.familyOf(stored))
  })

  test('invalid_grant and revoked stay explicit', async () => {
    const memory = createDesktopSessionMemory()
    const missing = await exchangeDesktopSession(
      { accessToken: null, refreshToken: 'not-a-session' },
      portFor(createFamilies(), { bearers: [], refreshed: [], minted: [] }),
      memory,
    )
    assert.equal(missing.status, 401)
    assert.equal(missing.body.error, 'invalid_grant')
    assert.equal(missing.body.error_description, 'invalid_grant')

    const revoked = await exchangeDesktopSession(
      { accessToken: null, refreshToken: 'revoked-token' },
      portFor(createFamilies(), { bearers: [], refreshed: [], minted: [] }),
      memory,
    )
    assert.equal(revoked.status, 401)
    assert.equal(revoked.body.error, 'revoked')
    assert.match(revoked.body.error_description, /revok/i)

    const provider = classifyRefreshFailure({ message: ALREADY_USED, code: 'refresh_token_already_used' })
    assert.deepEqual(provider, { error: 'already_used', error_description: ALREADY_USED })
    const notFound = classifyRefreshFailure({ message: 'Invalid Refresh Token: Refresh Token Not Found', code: 'refresh_token_not_found' })
    assert.equal(notFound.error, 'invalid_grant')
    assert.match(notFound.error_description, /Not Found/)
  })

  test('the request reader ignores the website cookie and the route answers the desktop contract', async () => {
    const server = createFamilies()
    const memory = createDesktopSessionMemory()
    const calls = { bearers: [], refreshed: [], minted: [] }
    const port = portFor(server, calls)
    const web = server.issue('user-1')
    const openedRead = await readDesktopSessionRequest(fakeRequest({
      authorization: 'Bearer live-bearer',
      cookie: 'sb-refresh-token=' + web.refreshToken,
      body: { refresh_token: '' },
    }))
    assert.equal(openedRead.refreshToken, '')
    assert.equal(openedRead.accessToken, 'live-bearer')
    const opened = await exchangeDesktopSession(openedRead, port, memory)
    assert.equal(opened.status, 200)
    assert.equal(opened.body.session, 'desktop')
    assert.deepEqual(calls.refreshed, [])
    assert.equal(server.family(web.familyId).current, web.refreshToken)

    const renewedRead = await readDesktopSessionRequest(fakeRequest({
      authorization: 'Bearer live-bearer',
      cookie: 'sb-refresh-token=' + web.refreshToken,
      body: { refresh_token: opened.body.refresh_token },
    }))
    const renewed = await exchangeDesktopSession(renewedRead, port, memory)
    assert.equal(renewed.status, 200)
    assert.deepEqual(calls.refreshed, [opened.body.refresh_token])
    assert.equal(server.family(web.familyId).revoked, false)
    assert.notEqual(renewed.body.refresh_token, web.refreshToken)

    const lost = await exchangeDesktopSession(
      { accessToken: null, refreshToken: opened.body.refresh_token },
      port,
      memory,
    )
    assert.equal(lost.status, 401)
    assert.deepEqual(lost.body, { ok: false, error: 'already_used', error_description: ALREADY_USED })
    assert.equal(server.family(web.familyId).revoked, false)
  })

  test('malformed calls name invalid_grant and do not mint', async () => {
    const calls = { bearers: [], refreshed: [], minted: [] }
    const wrongType = await readDesktopSessionRequest(fakeRequest({ body: { refresh_token: '' }, contentType: 'text/plain' }))
    assert.equal(wrongType.status, 415)
    assert.equal(wrongType.body.error, 'invalid_grant')
    const badJson = await readDesktopSessionRequest(fakeRequest({ raw: '{', contentType: 'application/json' }))
    assert.equal(badJson.status, 400)
    assert.equal(badJson.body.error, 'invalid_grant')
    const absent = await readDesktopSessionRequest(fakeRequest({ body: {} }))
    assert.equal(absent.accessToken, null)
    assert.equal(absent.refreshToken, '')
    const exchanged = await exchangeDesktopSession(absent, portFor(createFamilies(), calls), createDesktopSessionMemory())
    assert.equal(exchanged.status, 401)
    assert.equal(exchanged.body.error, 'invalid_grant')
    assert.match(exchanged.body.error_description, /required/)
    assert.equal(calls.minted.length, 0)
    assert.equal(calls.refreshed.length, 0)
  })

  test('the desktop route is separate from the website refresh route', () => {
    const desktop = readFileSync(new URL('../../src/app/api/auth/desktop-session/route.ts', import.meta.url), 'utf8')
    const adapter = readFileSync(new URL('../../src/lib/desktopSessionSupabase.ts', import.meta.url), 'utf8')
    const website = readFileSync(new URL('../../src/app/api/auth/refresh/route.ts', import.meta.url), 'utf8')
    const page = readFileSync(new URL('../../src/app/auth/desktop/page.tsx', import.meta.url), 'utf8')
    assert.match(desktop, /export async function POST/)
    assert.match(desktop, /readDesktopSessionRequest\(request\)/)
    assert.match(desktop, /Cache-Control": "no-store"/)
    assert.doesNotMatch(desktop, /export async function GET/)
    assert.doesNotMatch(desktop, /request\.cookies|headers\.get\("cookie"\)|createClientFromRequest|createServerClient/)
    assert.match(adapter, /generateLink\(\{ type: "magiclink"/)
    assert.match(adapter, /verifyOtp/)
    assert.match(adapter, /refreshSession\(\{ refresh_token: refreshToken \}\)/)
    assert.match(adapter, /persistSession: false/)
    assert.doesNotMatch(adapter, /cookies\(|createServerClient|createClientFromRequest/)
    assert.match(website, /POST \/api\/auth\/desktop-session/)
    assert.doesNotMatch(website, /from "@\/lib\/desktopSession|generateLink|mintIndependentSession/)
    assert.match(website, /refreshSession\(\)/)
    assert.match(page, /does not erase a stored desktop refresh/)
    assert.match(page, /POST \/api\/auth\/desktop-session/)
  })
})

function fakeRequest({ authorization, cookie, body, raw, contentType = 'application/json' } = {}) {
  const headers = new Headers()
  if (contentType) headers.set('content-type', contentType)
  if (authorization) headers.set('authorization', authorization)
  if (cookie) headers.set('cookie', cookie)
  return {
    headers,
    async json() {
      if (raw !== undefined) return JSON.parse(raw)
      return body ?? {}
    },
  }
}
