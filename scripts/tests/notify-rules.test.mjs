import { test } from 'node:test'
import assert from 'node:assert/strict'
import { validNotifyRule, toWorkerNotifyOwner, ruleMatchesSender } from '../../src/lib/notify-rules.ts'

test('validNotifyRule accepts only complete account-scoped sender rules', () => {
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 's@v.com', mode: 'always' }), true)
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 's@v.com', mode: 'never' }), true)
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 's@v.com', mode: 'sometimes' }), false)
  assert.equal(validNotifyRule({ account: 'no-at', email: 's@v.com', mode: 'always' }), false)
  assert.equal(validNotifyRule({ account: 'a@x.com', email: 'not-an-email', mode: 'always' }), false)
  assert.equal(validNotifyRule(null), false)
})

test('worker rules preserve owner and receiving-inbox identity without cross-account merging', () => {
  const ownerA = toWorkerNotifyOwner('user-a', [
    { account: 'One@Example.com', email: 'Recruiter@Agency.com', mode: 'always' },
    { account: 'Two@Example.com', email: 'Recruiter@Agency.com', mode: 'never' },
    { account: 'one@example.com', email: 'recruiter@agency.com', mode: 'never' },
    { account: 'one@example.com', email: 'bad', mode: 'always' },
  ])
  const ownerB = toWorkerNotifyOwner('user-b', [
    { account: 'one@example.com', email: 'recruiter@agency.com', mode: 'always' },
  ])
  assert.deepEqual(ownerA, {
    ownerId: 'user-a',
    rules: [
      { account: 'one@example.com', email: 'recruiter@agency.com', mode: 'never' },
      { account: 'two@example.com', email: 'recruiter@agency.com', mode: 'never' },
    ],
  })
  assert.deepEqual(ownerB, {
    ownerId: 'user-b',
    rules: [{ account: 'one@example.com', email: 'recruiter@agency.com', mode: 'always' }],
  })
  assert.notDeepEqual(ownerA, ownerB)
  assert.equal(toWorkerNotifyOwner('', [{ account: 'a@x.com', email: 's@v.com', mode: 'always' }]), null)
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
