import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  gmailRetryDelaySeconds,
  gmailRetryAutoWaitMs,
  gmailRetryWaitLabel,
  MAX_AUTOMATIC_GMAIL_RETRY_MS,
} from '../../src/lib/gmail-retry-after.ts'

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0)

test('Retry-After delta-seconds is honored', () => {
  assert.equal(gmailRetryDelaySeconds('30', 15, NOW), 30)
  assert.equal(gmailRetryDelaySeconds('120', 40, NOW), 120)
})

test('Retry-After HTTP-date is honored and never shortened', () => {
  const date = new Date(NOW + 45_000).toUTCString()
  assert.equal(gmailRetryDelaySeconds(date, 15, NOW), 45)
  assert.equal(gmailRetryDelaySeconds(new Date(NOW + 2_000).toUTCString(), 40, NOW), 40)
  assert.equal(gmailRetryDelaySeconds(new Date(NOW - 30_000).toUTCString(), 40, NOW), 40)
})

test('missing and invalid headers keep the existing bounded fallback schedule', () => {
  assert.equal(gmailRetryDelaySeconds(null, 15, NOW), 15)
  assert.equal(gmailRetryDelaySeconds('', 40, NOW), 40)
  assert.equal(gmailRetryDelaySeconds('not a Retry-After value', 65, NOW), 65)
  assert.equal(gmailRetryDelaySeconds('999999999999999999999999', 65, NOW), Number.MAX_SAFE_INTEGER)
  assert.equal(gmailRetryDelaySeconds('+30', 65, NOW), 65)
  assert.equal(gmailRetryDelaySeconds('30.5', 65, NOW), 65)
  assert.equal(gmailRetryDelaySeconds('-30', 65, NOW), 65)
})

test('a Retry-After HTTP-date beyond one day is held instead of retried early', () => {
  const date = new Date(NOW + 25 * 60 * 60 * 1000).toUTCString()
  const seconds = gmailRetryDelaySeconds(date, 15, NOW)
  assert.ok(seconds >= 25 * 60 * 60)
  assert.equal(gmailRetryAutoWaitMs(seconds), null)
  assert.equal(gmailRetryWaitLabel(seconds), 'more than 1 day')
})

test('a server delay shorter than the fallback never makes the client retry earlier', () => {
  assert.equal(gmailRetryDelaySeconds('2', 15, NOW), 15)
  assert.equal(gmailRetryDelaySeconds('0', 40, NOW), 40)
})

test('interleaved account responses keep their own retry delays', () => {
  const responses = [
    { account: 'inbox-a', retryAfter: '30' },
    { account: 'inbox-b', retryAfter: '120' },
    { account: 'inbox-a', retryAfter: '30' },
  ]
  const waits = responses.map(response => ({ account: response.account, seconds: gmailRetryDelaySeconds(response.retryAfter, 15, NOW) }))
  assert.deepEqual(waits, [
    { account: 'inbox-a', seconds: 30 },
    { account: 'inbox-b', seconds: 120 },
    { account: 'inbox-a', seconds: 30 },
  ])
})

test('automatic waits are capped at one day without shortening the server delay', () => {
  assert.equal(MAX_AUTOMATIC_GMAIL_RETRY_MS, 86_400_000)
  assert.equal(gmailRetryDelaySeconds('86400', 15, NOW), 86400)
  assert.equal(gmailRetryAutoWaitMs(86400), 86_400_000)
  assert.equal(gmailRetryDelaySeconds('86401', 15, NOW), 86401)
  assert.equal(gmailRetryAutoWaitMs(86401), null)
  assert.equal(gmailRetryAutoWaitMs(Number.MAX_SAFE_INTEGER), null)
  assert.equal(gmailRetryAutoWaitMs(0), null)
})

test('overflow and extremely long waits become an explicit hold, not a fallback retry', () => {
  const delay = gmailRetryDelaySeconds('999999999999999999999999', 65, NOW)
  assert.equal(delay, Number.MAX_SAFE_INTEGER)
  assert.equal(gmailRetryAutoWaitMs(delay), null)
  assert.equal(gmailRetryWaitLabel(delay), 'an unusually long period')
})

test('long wait labels stay readable without a per-second countdown', () => {
  assert.equal(gmailRetryWaitLabel(1), '1 second')
  assert.equal(gmailRetryWaitLabel(61), 'about 2 minutes')
  assert.equal(gmailRetryWaitLabel(3601), 'about 2 hours')
  assert.equal(gmailRetryWaitLabel(86401), 'more than 1 day')
})
