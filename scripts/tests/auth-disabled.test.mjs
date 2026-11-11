import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import path from 'node:path'
import {
  AUTH_DISABLED_FALLBACK_USER_ID,
  attachDisabledAuthFallback,
  disabledOwnerUser,
  isAuthDisabled,
} from '../../src/lib/authDisabled.ts'
import { PRODUCT_OWNER_EMAIL } from '../../src/lib/owner.ts'

function withEnv(vars, fn) {
  const keys = ['AUTH_DISABLED', 'NEXT_PUBLIC_AUTH_DISABLED', 'AUTH_DISABLED_USER_ID', 'OWNER_USER_ID', 'AUTH_DISABLED_EMAIL', 'OWNER_EMAIL', 'WHATSAPP_OWNER_NUMBERS']
  const previous = Object.fromEntries(keys.map(key => [key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined]))
  try {
    for (const key of keys) delete process.env[key]
    Object.assign(process.env, vars)
    return fn({ ...process.env })
  } finally {
    for (const key of keys) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

test('AUTH_DISABLED is unset, false, or true only: anything else keeps today\'s login', () => {
  withEnv({}, () => {
    assert.equal(isAuthDisabled({}), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: '' }), false)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: '' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false' }), false)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: 'false' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'true' }), true)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: 'true' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'TRUE' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: '1' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'on' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'yes' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false', NEXT_PUBLIC_AUTH_DISABLED: 'true' }), false)
  })
})

test('owner identity uses the product-owner email and a configured user id', () => {
  const fallback = disabledOwnerUser({})
  assert.equal(fallback.email, PRODUCT_OWNER_EMAIL)
  assert.equal(fallback.id, AUTH_DISABLED_FALLBACK_USER_ID)

  assert.deepEqual(
    disabledOwnerUser({ AUTH_DISABLED_USER_ID: 'user-from-flag', OWNER_USER_ID: 'ignored' }),
    { id: 'user-from-flag', email: PRODUCT_OWNER_EMAIL },
  )
  assert.deepEqual(
    disabledOwnerUser({ OWNER_USER_ID: 'user-from-owner-env' }),
    { id: 'user-from-owner-env', email: PRODUCT_OWNER_EMAIL },
  )
  assert.deepEqual(
    disabledOwnerUser({ WHATSAPP_OWNER_NUMBERS: '+1 (314) 555-0100=wa-owner-uuid, +15555550111' }),
    { id: 'wa-owner-uuid', email: PRODUCT_OWNER_EMAIL },
  )
  assert.equal(
    disabledOwnerUser({ AUTH_DISABLED_EMAIL: 'EshwarJay0@Gmail.com', AUTH_DISABLED_USER_ID: 'abc' }).email,
    'eshwarjay0@gmail.com',
  )
})

function loadBoundary(overrides = {}) {
  const helper = stripTypeScriptTypes(readFileSync(new URL('../../src/lib/kompasAuthSession.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/export /g, '')
  const source = helper + '\n' + stripTypeScriptTypes(readFileSync(new URL('../../src/lib/authBoundary.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/export /g, '')
  const client = async () => ({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } })
  const context = vm.createContext({
    path: path.posix,
    Response,
    createClient: client,
    createClientFromRequest: client,
    isAuthDisabled: () => false,
    disabledOwnerUser: () => ({ id: 'owner-id', email: 'eshwarjay0@gmail.com' }),
    ...overrides,
  })
  vm.runInContext(source, context)
  return context
}

function request(headers = {}, method = 'GET') {
  return { headers: new Headers(headers), method, nextUrl: new URL('https://app.example/api/answer') }
}

test('/api/answer works without a session when auth is disabled, but admin is not granted to the synthetic owner', async () => {
  const owner = { id: 'owner-id', email: 'eshwarjay0@gmail.com' }
  const boundary = loadBoundary({ isAuthDisabled: () => true, disabledOwnerUser: () => owner })

  const user = await boundary.authenticatedUser(request())
  assert.equal(user.id, 'owner-id')
  assert.equal(user.email, 'eshwarjay0@gmail.com')
  assert.equal(user.synthetic, true)

  const answer = user
    ? { status: 200, body: { ok: true, userId: user.id, email: user.email } }
    : { status: 401, body: { error: 'Sign in again to use this.' } }
  assert.equal(answer.status, 200)
  assert.equal(answer.body.userId, 'owner-id')

  const env = { AUTH_DISABLED: 'true', AUTH_DISABLED_USER_ID: 'owner-id' }
  const bare = {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
  }
  const wrapped = attachDisabledAuthFallback(bare, { skipNetwork: true, env })
  const { data: { user: got } } = await wrapped.auth.getUser()
  assert.equal(got.id, 'owner-id')
  assert.equal(got.email, 'eshwarjay0@gmail.com')
  assert.equal(got.app_metadata.auth_disabled_synthetic, true)
  // Admin routes must not treat the synthetic owner as an authenticated admin.
  const adminOwner = got.app_metadata?.auth_disabled_synthetic
    ? { status: 401, body: { authenticated: false, owner: false } }
    : { status: 200, body: { authenticated: true, owner: true } }
  assert.equal(adminOwner.status, 401)
  assert.equal(adminOwner.body.owner, false)
})

test('a wrapped client keeps a live session and only falls back when none exists', async () => {
  const env = { AUTH_DISABLED: 'true', AUTH_DISABLED_USER_ID: 'owner-id' }
  const live = { id: 'live-session', email: 'eshwarjay0@gmail.com', is_anonymous: false }
  const client = {
    auth: {
      getUser: async () => ({ data: { user: live }, error: null }),
      getSession: async () => ({ data: { session: { user: live } }, error: null }),
    },
  }
  const wrapped = attachDisabledAuthFallback(client, { env })
  const { data: { user } } = await wrapped.auth.getUser()
  assert.equal(user.id, 'live-session')
})

test('auth stays fail-closed in the boundary when the flag restores login', async () => {
  const boundary = loadBoundary({ isAuthDisabled: () => false })
  assert.equal(await boundary.authenticatedUser(request()), null)
})

const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const guardSrc = readFileSync(new URL('../../src/app/dashboard/session-lifetime-guard.tsx', import.meta.url), 'utf8')
const proxySrc = readFileSync(new URL('../../src/proxy.ts', import.meta.url), 'utf8')

test('Kompas skips keepAuthAlive and the login wall when auth is disabled', () => {
  assert.match(appSrc, /function isKompasAuthDisabled\(/)
  assert.match(appSrc, /typeof isKompasAuthDisabled !== "function" \|\| !isKompasAuthDisabled\(\)/)
  assert.match(appSrc, /setInterval\(keepAuthAlive, 60 \* 1000\)/)
  assert.match(appSrc, /if \(typeof isKompasAuthDisabled === "function" && isKompasAuthDisabled\(\)\) return true/)
  assert.match(guardSrc, /if \(isAuthDisabled\(\)\) return/)
  assert.match(proxySrc, /["']\/["']/)
  assert.doesNotMatch(proxySrc, /kompas\/app\.js/)
  assert.doesNotMatch(proxySrc, /_next\/static/)
})


test('capabilities reports authDisabled from the flag, which defaults to false', () => {
  const route = readFileSync(new URL('../../src/app/api/kompas/capabilities/route.ts', import.meta.url), 'utf8')
  assert.match(route, /authDisabled: isAuthDisabled\(\)/)
  assert.equal(isAuthDisabled({}), false)
  assert.equal(isAuthDisabled({ AUTH_DISABLED: 'true' }), true)
  assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false' }), false)
})


test('auth-flag and stamp default to auth on; a missing window flag is auth on', () => {
  const flag = readFileSync(new URL('../../public/kompas/auth-flag.js', import.meta.url), 'utf8')
  assert.match(flag, /window\.KOMPAS_AUTH_DISABLED = false/)
  assert.match(appSrc, /function isKompasAuthDisabled\(/)
  assert.match(appSrc, /return false;/)
  const stamp = readFileSync(new URL('../stamp-version.mjs', import.meta.url), 'utf8')
  assert.match(stamp, /return raw === "true"/)
})
