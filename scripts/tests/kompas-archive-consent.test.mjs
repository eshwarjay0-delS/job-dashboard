import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldArchiveSession } from '../../src/lib/kompasArchiveConsent.mjs'

test('archive requires both a session and affirmative opt-in', () => {
  assert.equal(shouldArchiveSession('session-123', 'granted'), true)
  assert.equal(shouldArchiveSession('', 'granted'), false)
})

test('missing and non-affirmative consent fail closed', () => {
  for (const value of [null, '', 'true', '1', 'yes', 'GRANTED', 'revoked', 'denied']) {
    assert.equal(shouldArchiveSession('session-123', value), false)
  }
})

test('a missing session never authorizes storage', () => {
  for (const value of [null, 'granted', 'true']) {
    assert.equal(shouldArchiveSession('', value), false)
  }
})
