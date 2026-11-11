import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import {
  AUTH_DISABLED_FALLBACK_USER_ID,
  disabledOwnerAsUser,
  isAuthDisabled,
  isSyntheticDisabledAuthUser,
} from '../../src/lib/authDisabled.ts'
import { verifyAdminToken } from '../../src/lib/adminSession.ts'
import { clientIp } from '../../src/lib/rateLimit.ts'
import {
  hasSupabaseAuthMaterial,
  isAuthDisabled as isAuthDisabledFlag,
} from '../../src/lib/authDisabled.ts'

function loadGuards() {
  const file = new URL('../../src/lib/syntheticOwnerGuards.ts', import.meta.url)
  const source = stripTypeScriptTypes(readFileSync(file, 'utf8'))
    .replace(/^import[\s\S]*?from\s+["'][^"']+["']\s*;?\s*$/gm, '')
    .replace(/export /g, '')
  const context = vm.createContext({
    process,
    Date,
    Map,
    Math,
    Headers,
    Response,
    URL,
    hasSupabaseAuthMaterial,
    isAuthDisabled: isAuthDisabledFlag,
    verifyAdminToken,
    clientIp,
  })
  vm.runInContext(source, context, { filename: 'syntheticOwnerGuards.ts' })
  for (const name of [
    'SYNTHETIC_READ_PAGE_SIZE', 'SYNTHETIC_OWNER_LIMITS', 'takeTokenBucket',
    'resetSyntheticOwnerBuckets', 'isSyntheticAuthIdentity', 'isUnauthenticatedSyntheticOwnerRequest',
    'rejectIfSyntheticOwnerLimited', 'syntheticReadPageSize', 'capListForSyntheticOwner',
    'capSessionPayloadForSyntheticOwner',
  ]) {
    context[name] = vm.runInContext(name, context)
  }
  return context
}

const guards = loadGuards()

function withEnv(vars, fn) {
  const keys = ['AUTH_DISABLED', 'NEXT_PUBLIC_AUTH_DISABLED']
  const previous = Object.fromEntries(keys.map(key => [key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined]))
  try {
    for (const key of keys) delete process.env[key]
    Object.assign(process.env, vars)
    return fn()
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function fakeRequest({ ip = '203.0.113.10', cookie = '', authorization = null } = {}) {
  const cookies = cookie ? [{ name: cookie.split('=')[0], value: cookie.slice(cookie.indexOf('=') + 1) }] : []
  const headers = new Headers({ 'x-forwarded-for': ip })
  if (authorization) headers.set('authorization', authorization)
  return {
    cookies: {
      get: (name) => cookies.find(c => c.name === name),
      getAll: () => cookies,
    },
    headers,
    method: 'POST',
    nextUrl: new URL('https://app.example/api/answer'),
  }
}

test('the synthetic owner is marked and is not treated as a real admin identity', () => {
  const user = disabledOwnerAsUser({ AUTH_DISABLED_USER_ID: AUTH_DISABLED_FALLBACK_USER_ID })
  assert.equal(isSyntheticDisabledAuthUser(user), true)
  assert.equal(user.email, 'eshwarjay05@gmail.com')
  assert.equal(isSyntheticDisabledAuthUser({ id: 'real', email: 'eshwarjay05@gmail.com', email_confirmed_at: '2020-01-01T00:00:00.000Z' }), false)
  const adminSrc = readFileSync(new URL('../../src/lib/adminAccess.ts', import.meta.url), 'utf8')
  assert.match(adminSrc, /if \(!user \|\| user\.synthetic\) return null/)
  const ownerSrc = readFileSync(new URL('../../src/app/api/admin/owner/route.ts', import.meta.url), 'utf8')
  assert.match(ownerSrc, /user\.synthetic/)
  const onboarding = readFileSync(new URL('../../src/app/api/onboarding/status/route.ts', import.meta.url), 'utf8')
  assert.match(onboarding, /!isSyntheticDisabledAuthUser\(user\) && isOwnerEmail/)
  assert.match(onboarding, /!isSyntheticDisabledAuthUser\(user\) && user\.email_confirmed_at && isAdminEmail/)
})

test('token buckets enforce the published synthetic-owner limits', () => {
  guards.resetSyntheticOwnerBuckets()
  for (let i = 0; i < 30; i++) assert.equal(guards.takeTokenBucket('t-answer-ip', 30, 60_000).ok, true)
  const overflow = guards.takeTokenBucket('t-answer-ip', 30, 60_000)
  assert.equal(overflow.ok, false)
  assert.ok(overflow.retryAfterSec >= 1)
  assert.equal(guards.SYNTHETIC_OWNER_LIMITS.answer.ip.max, 30)
  assert.equal(guards.SYNTHETIC_OWNER_LIMITS.answer.global.max, 300)
  assert.equal(guards.SYNTHETIC_OWNER_LIMITS.transcribe.ip.max, 60)
  assert.equal(guards.SYNTHETIC_OWNER_LIMITS.tailor.ip.max, 10)
  assert.equal(guards.SYNTHETIC_OWNER_LIMITS.tailor.ip.windowMs, 3_600_000)
})

test('an unauthenticated synthetic owner is 429 after the answer limit; a real session is not', async () => {
  await withEnv({ AUTH_DISABLED: 'true' }, async () => {
    assert.equal(isAuthDisabled(), true)
    guards.resetSyntheticOwnerBuckets()
    const synthetic = { id: 'owner', email: 'eshwarjay0@gmail.com', synthetic: true }
    const req = fakeRequest({ ip: '198.51.100.20' })
    for (let i = 0; i < 30; i++) {
      const allowed = guards.rejectIfSyntheticOwnerLimited(req, 'answer', synthetic)
      assert.equal(allowed, null)
    }
    const blocked = guards.rejectIfSyntheticOwnerLimited(req, 'answer', synthetic)
    assert.ok(blocked)
    assert.equal(blocked.status, 429)
    const body = await blocked.json()
    assert.equal(body.code, 'RATE_LIMITED')
    assert.match(body.error, /answer limit/i)

    const signedIn = guards.rejectIfSyntheticOwnerLimited(
      fakeRequest({ ip: '198.51.100.20', authorization: 'Bearer real-session-token' }),
      'answer',
      { id: 'real', email: 'eshwarjay0@gmail.com' },
    )
    assert.equal(signedIn, null)
  })
})

test('session and resume reads are capped at 20 rows without a full history dump', () => {
  const req = fakeRequest()
  const synthetic = { synthetic: true }
  withEnv({ AUTH_DISABLED: 'true' }, () => {
    assert.equal(guards.syntheticReadPageSize(req, synthetic, 100), guards.SYNTHETIC_READ_PAGE_SIZE)
    const rows = guards.capListForSyntheticOwner(req, synthetic, Array.from({ length: 50 }, (_, i) => i))
    assert.deepEqual(rows, Array.from({ length: 20 }, (_, i) => i))
    const payload = guards.capSessionPayloadForSyntheticOwner(req, synthetic, {
      transcripts: [1, 2, 3, 4, 5, 6, 7],
      history: ['a', 'b', 'c', 'd', 'e', 'f'],
      role: 'kept',
    })
    assert.deepEqual(payload.transcripts, [3, 4, 5, 6, 7])
    assert.deepEqual(payload.history, ['b', 'c', 'd', 'e', 'f'])
    assert.equal(payload.role, 'kept')
  })
  withEnv({}, () => {
    assert.equal(guards.syntheticReadPageSize(req, null, 100), 100)
  })
})
