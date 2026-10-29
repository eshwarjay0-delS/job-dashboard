import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { radarReviewObservation } from '../../src/lib/followup-eligibility.ts'

const DAY = 86_400_000
const now = 1_800_000_000_000
const sent = now - 5 * DAY
const inbound = now - 6 * DAY
const base = { account: 'a@example.com', threadId: 't1', sentAt: sent, lastInboundAt: inbound, minWaitDays: 3, now }

test('radar-shaped item is due for review with an explicit dueAt and occurrence', () => {
  const o = radarReviewObservation(base)
  assert.equal(o.eligibility, 'due')
  assert.equal(o.dueAt, sent + 3 * DAY)
  assert.equal(o.lastSentAt, sent)
  assert.equal(o.lastInboundAt, inbound)
  assert.equal(o.occurrence, `radar:t1:${sent}`)
})

test('below the review threshold the observation waits, it does not claim due', () => {
  const o = radarReviewObservation({ ...base, sentAt: now - 1 * DAY, lastInboundAt: now - 2 * DAY })
  assert.equal(o.eligibility, 'waiting')
})

test('invalid outbound evidence blocks the observation instead of inventing a wait', () => {
  assert.equal(radarReviewObservation({ ...base, sentAt: 0 }).eligibility, 'blocked')
  assert.equal(radarReviewObservation({ ...base, sentAt: now + DAY }).eligibility, 'blocked')
})

test('a verified reply at or after the outbound stops the observation', () => {
  assert.equal(radarReviewObservation({ ...base, lastInboundAt: sent }).eligibility, 'stopped')
  assert.equal(radarReviewObservation({ ...base, lastInboundAt: sent + DAY }).eligibility, 'stopped')
})

test('no inbound evidence still verifies due once the threshold passes', () => {
  const { lastInboundAt, ...rest } = base
  const o = radarReviewObservation(rest)
  assert.equal(o.eligibility, 'due')
  assert.equal(o.lastInboundAt, null)
})

test('route wires the observation into every radar item (review only, no execution)', () => {
  const route = readFileSync('src/app/api/gmail/followup-radar/route.ts', 'utf8')
  assert.match(route, /radarReviewObservation/)
  assert.match(route, /eligibility: observation\.eligibility/)
  assert.match(route, /dueAt: observation\.dueAt/)
  assert.match(route, /lastSentAt: observation\.lastSentAt/)
  assert.match(route, /lastInboundAt: observation\.lastInboundAt/)
  assert.doesNotMatch(route, /sendFollowUp|scheduleFollowUp|gmail\.send/)
})

test('review surface shows the verdict next to each waiting item', () => {
  const page = readFileSync('src/app/dashboard/workflows/page.tsx', 'utf8')
  assert.match(page, /r\.eligibility/)
  assert.match(page, /Due for review/)
  const hook = readFileSync('src/lib/use-gmail-data.ts', 'utf8')
  assert.match(hook, /eligibility: string/)
})
