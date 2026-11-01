import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Two tabs renewing at once rotated the same cookie family and one tab's
// renewal invalidated the other's. Renewals now serialize across tabs via
// navigator.locks when available; same-tab callers already coalesce on
// __authRefreshFlight, and desktop never reaches the lock (bridge first).
const src = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')
const fnAt = src.indexOf('async function tryRefreshAuth()')
const fn = src.slice(fnAt, src.indexOf('function keepAuthAlive()', fnAt))

test('refresh serializes across tabs when locks exist', () => {
  assert.ok(fn.includes('typeof navigator !== "undefined" && navigator.locks'), 'lock use is sandbox-tolerant')
  assert.ok(fn.includes('locks.request("kompas-auth-refresh", { mode: "exclusive" }, run)'), 'renewals run under one exclusive lock')
})

test('refresh still works without locks', () => {
  assert.ok(fn.includes('return await run();'), 'no-lock fallback runs the renewal directly')
})

test('desktop bridge path is untouched by the lock', () => {
  const bridgeAt = fn.indexOf('window.kompasDesktop')
  const lockAt = fn.indexOf('navigator.locks')
  assert.ok(bridgeAt > 0 && lockAt > bridgeAt, 'bridge branch precedes the lock code')
})
