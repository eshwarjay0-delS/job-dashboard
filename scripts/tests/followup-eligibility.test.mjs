import test from 'node:test'
import assert from 'node:assert/strict'
import { followupEligibility } from '../../src/lib/followup-eligibility.ts'
const base = { account: 'A@example.com', observedAccount: 'a@example.com', thread: 'same-id', observedThread: 'same-id', now: 100, dueAt: 90, lastSentAt: 50, enabled: true, ignored: false, stopOnReply: true, occurrence: 'scheduled-slot-1', completedOccurrences: [] }
test('due review stays scoped to the exact receiving account and thread', () => {
 assert.equal(followupEligibility(base), 'due')
 assert.equal(followupEligibility({...base, observedAccount:'b@example.com'}), 'blocked')
 assert.equal(followupEligibility({...base, observedThread:'other'}), 'blocked')
})
test('reply stops due work, including equal timestamp; older inbound does not', () => {
 for(const lastInboundAt of [50, 80]) assert.equal(followupEligibility({...base,lastInboundAt}), 'stopped')
 assert.equal(followupEligibility({...base,lastInboundAt:49}), 'due')
})
test('disabled, ignored, invalid or future evidence fails closed', () => {
 for(const patch of [{enabled:false},{ignored:true},{now:NaN},{dueAt:Infinity},{lastInboundAt:101},{lastSentAt:101},{occurrence:''}]) assert.equal(followupEligibility({...base,...patch}), 'blocked')
})
test('completed occurrence is never due again and future slot waits', () => {
 assert.equal(followupEligibility({...base,completedOccurrences:['scheduled-slot-1']}), 'duplicate')
 assert.equal(followupEligibility({...base,dueAt:101}), 'waiting')
})
