import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  AUTH_DISABLED_FALLBACK_USER_ID,
  attachDisabledAuthFallback,
} from '../../src/lib/authDisabled.ts'

// Regression: the skip-login synthetic session used to carry the literal
// "auth-disabled" as its access_token. supabase-js sends
// session.access_token as the Bearer token on every PostgREST request
// (fetchWithAuth -> _getAccessToken -> auth.getSession), and PostgREST
// rejects a 1-part non-JWT token with PGRST301 401 ("Expected 3 parts in
// JWT; got 1"). That 401ed the profiles + connected_services reads in
// GET /api/connections/status, which 503ed the whole Gmail accounts page
// (0/4 accounts, WhatsApp unknown) even though the Google connection was
// fine. The synthetic session must carry the anon/publishable key — the
// correct no-real-session token — so data reads go out as role anon.

const ENV_KEYS = [
  'AUTH_DISABLED',
  'NEXT_PUBLIC_AUTH_DISABLED',
  'AUTH_DISABLED_USER_ID',
  'AUTH_DISABLED_USER_EMAIL',
  'OWNER_USER_ID',
  'AUTH_DISABLED_EMAIL',
  'OWNER_EMAIL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
]

function withEnv(vars, fn) {
  const previous = Object.fromEntries(ENV_KEYS.map(key => [key, Object.prototype.hasOwnProperty.call(process.env, key) ? process.env[key] : undefined]))
  try {
    for (const key of ENV_KEYS) delete process.env[key]
    Object.assign(process.env, vars)
    return fn()
  } finally {
    for (const key of ENV_KEYS) {
      if (previous[key] === undefined) delete process.env[key]
      else process.env[key] = previous[key]
    }
  }
}

function fakeClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: 'Auth session missing!' } }),
      getSession: async () => ({ data: { session: null }, error: null }),
      getClaims: async () => ({ data: { claims: null }, error: null }),
    },
  }
}

function patchedSession(env) {
  return withEnv(env, async () => {
    const client = attachDisabledAuthFallback(fakeClient(), { skipNetwork: true, force: true })
    const { data: { session } } = await client.auth.getSession()
    const { data: { user } } = await client.auth.getUser()
    return { session, user }
  })
}

test('synthetic session carries the anon key as its access token, not the literal', async () => {
  const { session, user } = await patchedSession({
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'sb_publishable_faketestkey123',
    NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co',
  })
  assert.ok(session)
  assert.equal(session.access_token, 'sb_publishable_faketestkey123')
  assert.notEqual(session.access_token, 'auth-disabled')
  assert.equal(session.user.id, AUTH_DISABLED_FALLBACK_USER_ID)
  assert.equal(session.user.email, 'eshwarjay05@gmail.com')
  assert.equal(user.id, AUTH_DISABLED_FALLBACK_USER_ID)
})

test('access token is a usable Bearer token: publishable key or 3-part JWT', async () => {
  for (const key of [
    'sb_publishable_faketestkey123',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiJ9.signature',
  ]) {
    const { session } = await patchedSession({ NEXT_PUBLIC_SUPABASE_ANON_KEY: key })
    const token = session.access_token
    assert.equal(token, key)
    assert.ok(
      token.startsWith('sb_publishable_') || token.split('.').length === 3,
      `token must be a publishable key or a JWT, got: ${token}`,
    )
  }
})

test('without an anon key the token stays the demo literal and the owner identity is unchanged', async () => {
  const { session, user } = await patchedSession({})
  assert.ok(session)
  assert.equal(session.access_token, 'auth-disabled')
  assert.equal(session.user.id, AUTH_DISABLED_FALLBACK_USER_ID)
  assert.equal(session.user.email, 'eshwarjay05@gmail.com')
  assert.equal(user.id, AUTH_DISABLED_FALLBACK_USER_ID)
})

test('connections status degrades on profile/services failure instead of 503ing the page', () => {
  const route = readFileSync(new URL('../../src/app/api/connections/status/route.ts', import.meta.url), 'utf8')
  // The old hard failure: any profiles/connected_services error 503ed the
  // whole page, including the accounts list that had loaded fine.
  assert.doesNotMatch(route, /Could not verify your saved connections/)
  assert.doesNotMatch(route, /if \(\(profileError \|\| servicesError\)/)
  // The new shape: settle all three reads, log the flaky ones, keep the
  // 503 only for the accounts load the page cannot render without.
  assert.match(route, /Promise\.allSettled/)
  assert.match(route, /console\.error\("connections status: profiles read failed"/)
  assert.match(route, /console\.error\("connections status: connected_services read failed"/)
  assert.match(route, /Could not load your saved Google accounts/)
})
