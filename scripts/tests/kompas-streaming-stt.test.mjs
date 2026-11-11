import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import {
  STREAMING_STT_FLAG,
  STREAMING_STT_KEY,
  BACKOFF_MS,
  KEEPALIVE_MS,
  MAX_RECONNECTS,
  streamingSttAvailability,
  nextBackoff,
  shouldFallback,
  eventFromProviderMessage,
  createStreamingSession,
  onSocketOpen,
  onSocketNeededKeepalive,
  onSocketLost,
} from '../../src/lib/kompasStreamingStt.ts'

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8')

test('streaming stays off without the flag or the Deepgram key (values never inspected)', () => {
  const off = streamingSttAvailability({})
  assert.equal(off.enabled, false)
  assert.equal(off.reason, 'flag-off')
  assert.equal(off.fallback, 'whisper')
  assert.equal(off.flag, STREAMING_STT_FLAG)
  assert.equal(off.keyName, STREAMING_STT_KEY)

  const flagged = streamingSttAvailability({ [STREAMING_STT_FLAG]: 'on' })
  assert.equal(flagged.enabled, false)
  assert.equal(flagged.reason, 'no-key')

  const ready = streamingSttAvailability({ [STREAMING_STT_FLAG]: 'on', [STREAMING_STT_KEY]: 'x' })
  assert.equal(ready.enabled, true)
  assert.equal(ready.reason, 'ready')
  assert.equal(ready.provider, 'deepgram')
})

test('reconnect backs off and then falls back to Whisper slicing', () => {
  assert.deepEqual(Array.from(BACKOFF_MS), [500, 1000, 2000, 4000, 8000])
  assert.equal(nextBackoff(0), 500)
  assert.equal(nextBackoff(4), 8000)
  assert.equal(nextBackoff(99), 8000)
  assert.equal(shouldFallback(MAX_RECONNECTS - 1), false)
  assert.equal(shouldFallback(MAX_RECONNECTS), true)
  assert.equal(shouldFallback(0, true), true)

  const s = createStreamingSession('Them')
  assert.equal(s.status, 'idle')
  assert.equal(onSocketOpen(s).type, 'open')
  assert.equal(s.status, 'live')
  const ev = onSocketLost(s, 'socket close')
  assert.equal(ev.type, 'reconnecting')
  assert.equal(ev.delayMs, 500)
  for (let i = 0; i < MAX_RECONNECTS; i++) onSocketLost(s, 'socket close')
  const fb = onSocketLost(s, 'socket close')
  assert.equal(fb.type, 'fallback')
  assert.equal(s.status, 'fallback')
})

test('interim, final, and keepalive events parse from a Deepgram-like payload', () => {
  const interim = eventFromProviderMessage({ is_final: false, channel: { alternatives: [{ transcript: 'tell me about' }] } }, 'Them')
  assert.deepEqual(interim, { type: 'interim', text: 'tell me about', who: 'Them' })
  const fin = eventFromProviderMessage({ is_final: true, channel: { alternatives: [{ transcript: 'Tell me about a conflict.' }] } }, 'Them')
  assert.equal(fin.type, 'final')
  assert.match(fin.text, /conflict/)
  const s = createStreamingSession('Them')
  onSocketOpen(s, 1000)
  assert.equal(onSocketNeededKeepalive(s, 1000 + KEEPALIVE_MS - 1), null)
  assert.equal(onSocketNeededKeepalive(s, 1000 + KEEPALIVE_MS).type, 'keepalive')
})

test('app.js wires streaming start and Whisper fallback, off unless the server says ready', () => {
  assert.match(app, /function startStreamingStt\(/)
  assert.match(app, /function fallbackToWhisperSlices\(/)
  assert.match(app, /streamingSttReady/)
})
