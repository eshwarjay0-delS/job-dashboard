import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const helperSource = readFileSync(new URL('../../src/lib/gmail-retry-after.ts', import.meta.url), 'utf8')
const match = helperSource.match(/export function gmailRetryDelaySeconds[\\s\\S]*?\\n}/)
assert.ok(match, 'the production Retry-After helper is present')
const executable = match[0].replace(/^export /, '').replace(/\\(value: string \\| null, fallbackSeconds: number, nowMs = Date\\.now\\(\\)\\): number/, '(value, fallbackSeconds, nowMs = Date.now())')
const gmailRetryDelaySeconds = new Function('return (' + executable + ')')()
const autoWaitMatch = helperSource.match(/export function gmailRetryAutoWaitMs[\\s\\S]*?\\n}/)
assert.ok(autoWaitMatch, 'the bounded automatic wait helper is present')
const maxWaitMatch = helperSource.match(/export const MAX_AUTOMATIC_GMAIL_RETRY_MS = (\\d+)/)
assert.ok(maxWaitMatch, 'the automatic wait ceiling is explicit')
const autoWaitSource = autoWaitMatch[0].replace(/^export /, '').replace(/\\(seconds: number\\): number \\| null/, '(seconds)')
const gmailRetryAutoWaitMs = new Function('MAX_AUTOMATIC_GMAIL_RETRY_MS', 'return (' + autoWaitSource + ')')(Number(maxWaitMatch[1]))
const labelMatch = helperSource.match(/export function gmailRetryWaitLabel[\\s\\S]*?\\n}/)
assert.ok(labelMatch, 'the long-wait label helper is present')
const labelSource = labelMatch[0].replace(/^export /, '').replace(/\\(seconds: number\\): string/, '(seconds)')
const gmailRetryWaitLabel = new Function('return (' + labelSource + ')')()
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

test('large valid delays are held rather than shortened or scheduled as huge timers', () => {
  const huge = gmailRetryDelaySeconds(String(Number.MAX_SAFE_INTEGER), 15, NOW)
  assert.equal(huge, Number.MAX_SAFE_INTEGER)
  assert.equal(gmailRetryAutoWaitMs(huge), null)
  assert.equal(gmailRetryAutoWaitMs(86400), 86400000)
  assert.equal(gmailRetryAutoWaitMs(86401), null)
  assert.equal(gmailRetryAutoWaitMs(0), null)
})

test('long wait labels stay readable without a per-second countdown', () => {
  assert.equal(gmailRetryWaitLabel(1), '1 second')
  assert.equal(gmailRetryWaitLabel(61), '2 minutes')
  assert.equal(gmailRetryWaitLabel(3601), '2 hours')
  assert.equal(gmailRetryWaitLabel(86401), '2 days')
  assert.equal(gmailRetryWaitLabel(Number.MAX_SAFE_INTEGER), 'an unusually long period')
})
