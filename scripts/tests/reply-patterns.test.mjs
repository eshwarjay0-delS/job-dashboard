// Reply-pattern delegation: gate, availability tiers, buckets, delegate
// eligibility. Pure logic in src/lib/reply-patterns.ts; nothing here sends.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  classifySender, isMarketingSender, isRolePitch, isAvailabilityAsk, hasBundledAsk,
  gateReply, availabilityReply, gateViolations, availabilityViolations,
  chainsMatch, cardKey, bucketFor, cardHeader, verbLabel,
  validDelegateOptIn, delegateEligible,
} from '../../src/lib/reply-patterns.ts'

const PITCH = 'Hi Eshwar, here is a role — Senior Security Engineer at a fintech client in Austin. Let me know if you are interested and share your resume.'

test('marketing firms are never reply targets', () => {
  assert.equal(isMarketingSender('nidhi@tekblu.us'), true)
  assert.equal(isMarketingSender('flora@cloudquestit.com'), true)
  assert.equal(isMarketingSender('x@teksolveit.com'), true)
  assert.equal(isMarketingSender('megha@tekblu.com'), true)
  assert.equal(classifySender({ senderEmail: 'nidhi@tekblu.us', vendorEmails: ['nidhi@tekblu.us'] }), 'marketing')
})

test('sender classes: vendor list and prior threads make a sender known, otherwise new external', () => {
  assert.equal(classifySender({ senderEmail: 'new@somevendor.com' }), 'new-external')
  assert.equal(classifySender({ senderEmail: 'a@vyzeinc.com', vendorDomains: ['vyzeinc.com'] }), 'known-vendor')
  assert.equal(classifySender({ senderEmail: 'a@vyzeinc.com', priorSenders: ['Someone <a@vyzeinc.com>'] }), 'known-vendor')
  assert.equal(classifySender({ senderEmail: 'new@vyzeinc.com', priorSenders: ['old@vyzeinc.com'] }), 'known-vendor')
  assert.equal(classifySender({ senderEmail: '' }), 'new-external')
})

test('gate fires only on a new external role pitch, never on interview/RTR/rate mail', () => {
  assert.equal(isRolePitch({ senderClass: 'new-external', category: 'Job Description', text: PITCH, jobTitle: 'Senior Security Engineer' }), true)
  assert.equal(isRolePitch({ senderClass: 'known-vendor', category: 'Job Description', text: PITCH, jobTitle: 'Senior Security Engineer' }), false)
  assert.equal(isRolePitch({ senderClass: 'new-external', category: 'Interview Request', text: PITCH, jobTitle: 'Senior Security Engineer' }), false)
  assert.equal(isRolePitch({ senderClass: 'new-external', category: 'Rate Confirmation', text: PITCH, jobTitle: 'Senior Security Engineer' }), false)
  assert.equal(isRolePitch({ senderClass: 'new-external', category: 'Job Description', text: 'Hello, just checking in.', jobTitle: '' }), false)
})

test('gate reply asks C2C or C2H first and contains no rate, PII, availability, resume or RTR language', () => {
  const body = gateReply('Priya', 'Senior Security Engineer', 'Acme Bank')
  assert.match(body, /C2C or as C2H/)
  assert.match(body, /only available on a C2C or C2H basis/)
  assert.deepEqual(gateViolations(body), [])
  assert.deepEqual(gateViolations(body + '\nMy rate is $60/hr.'), ['rate number'])
  assert.deepEqual(gateViolations('You may represent me on this req.'), ['RTR or employer language'])
})

test('availability ask is pure only; bundled rate/doc/RTR asks split out', () => {
  assert.equal(isAvailabilityAsk('When are you available for an interview this week?'), true)
  assert.equal(isAvailabilityAsk('When are you available for an interview? Please also share your DL copy.'), false)
  assert.equal(isAvailabilityAsk('When are you available? Rate is $60/hr C2C.'), false)
  assert.equal(hasBundledAsk('Please confirm the rate of $60/hr'), true)
  const body = availabilityReply('Dev')
  assert.match(body, /Monday to Thursday, 9 AM to 3 PM CST/)
  assert.deepEqual(availabilityViolations(body), [])
})

test('same-req match needs an exact req number or client plus role plus location', () => {
  assert.equal(chainsMatch({ req: '813222' }, { req: '813222' }), true)
  assert.equal(chainsMatch({ req: '813222' }, { req: '814050' }), false)
  assert.equal(chainsMatch({ client: 'VDOT', role: 'Cloud Security Engineer', location: 'Richmond' }, { client: 'VDOT', role: 'Cloud Security Engineer', location: 'Richmond' }), true)
  assert.equal(chainsMatch({ client: 'VDOT', role: 'Cloud Security Engineer' }, { client: 'VDOT', role: 'Cloud Security Engineer', location: 'Richmond' }), false)
  assert.equal(cardKey({ req: '813222' }), 'req:813222')
  assert.ok(cardKey({ senderEmail: 'a@x.com', role: 'Engineer', firstPitchDate: '2026-10-24' }).startsWith('pitch:'))
})

test('buckets: exactly needs-you, waiting, done, one at a time', () => {
  assert.equal(bucketFor({ decisionWaiting: true, sentAwaitingReply: false, resolved: false }), 'needs-you')
  assert.equal(bucketFor({ decisionWaiting: false, sentAwaitingReply: true, resolved: false }), 'waiting')
  assert.equal(bucketFor({ decisionWaiting: true, sentAwaitingReply: true, resolved: true }), 'done')
  assert.equal(bucketFor({ decisionWaiting: false, sentAwaitingReply: false, resolved: false, filedOnly: true }), 'done')
})

test('card header answers what, todo and if-ignored, and never invents a deadline', () => {
  const h = cardHeader({ role: 'Security Engineer', client: 'Acme', recruiterName: 'Priya', decision: 'Ask C2C or C2H' })
  assert.match(h.what, /Security Engineer at Acme/)
  assert.equal(h.todo, 'Ask C2C or C2H')
  assert.match(h.ifIgnored, /will not hear back/)
  assert.doesNotMatch(h.ifIgnored, /deadline/)
  const withDeadline = cardHeader({ role: 'X', decision: 'Confirm rate', deadline: 'Oct 30' })
  assert.match(withDeadline.ifIgnored, /Oct 30/)
})

test('buttons are verbs plus outcomes', () => {
  assert.equal(verbLabel('gate-c2c-c2h'), 'Ask C2C or C2H')
  assert.equal(verbLabel('availability-interview'), 'Confirm availability')
  assert.equal(verbLabel('followup-weekly-interview'), 'Send follow-up')
})

test('delegate eligibility: all five checks, no close-enough auto-send', () => {
  const optIn = { patternId: 'availability-interview', account: 'jayeshwar44@gmail.com', senderClass: 'new-external', enabledAt: '2026-10-24T00:00:00Z' }
  assert.equal(validDelegateOptIn(optIn), true)
  assert.equal(validDelegateOptIn({ ...optIn, patternId: 'gate-c2c-c2h' }), false)
  const base = { optIn, patternId: 'availability-interview', account: 'jayeshwar44@gmail.com', senderClass: 'new-external', priorTier1Sends: 1, pureAvailabilityAsk: true, doubleSubmitHold: false, body: availabilityReply('Dev') }
  assert.deepEqual(delegateEligible(base).eligible, true)
  assert.ok(delegateEligible({ ...base, priorTier1Sends: 0 }).reasons.length > 0)
  assert.ok(delegateEligible({ ...base, pureAvailabilityAsk: false }).reasons.length > 0)
  assert.ok(delegateEligible({ ...base, doubleSubmitHold: true }).reasons.length > 0)
  assert.ok(delegateEligible({ ...base, senderClass: 'marketing', optIn: { ...optIn, senderClass: 'marketing' } }).reasons.length > 0)
  assert.ok(delegateEligible({ ...base, body: availabilityReply('Dev') + ' Rate $60/hr.' }).reasons.length > 0)
  assert.ok(delegateEligible({ ...base, optIn: null }).reasons.length > 0)
})
