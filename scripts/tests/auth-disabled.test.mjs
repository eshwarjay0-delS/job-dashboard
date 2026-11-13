import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import vm from 'node:vm'
import path from 'node:path'
import {
  AUTH_DISABLED_FALLBACK_USER_ID,
  LOGIN_OFF_OWNER_EMAIL,
  attachDisabledAuthFallback,
  disabledOwnerUser,
  isAuthDisabled,
} from '../../src/lib/authDisabled.ts'
import { safeDisabledAuthNext } from '../../src/lib/authRedirect.ts'
import { isSupabaseRestricted, softenSupabaseDataAccess } from '../../src/lib/supabaseRestriction.ts'
import { PRODUCT_OWNER_EMAIL } from '../../src/lib/owner.ts'

function withEnv(vars, fn) {
  const keys = ['AUTH_DISABLED', 'NEXT_PUBLIC_AUTH_DISABLED', 'AUTH_DISABLED_USER_ID', 'AUTH_DISABLED_USER_EMAIL', 'OWNER_USER_ID', 'AUTH_DISABLED_EMAIL', 'OWNER_EMAIL', 'WHATSAPP_OWNER_NUMBERS']
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

test('unset, false, and true keep owner mode; only off-confirmed-by-eshwar turns it off', () => {
  withEnv({}, () => {
    assert.equal(isAuthDisabled({}), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: '' }), true)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: '' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false' }), true)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: 'false' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'true' }), true)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: 'true' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'TRUE' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: '1' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'on' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'yes' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false', NEXT_PUBLIC_AUTH_DISABLED: 'true' }), true)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'off-confirmed-by-eshwar' }), false)
    assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: 'off-confirmed-by-eshwar' }), false)
    assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false', NEXT_PUBLIC_AUTH_DISABLED: 'off-confirmed-by-eshwar' }), true)
  })
  const src = readFileSync(new URL('../../src/lib/authDisabled.ts', import.meta.url), 'utf8')
  assert.match(src, /Eshwar requires skip-login\. Do not change without his confirmation in Grok Bot chat\./)
})

test('owner identity uses the Houston email and AUTH_DISABLED_USER_ID, never Saint Louis', () => {
  const houstonId = '67f02d95-f7fe-4058-9b0d-9363221e7c61'
  const fallback = disabledOwnerUser({})
  assert.equal(fallback.email, LOGIN_OFF_OWNER_EMAIL)
  assert.equal(fallback.email, 'eshwarjay05@gmail.com')
  assert.equal(fallback.id, AUTH_DISABLED_FALLBACK_USER_ID)
  assert.equal(fallback.id, houstonId)
  assert.notEqual(LOGIN_OFF_OWNER_EMAIL, PRODUCT_OWNER_EMAIL)

  assert.deepEqual(
    disabledOwnerUser({ AUTH_DISABLED_USER_ID: houstonId, OWNER_USER_ID: 'ignored' }),
    { id: houstonId, email: LOGIN_OFF_OWNER_EMAIL },
  )
  assert.deepEqual(
    disabledOwnerUser({ OWNER_USER_ID: 'user-from-owner-env' }),
    { id: houstonId, email: LOGIN_OFF_OWNER_EMAIL },
  )
  assert.deepEqual(
    disabledOwnerUser({ WHATSAPP_OWNER_NUMBERS: '+1 (314) 555-0100=wa-owner-uuid, +15555550111' }),
    { id: houstonId, email: LOGIN_OFF_OWNER_EMAIL },
  )
  assert.equal(
    disabledOwnerUser({ AUTH_DISABLED_USER_EMAIL: 'EshwarJay05@Gmail.com', AUTH_DISABLED_USER_ID: houstonId }).email,
    'eshwarjay05@gmail.com',
  )
  assert.equal(
    disabledOwnerUser({ AUTH_DISABLED_EMAIL: 'someone@example.com', AUTH_DISABLED_USER_ID: 'abc' }).email,
    'someone@example.com',
  )
  assert.equal(disabledOwnerUser({ AUTH_DISABLED_USER_EMAIL: 'jayeshwar44@gmail.com' }).email, LOGIN_OFF_OWNER_EMAIL)
  assert.equal(disabledOwnerUser({ AUTH_DISABLED_EMAIL: 'jayeshwar44@gmail.com' }).email, LOGIN_OFF_OWNER_EMAIL)
  assert.equal(disabledOwnerUser({ OWNER_EMAIL: 'jayeshwar44@gmail.com' }).email, LOGIN_OFF_OWNER_EMAIL)
  const src = readFileSync(new URL('../../src/lib/authDisabled.ts', import.meta.url), 'utf8')
  assert.match(src, /67f02d95-f7fe-4058-9b0d-9363221e7c61/)
  assert.doesNotMatch(src, /listUsers|getUserByEmail|from\("profiles"\)/)
})

test('login-off routes /login and /auth into the app and never opens Supabase OAuth', () => {
  assert.equal(safeDisabledAuthNext('/dashboard/resume'), '/dashboard/resume')
  assert.equal(safeDisabledAuthNext('/dashboard/admin'), '/dashboard')
  assert.equal(safeDisabledAuthNext('/dashboard/admin/vision'), '/dashboard')
  assert.equal(safeDisabledAuthNext('/auth/desktop?state=abc'), '/dashboard')
  assert.equal(safeDisabledAuthNext('https://evil.example/login'), '/dashboard')

  const session = readFileSync(new URL('../../src/lib/supabase/update-session.ts', import.meta.url), 'utf8')
  assert.match(session, /if \(isAuthDisabled\(\) \|\| hasOwnerSkipCookie\(request\.cookies\.getAll\(\)\)\)/)
  assert.match(session, /safeDisabledAuthNext/)
  assert.doesNotMatch(session, /Leave \/login/)
  assert.doesNotMatch(session, /Skip login/)

  const loginLayout = readFileSync(new URL('../../src/app/login/layout.tsx', import.meta.url), 'utf8')
  const signupLayout = readFileSync(new URL('../../src/app/signup/layout.tsx', import.meta.url), 'utf8')
  const authLayout = readFileSync(new URL('../../src/app/auth/layout.tsx', import.meta.url), 'utf8')
  for (const src of [loginLayout, signupLayout, authLayout]) {
    assert.match(src, /enterAppIfAuthDisabled\(/)
  }

  const login = readFileSync(new URL('../../src/app/login/page.tsx', import.meta.url), 'utf8')
  const googleAt = login.indexOf('Continue with Google')
  const skipAt = login.indexOf('Skip sign-in')
  assert.ok(googleAt > 0 && skipAt > googleAt)
  assert.match(login, /action="\/api\/auth\/skip-sign-in"/)
  assert.match(login, /method="post"/)
  assert.doesNotMatch(login, /\{skipLogin &&/)
  assert.match(login, /serverReportsAuthDisabled\(\)/)
  assert.match(login, /window\.location\.replace\("\/dashboard"\)/)
  assert.doesNotMatch(login, /useState\(true\)/)
  const google = readFileSync(new URL('../../src/lib/google-auth.ts', import.meta.url), 'utf8')
  assert.match(google, /if \(await serverReportsAuthDisabled\(\)\)/)
  assert.match(google, /signInWithOAuth/)
  const html = readFileSync(new URL('../../public/kompas/index.html', import.meta.url), 'utf8')
  assert.doesNotMatch(html, /skipLoginBtn/)
  assert.doesNotMatch(html, /Skip login/)
  const kompasApp = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
  assert.doesNotMatch(kompasApp, /skipLoginBtn|paintSkipLoginButton|skip-login/)
  assert.match(kompasApp, /eshwarjay05@gmail\.com/)
  const admin = readFileSync(new URL('../../src/lib/adminAccess.ts', import.meta.url), 'utf8')
  assert.match(admin, /if \(isAuthDisabled\(\) \|\| user\?\.synthetic\) redirect\("\/dashboard"\)/)
})

test('a Supabase restriction JSON or fetch failure becomes an empty result, not a throw', async () => {
  assert.equal(isSupabaseRestricted({ message: 'The project is restricted due to egress quota', error: 'restricted' }), true)
  assert.equal(isSupabaseRestricted({ code: 'restricted', message: 'egress is restricted' }), true)
  assert.equal(isSupabaseRestricted({ message: 'fetch failed' }), true)
  assert.equal(isSupabaseRestricted(new TypeError('Failed to fetch')), true)
  assert.equal(isSupabaseRestricted({ message: 'exceed_egress' }), true)
  assert.equal(isSupabaseRestricted({ message: 'row not found', code: 'PGRST116' }), false)

  const restricted = {
    from() {
      const builder = {
        select() { return this },
        eq() { return this },
        then(resolve, reject) {
          return Promise.resolve({ data: null, error: { message: 'The project is restricted', code: 'restricted' } }).then(resolve, reject)
        },
      }
      return builder
    },
    async rpc() { throw new Error('fetch failed') },
  }
  const soft = softenSupabaseDataAccess(restricted)
  const listed = await soft.from('sessions').select('*').eq('id', '1')
  assert.equal(listed.error, null)
  assert.equal(listed.data, null)
  const rpc = await soft.rpc('merge_anything')
  assert.equal(rpc.error, null)
  assert.equal(rpc.data, null)

  const live = {
    from() {
      return {
        select() { return this },
        then(resolve) { return Promise.resolve({ data: [{ id: 'ok' }], error: null }).then(resolve) },
      }
    },
  }
  const kept = await softenSupabaseDataAccess(live).from('sessions').select('*')
  assert.deepEqual(kept.data, [{ id: 'ok' }])
  assert.equal(kept.error, null)
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
  assert.equal(got.email, 'eshwarjay05@gmail.com')
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


test('capabilities reports authDisabled from the flag, which defaults to owner mode', () => {
  const route = readFileSync(new URL('../../src/app/api/kompas/capabilities/route.ts', import.meta.url), 'utf8')
  assert.match(route, /authDisabled: isAuthDisabled\(\)/)
  assert.equal(isAuthDisabled({}), true)
  assert.equal(isAuthDisabled({ AUTH_DISABLED: 'true' }), true)
  assert.equal(isAuthDisabled({ AUTH_DISABLED: 'false' }), true)
  assert.equal(isAuthDisabled({ AUTH_DISABLED: 'off-confirmed-by-eshwar' }), false)
})


test('auth-flag and stamp default to skip-login; only the confirmed-off value restores sign-in', () => {
  const flag = readFileSync(new URL('../../public/kompas/auth-flag.js', import.meta.url), 'utf8')
  assert.match(flag, /window\.KOMPAS_AUTH_DISABLED = true/)
  assert.match(appSrc, /function isKompasAuthDisabled\(\) \{\n  if \(typeof window !== "undefined" && typeof window\.KOMPAS_AUTH_DISABLED === "boolean"\) return window\.KOMPAS_AUTH_DISABLED;\n  return true;\n\}/)
  const stamp = readFileSync(new URL('../stamp-version.mjs', import.meta.url), 'utf8')
  assert.match(stamp, /return raw !== "off-confirmed-by-eshwar"/)
})
