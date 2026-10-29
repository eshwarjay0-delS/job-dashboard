import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { followupClaimKey, claimFollowupOccurrence, getFollowupClaim } from '../../src/lib/followup-claims.ts'

function fakeStore() {
  const map = new Map()
  return {
    async putIfAbsent(key, data) { if (map.has(key)) return false; map.set(key, data); return true },
    async getText(key) { return map.get(key) ?? null },
    _map: map,
  }
}

const input = { userId: 'u1', account: 'A@example.com', thread: 't1', occurrence: 'radar:t1:123', now: 5000 }

test('claim key is stable per occurrence and scoped per user, account, thread', () => {
  assert.equal(followupClaimKey('u1', 'a@example.com', 't1', 'o1'), followupClaimKey('u1', 'A@example.com', 't1', 'o1'))
  assert.notEqual(followupClaimKey('u1', 'a@example.com', 't1', 'o1'), followupClaimKey('u2', 'a@example.com', 't1', 'o1'))
  assert.notEqual(followupClaimKey('u1', 'a@example.com', 't1', 'o1'), followupClaimKey('u1', 'b@example.com', 't1', 'o1'))
  assert.notEqual(followupClaimKey('u1', 'a@example.com', 't1', 'o1'), followupClaimKey('u1', 'a@example.com', 't2', 'o1'))
  assert.notEqual(followupClaimKey('u1', 'a@example.com', 't1', 'o1'), followupClaimKey('u1', 'a@example.com', 't1', 'o2'))
  assert.match(followupClaimKey('u/1:x', 'a@example.com', 't1', 'o1'), /mail\/followup-claims\/u_1_x\//)
})

test('first claim wins; a second claim for the same occurrence fails and changes nothing', async () => {
  const store = fakeStore()
  assert.equal(await claimFollowupOccurrence(store, input), true)
  const first = await getFollowupClaim(store, input)
  assert.equal(first.account, 'a@example.com')
  assert.equal(first.thread, 't1')
  assert.equal(first.occurrence, 'radar:t1:123')
  assert.equal(first.claimedAt, 5000)
  assert.equal(first.status, 'claimed')
  assert.equal(await claimFollowupOccurrence(store, { ...input, now: 9000 }), false)
  assert.equal((await getFollowupClaim(store, input)).claimedAt, 5000)
})

test('a different occurrence on the same thread claims independently', async () => {
  const store = fakeStore()
  assert.equal(await claimFollowupOccurrence(store, input), true)
  assert.equal(await claimFollowupOccurrence(store, { ...input, occurrence: 'radar:t1:456' }), true)
})

test('claim reads reject absent, corrupt, and mismatched records', async () => {
  const store = fakeStore()
  assert.equal(await getFollowupClaim(store, input), null)
  const key = followupClaimKey('u1', 'a@example.com', 't1', 'radar:t1:123')
  store._map.set(key, 'not-json')
  assert.equal(await getFollowupClaim(store, input), null)
  store._map.set(key, JSON.stringify({ status: 'claimed', thread: 'other', occurrence: 'radar:t1:123' }))
  assert.equal(await getFollowupClaim(store, input), null)
})

test('plans accept explicit schedule fields only, never derived from free text', () => {
  const route = readFileSync('src/app/api/gmail/automation-plans/route.ts', 'utf8')
  assert.match(route, /b\.dueAt!==undefined&&\(!Number\.isFinite\(b\.dueAt\)\|\|b\.dueAt<=0\)/)
  assert.match(route, /b\.occurrence!==undefined&&\(typeof b\.occurrence!=='string'/)
  assert.match(route, /\.\.\.\(b\.dueAt===undefined\?\{\}:\{dueAt:Math\.floor\(b\.dueAt\)\}\)/)
  assert.match(route, /\.\.\.\(b\.occurrence===undefined\?\{\}:\{occurrence:b\.occurrence\}\)/)
  // No free-text schedule parsing: the only dueAt/occurrence sources are the
  // explicit body fields pinned above, never words in the instructions.
  assert.doesNotMatch(route, /twice|weekly|parseSchedule|fromInstructions|parseInstructions/)
})

test('radar route reads claim state for review and never writes a claim', () => {
  const route = readFileSync('src/app/api/gmail/followup-radar/route.ts', 'utf8')
  assert.match(route, /getFollowupClaim\(blob/)
  assert.match(route, /claim,/)
  assert.match(route, /'unknown'/)
  assert.doesNotMatch(route, /claimFollowupOccurrence\(/)
})

test('review surface shows Claimed only when a claim actually exists', () => {
  const page = readFileSync('src/app/dashboard/workflows/page.tsx', 'utf8')
  assert.match(page, /r\.claim && r\.claim !== 'unknown' && r\.claim\.claimed \? ' · Claimed' : ''/)
  const hook = readFileSync('src/lib/use-gmail-data.ts', 'utf8')
  assert.match(hook, /claim: \{ claimed: boolean; claimedAt: number \| null \} \| 'unknown'/)
})
