// Per-sender notify controls: the worker-readable export shapes only what
// triage needs (sender emails + mode), and sender matching covers exact
// addresses and same-domain senders.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validNotifyRule, toPublicRules, mergePublicRules, ruleMatchesSender } from '../../src/lib/notify-rules.ts'

test('validNotifyRule accepts only well-formed rules', () => {
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 's@v.com', mode: 'always' }), true)
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 's@v.com', mode: 'never' }), true)
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 's@v.com', mode: 'sometimes' }), false)
  assert.equal(validNotifyRule({ account: 'no-at', email: 's@v.com', mode: 'always' }), false)
  assert.equal(validNotifyRule(null), false)
})

test('toPublicRules strips accounts, lowercases, dedupes, drops invalid', () => {
  const out = toPublicRules([
    { account: 'A@X.com', email: 'S@V.com', mode: 'always' },
    { account: 'a@x.com', email: 's@v.com', mode: 'never' },   // same sender: first wins
    { account: 'a@x.com', email: 't@w.com', mode: 'never' },
    { account: 'a@x.com', email: 'bad', mode: 'always' },
  ])
  assert.deepEqual(out, [
    { email: 's@v.com', mode: 'always' },
    { email: 't@w.com', mode: 'never' },
  ])
  assert.ok(out.every(r => !('account' in r)), 'no account addresses leak to the worker')
})

test('mergePublicRules combines several owners and dedupes', () => {
  const out = mergePublicRules([
    [{ account: 'a@x.com', email: 's@v.com', mode: 'always' }],
    [{ account: 'b@y.com', email: 'S@V.com', mode: 'never' }, { account: 'b@y.com', email: 'u@z.com', mode: 'never' }],
  ])
  assert.deepEqual(out, [
    { email: 's@v.com', mode: 'always' },
    { email: 'u@z.com', mode: 'never' },
  ])
})

test('ruleMatchesSender covers exact addresses and same-domain senders', () => {
  assert.equal(ruleMatchesSender('s@v.com', 's@v.com'), true)
  assert.equal(ruleMatchesSender('S@V.com', 's@v.com'), true)
  assert.equal(ruleMatchesSender('boss@v.com', 's@v.com'), true)
  assert.equal(ruleMatchesSender('boss@v.com', 's@sub.v.com'), true)
  assert.equal(ruleMatchesSender('boss@v.com', 's@notv.com'), false)
  assert.equal(ruleMatchesSender('boss@v.com', 's@v.com.evil.com'), false)
  assert.equal(ruleMatchesSender('', 's@v.com'), false)
})
