// Overview declutter, Oct 2026: the page used to open with a full "What matters
// now" section, then a duplicate mail strip, then two tables whose every row
// carried its latest quote, journey numbers, and contact pills inline. The
// order now is summary, Submission progress, Waiting to board, and the
// "What matters now" section waits behind one tap; row detail waits behind
// one tap per row. No numbers are invented: the summary and the next
// interview come from the chains already loaded on the page.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('../../src/app/dashboard/overview/page.tsx', import.meta.url), 'utf8')

test('summary numbers and next interview come before the Submission progress table', () => {
  const summary = src.indexOf('Summary first')
  const submission = src.indexOf('<TrainFront size={17} /> Submission progress')
  assert.ok(summary > 0 && submission > summary, 'summary must precede Submission progress')
  assert.ok(src.includes('nextInterview'), 'next interview must be derived from loaded chains')
})

test('Waiting table is named Waiting to board, not a second RTR discussion list', () => {
  assert.ok(src.includes('Waiting to board'), 'waiting heading must read Waiting to board')
})

test('row detail is behind a per-row tap, not inline for every chain', () => {
  assert.ok(src.includes('Show the full chain'), 'row must offer Show the full chain')
  assert.ok(src.includes('details && chain.latestProgress'), 'latest quote must wait behind details')
  assert.ok(src.includes('details && chain.contacts'), 'contact pills must wait behind details')
  assert.ok(src.includes('<TrackBar chain={chain}'), 'progress bar must stay visible without the tap')
})

test('What matters now waits behind one tap, after the tables', () => {
  assert.ok(src.includes('Show what matters now'), 'standing section must wait behind a tap')
  const standingToggle = src.indexOf('Show what matters now')
  const waitingTable = src.indexOf('Waiting to board')
  assert.ok(standingToggle > waitingTable, 'standing toggle must come after the Waiting table')
  assert.ok(!src.includes('<StandingSection account={filter} />\n\n      <div'), 'standing section must not sit above the tables')
})

test('Overview does not duplicate the Home/Mail important-mail strip', () => {
  assert.ok(!src.includes('ImportantMail'), 'ImportantMail must not render on Overview')
})
