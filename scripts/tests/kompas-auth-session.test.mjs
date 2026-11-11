import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  authKeysToClear,
  authErrorMessage,
  shouldRefreshAndRetry,
  shouldRefreshBeforeExpiry,
} from "../../src/lib/kompasAuthSession.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")

test("logout clears auth and cloud-owner keys, not interview session records", () => {
  const keys = authKeysToClear([
    "perfact.user",
    "perfact.sessions",
    "perfact.cloud.owner",
    "perfact.cloud.cache.abc",
    "sb-abc123-auth-token",
    "sb-abc123-auth-token.0",
    "perfact.desktopTicket",
    "unrelated",
  ])
  assert.ok(keys.includes("perfact.user"))
  assert.ok(keys.includes("perfact.cloud.owner"))
  assert.ok(keys.includes("sb-abc123-auth-token.0"))
  assert.ok(keys.includes("perfact.desktopTicket"))
  assert.ok(!keys.includes("perfact.sessions"))
  assert.ok(!keys.includes("unrelated"))
})

test("auth errors are plain language; a 401 retries once after refresh", () => {
  assert.match(authErrorMessage("login"), /could not sign you in/i)
  assert.match(authErrorMessage("logout"), /signed out/i)
  assert.match(authErrorMessage("expired"), /sign in again/i)
  assert.equal(shouldRefreshAndRetry(401, false), true)
  assert.equal(shouldRefreshAndRetry(401, true), false)
  assert.equal(shouldRefreshAndRetry(500, false), false)
  const now = 1_800_000_000_000
  assert.equal(shouldRefreshBeforeExpiry(now / 1000 + 3600, now), false)
  assert.equal(shouldRefreshBeforeExpiry(now / 1000 + 30, now), true)
})

test("app.js signs out cleanly and retries transcribe once after a 401", () => {
  assert.match(app, /async function signOutKompas\(/)
  assert.match(app, /function clearAuthLocalState\(/)
  assert.match(app, /fetch\("\/api\/auth\/signout"/)
  assert.match(app, /status === 401 && !opt\.__authRetried/)
  assert.match(app, /tryRefreshAuth\("rejected"\)/)
  assert.doesNotMatch(app, /AUTH_REFRESH_LIVE_MS|AUTH_REFRESH_IDLE_MS/)
  const alive = app.slice(app.indexOf("function keepAuthAlive()"), app.indexOf("let __authWaitTimer"))
  assert.match(alive, /if \(document\.hidden\) return/)
  assert.match(alive, /expiresAt - Date\.now\(\) > 60 \* 1000\) return/)
})
