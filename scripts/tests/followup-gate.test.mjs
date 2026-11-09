import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { evaluateFollowupGate } from '../../src/lib/followup-gate.ts'
import { claimFollowupOccurrence } from '../../src/lib/followup-claims.ts'

function fakeStore() {
  const map = new Map()
  return {
    puts: 0,
    async putIfAbsent(key, data) { this.puts++; if (map.has(key)) return false; map.set(key, data); return true },
    async getText(key) { return map.get(key) ?? null },
    _map: map,
  }
}

const base = {
  userId: 'u1', account: 'A@example.com', observedAccount: 'a@example.com',
  thread: 't1', observedThread: 't1', now: 100, dueAt: 90, occurrence: 'slot-1',
  enabled: true, ignored: false, stopOnReply: true, lastSentAt: 50,
}

test('due claims exactly once; a second evaluation is a duplicate with the first claimedAt', async () => {
  const store = fakeStore()
  const first = await evaluateFollowupGate(store, base)
  assert.equal(first.verdict, 'due')
  assert.equal(first.claimed, true)
  assert.equal(first.claimedAt, 100)
  assert.equal(first.reason, null)
  assert.equal(store._map.size, 1)
  const second = await evaluateFollowupGate(store, { ...base, now: 120 })
  assert.equal(second.verdict, 'duplicate')
  assert.equal(second.claimed, false)
  assert.equal(second.claimedAt, 100)
  assert.equal(second.reason, null)
  assert.equal(store._map.size, 1)
  assert.equal(store.puts, 1)
})

test('a pre-existing claim is a duplicate and the gate writes nothing new', async () => {
  const store = fakeStore()
  assert.equal(await claimFollowupOccurrence(store, { userId: 'u1', account: 'a@example.com', thread: 't1', occurrence: 'slot-1', now: 70 }), true)
  const putsBefore = store.puts
  const result = await evaluateFollowupGate(store, base)
  assert.equal(result.verdict, 'duplicate')
  assert.equal(result.claimed, false)
  assert.equal(result.claimedAt, 70)
  assert.equal(store.puts, putsBefore)
  assert.equal(store._map.size, 1)
})

test('a lost race between the claim read and the claim write is a duplicate, never a second execution', async () => {
  const store = fakeStore()
  // A concurrent winner slips in after this gate's read: reads see nothing,
  // but the write loses.
  store.getText = async () => null
  store.putIfAbsent = async () => { store.puts++; return false }
  const result = await evaluateFollowupGate(store, base)
  assert.equal(result.verdict, 'duplicate')
  assert.equal(result.claimed, false)
  assert.equal(result.claimedAt, null)
  assert.equal(store.puts, 1)
})

test('stopped, waiting, and blocked verdicts never touch the claim store', async () => {
  const store = fakeStore()
  const stopped = await evaluateFollowupGate(store, { ...base, lastInboundAt: 80 })
  assert.equal(stopped.verdict, 'stopped')
  const waiting = await evaluateFollowupGate(store, { ...base, dueAt: 150 })
  assert.equal(waiting.verdict, 'waiting')
  for (const patch of [
    { observedAccount: 'b@example.com' },
    { observedThread: 'other' },
    { enabled: false },
    { ignored: true },
    { now: NaN },
    { dueAt: Infinity },
    { lastSentAt: 0 },
    { lastInboundAt: 101 },
  ]) {
    const blocked = await evaluateFollowupGate(store, { ...base, ...patch })
    assert.equal(blocked.verdict, 'blocked')
    assert.equal(blocked.claimed, false)
  }
  assert.equal(store._map.size, 0)
  assert.equal(store.puts, 0)
})

test('a plan without an explicit schedule is blocked and never claims', async () => {
  const store = fakeStore()
  for (const patch of [
    { dueAt: undefined },
    { dueAt: null },
    { dueAt: NaN },
    { occurrence: undefined },
    { occurrence: null },
    { occurrence: '' },
  ]) {
    const result = await evaluateFollowupGate(store, { ...base, ...patch })
    assert.equal(result.verdict, 'blocked')
    assert.equal(result.reason, 'no-explicit-schedule')
    assert.equal(result.claimed, false)
  }
  assert.equal(store._map.size, 0)
  assert.equal(store.puts, 0)
})

test('claims are scoped per account: the same thread and occurrence claim independently', async () => {
  const store = fakeStore()
  const first = await evaluateFollowupGate(store, base)
  assert.equal(first.claimed, true)
  const other = await evaluateFollowupGate(store, { ...base, account: 'b@example.com', observedAccount: 'b@example.com' })
  assert.equal(other.verdict, 'due')
  assert.equal(other.claimed, true)
  assert.equal(store._map.size, 2)
})

test('a claim-store failure blocks the gate instead of risking a double execution', async () => {
  const readFail = fakeStore()
  readFail.getText = async () => { throw new Error('store down') }
  const blockedRead = await evaluateFollowupGate(readFail, base)
  assert.equal(blockedRead.verdict, 'blocked')
  assert.equal(blockedRead.reason, 'claim-store-unavailable')
  assert.equal(blockedRead.claimed, false)
  assert.equal(readFail.puts, 0)

  const writeFail = fakeStore()
  writeFail.putIfAbsent = async () => { writeFail.puts++; throw new Error('store down') }
  const blockedWrite = await evaluateFollowupGate(writeFail, base)
  assert.equal(blockedWrite.verdict, 'blocked')
  assert.equal(blockedWrite.reason, 'claim-store-unavailable')
  assert.equal(blockedWrite.claimed, false)
  assert.equal(writeFail._map.size, 0)
})

test('gate dependency surface is only the eligibility helper and the claims module', () => {
  const gate = readFileSync('src/lib/followup-gate.ts', 'utf8')
  const imports = gate.split('\n').filter(l => l.startsWith('import '))
  assert.equal(imports.length, 2)
  assert.match(imports[0], /from '\.\/followup-claims\.ts'/)
  assert.match(imports[1], /from '\.\/followup-eligibility\.ts'/)
  assert.match(gate, /never sends, schedules, or executes anything/)
  assert.doesNotMatch(gate, /fetch\(|NextResponse|requireAuth/)
})

test('radar route feeds the live claim into the observation and still never writes a claim', () => {
  const route = readFileSync('src/app/api/gmail/followup-radar/route.ts', 'utf8')
  assert.match(route, /radarOccurrence\(t\.threadId, sentAt\)/)
  assert.match(route, /completedOccurrences: claim !== 'unknown' && claim\.claimed \? \[occurrence\] : \[\]/)
  assert.doesNotMatch(route, /claimFollowupOccurrence\(/)
})
