import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  createMemoryAuthCodeStore,
  createDesktopAuthCode,
  exchangeDesktopAuthCode,
  pollDesktopAuthCode,
  desktopAuthCodeStatus,
  CODE_TTL_MS,
} from "../../src/lib/desktopAuthCode.ts"
import { AUTH_UNAVAILABLE, userFromAuthClient, userFromClaims, refreshOnceOn401, shouldRefreshBeforeExpiry } from "../../src/lib/kompasAuthSession.ts"

const NONCE = "N".repeat(43)
const NOW = 1_700_000_000_000

function mintSession(record) {
  return {
    session: {
      accessToken: "desk.access.jwt",
      refreshToken: "desktop-refresh",
      expiresAt: 1_800_000_000,
      userId: record.userId,
    },
  }
}

test("a code is single-use and a second exchange does not return a session", async () => {
  const store = createMemoryAuthCodeStore()
  const created = await createDesktopAuthCode(store, { nonce: NONCE, userId: "user-1", email: "a@example.com", now: NOW })
  assert.equal(created.status, 200)
  const first = await exchangeDesktopAuthCode(store, { code: created.body.code, nonce: NONCE, now: NOW + 1000 }, mintSession)
  assert.equal(first.status, 200)
  assert.equal(first.body.refresh_token, "desktop-refresh")
  const second = await exchangeDesktopAuthCode(store, { code: created.body.code, nonce: NONCE, now: NOW + 2000 }, mintSession)
  assert.equal(second.status, 410)
  assert.equal(second.body.ok, false)
  const status = await desktopAuthCodeStatus(store, created.body.code, NOW + 2000)
  assert.equal(status.body.status, "claimed")
})

test("an expired code is not a session", async () => {
  const store = createMemoryAuthCodeStore()
  const created = await createDesktopAuthCode(store, { nonce: NONCE, userId: "user-1", email: "a@example.com", now: NOW })
  const late = await exchangeDesktopAuthCode(store, { code: created.body.code, nonce: NONCE, now: NOW + CODE_TTL_MS + 1 }, mintSession)
  assert.equal(late.status, 410)
  assert.match(late.body.message, /expired/i)
  assert.equal(late.body.access_token, undefined)
})

test("a nonce mismatch does not return a session", async () => {
  const store = createMemoryAuthCodeStore()
  const created = await createDesktopAuthCode(store, { nonce: NONCE, userId: "user-1", email: "a@example.com", now: NOW })
  const wrong = await exchangeDesktopAuthCode(store, { code: created.body.code, nonce: "Z".repeat(43), now: NOW + 1000 }, mintSession)
  assert.equal(wrong.status, 401)
  assert.equal(wrong.body.error, "nonce_mismatch")
  assert.equal(wrong.body.refresh_token, undefined)
  const again = await exchangeDesktopAuthCode(store, { code: created.body.code, nonce: NONCE, now: NOW + 1000 }, mintSession)
  assert.notEqual(again.status, 200)
})

test("an unavailable auth backend is an error, not a claimed sign-in", async () => {
  const store = createMemoryAuthCodeStore()
  store.put = async () => "unavailable"
  const created = await createDesktopAuthCode(store, { nonce: NONCE, userId: "user-1", email: "a@example.com", now: NOW })
  assert.equal(created.status, 503)
  assert.equal(created.body.error, "sign_in_unavailable")
  assert.match(created.body.message, /could not reach the sign-in service/)
  assert.doesNotMatch(created.body.message, /authenticated|signed in/i)
  const polled = await pollDesktopAuthCode({
    async findByNonce() { return "unavailable" },
  }, NONCE, NOW)
  assert.equal(polled.status, 503)
  assert.match(polled.body.message, /could not reach/)
})

test("the poll stays pending until the website has minted a code", async () => {
  const store = createMemoryAuthCodeStore()
  const waiting = await pollDesktopAuthCode(store, NONCE, NOW)
  assert.equal(waiting.body.status, "pending")
  assert.equal(waiting.body.code, undefined)
  const created = await createDesktopAuthCode(store, { nonce: NONCE, userId: "user-1", email: "a@example.com", now: NOW })
  const ready = await pollDesktopAuthCode(store, NONCE, NOW)
  assert.equal(ready.body.status, "ready")
  assert.equal(ready.body.code, created.body.code)
})

test("a Supabase outage keeps a locally valid token and does not invent a user", async () => {
  const exp = Math.floor(Date.now() / 1000) + 600
  const kept = await userFromAuthClient({
    auth: {
      getUser: async () => { throw Object.assign(new Error("fetch failed"), { name: "AuthRetryableFetchError" }) },
      getClaims: async () => ({ data: { claims: { sub: "user-1", exp, email: "a@example.com", email_verified: true } }, error: null }),
    },
  })
  assert.equal(kept.id, "user-1")
  assert.equal(kept.email, "a@example.com")
  assert.equal(kept.unreachable, false)
  const down = await userFromAuthClient({
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "fetch failed", status: 503 } }),
      getClaims: async () => { throw new Error("fetch failed") },
    },
  })
  assert.equal(down.unreachable, true)
  assert.equal(down.id, "")
  const signedOut = await userFromAuthClient({
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  })
  assert.equal(signedOut, null)
  assert.equal(userFromClaims({ sub: "user-1", exp: 10, email_verified: true }, 11), null)
})

test("refresh runs once on a 401 and only shortly before expiry", async () => {
  let runs = 0
  let refreshes = 0
  const result = await refreshOnceOn401(
    async () => ({ status: runs++ === 0 ? 401 : 200 }),
    row => row.status === 401,
    async () => { refreshes++; return true },
  )
  assert.equal(result.status, 200)
  assert.equal(refreshes, 1)
  assert.equal(runs, 2)
  const now = 1_800_000_000_000
  assert.equal(shouldRefreshBeforeExpiry(now / 1000 + 3600, now), false)
  assert.equal(shouldRefreshBeforeExpiry(now / 1000 + 30, now), true)
})

test("the desktop shell restores on launch, locks a single instance, and polls only during sign-in", () => {
  const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")
  const client = readFileSync(new URL("../../legacy/perfact/desktop/marketfit-auth.cjs", import.meta.url), "utf8")
  assert.match(main, /desktopAuth\.load\(\)/)
  assert.match(main, /app\.on\("second-instance"/)
  assert.match(main, /app\.on\("open-url"/)
  assert.match(main, /takeProtocolArgv/)
  assert.match(main, /SIGN_IN_POLL_MS = 2500/)
  assert.match(main, /SIGN_IN_POLL_MAX_MS = 120000/)
  assert.match(main, /startSignInPoll\(state\)/)
  assert.match(main, /armDesktopRefresh/)
  assert.doesNotMatch(main, /setInterval\(renewQuiet/)
  assert.doesNotMatch(main, /desktopAuth\.clear\(/)
  assert.match(client, /aes-256-gcm/)
  assert.match(client, /exchangeCode/)
  assert.match(client, /\/api\/auth\/desktop-code\/exchange/)
  assert.doesNotMatch(client, /\/api\/auth\/refresh["/`]/)
})
