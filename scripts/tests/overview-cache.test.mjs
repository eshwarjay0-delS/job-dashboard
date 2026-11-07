// Overview instant copy (7 Nov 2026, owner ask): the list must load from cache,
// readily available at all times, with new things appearing as the background
// scan finds them. The page paints the saved list at once, the quiet scan
// merges each page into it, and a saved list fresher than 15 minutes is shown
// as-is with no scan behind it.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { OVERVIEW_SNAPSHOT_KEY_PREFIX, OVERVIEW_REFRESH_TTL_MS, overviewKey, readOverviewSnapshot, keepOverviewSnapshot, snapshotIsFresh, mergeChains } from '../../src/lib/overview-cache.ts'

const read = (p) => readFileSync(new URL('../../' + p, import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const NOW = Date.UTC(2026, 10, 7, 21, 0, 0) // Saturday 7 Nov 2026
const MIN = 60_000
// Made-up chains. Nothing here is a real submission.
let n = 0
const chain = (over = {}) => ({
  threadId: 't' + (++n),
  accountEmail: 'me@example.com',
  company: 'Northpier',
  role: 'Security Engineer',
  current: 'rtr',
  lastActivity: NOW - 3 * 24 * 60 * MIN,
  ...over,
})

test('fresh pages merge into the painted list without ever taking a shown row away', () => {
  const painted = [chain({ threadId: 'a' }), chain({ threadId: 'b' })]
  const fresh = [chain({ threadId: 'b', role: 'SOC Analyst' }), chain({ threadId: 'c' })]
  const merged = mergeChains(painted, fresh)
  assert.deepEqual(merged.map(c => c.threadId), ['a', 'b', 'c'], 'updated chains replace in place, new chains append')
  assert.equal(merged.find(c => c.threadId === 'b').role, 'SOC Analyst', 'the fresh copy wins for the same chain')
  assert.equal(merged.find(c => c.threadId === 'a').role, 'Security Engineer', 'a chain the slow load has not reached yet stays put')
  // The same thread in another inbox is a different chain.
  const other = mergeChains(painted, [chain({ threadId: 'a', accountEmail: 'other@example.com' })])
  assert.equal(other.length, 3)
  assert.deepEqual(mergeChains([], fresh).map(c => c.threadId), ['b', 'c'], 'an empty paint is just the fresh pages')
  assert.deepEqual(mergeChains(painted, []), painted, 'an empty page takes nothing away')
})

test('the snapshot key is per person and per inbox, and freshness is 15 minutes', () => {
  assert.equal(OVERVIEW_REFRESH_TTL_MS, 15 * 60 * 1000)
  assert.equal(overviewKey(null, ''), null, 'no signed-in person, no key')
  assert.equal(overviewKey('user-1', ''), `${OVERVIEW_SNAPSHOT_KEY_PREFIX}user-1:all`)
  assert.equal(overviewKey('user-1', 'me@example.com'), `${OVERVIEW_SNAPSHOT_KEY_PREFIX}user-1:me@example.com`)
  const snap = { chains: [], scanned: 98, at: NOW - 14 * MIN }
  assert.equal(snapshotIsFresh(snap, NOW), true, '14 minutes old is fresh')
  assert.equal(snapshotIsFresh({ ...snap, at: NOW - 15 * MIN }, NOW), false, '15 minutes old is not fresh')
  assert.equal(snapshotIsFresh({ ...snap, at: NOW - 16 * MIN }, NOW), false)
  assert.equal(snapshotIsFresh(null, NOW), false, 'no snapshot is never fresh')
})

test('without browser storage the snapshot helpers stay silent, never throw', () => {
  // node has no localStorage: a read finds nothing, a keep is a no-op.
  assert.equal(readOverviewSnapshot('mfit:overview-chains:v1:nobody:all'), null)
  assert.doesNotThrow(() => keepOverviewSnapshot('mfit:overview-chains:v1:nobody:all', { chains: [], scanned: 0, at: NOW }))
})

test('the Overview paints the saved list, refreshes quietly behind it, and skips a fresh one', () => {
  const page = read('src/app/dashboard/overview/page.tsx')
  assert.ok(page.includes('readOverviewSnapshot(key)'), 'the saved list is painted on mount')
  assert.ok(page.includes('setChains(snap.chains)'), 'the paint shows the saved chains at once')
  assert.ok(page.includes('mergeChains(paintedRef.current'), 'each scan page merges into the painted list')
  assert.ok(page.includes('keepOverviewSnapshot(key, { chains: merged'), 'each page is saved at once')
  assert.ok(page.includes('keepOverviewSnapshot(key, { chains: fresh'), 'a clean full scan becomes the saved copy exactly')
  assert.ok(page.includes('snapshotIsFresh(snap, Date.now())'), 'a fresh saved list is shown as-is')
  assert.ok(page.includes('Tap Refresh history for a fresh scan.'), 'the fresh list says how to force a scan')
  assert.ok(page.includes('forceRefreshRef.current = true'), 'Refresh history forces a fresh scan')
  assert.ok(page.includes('checking for new mail'), 'the background refresh says so while it runs')
})
