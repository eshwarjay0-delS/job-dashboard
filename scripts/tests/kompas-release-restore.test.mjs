import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner, 1 Nov 2026: a window restored from the hidden-but-alive state must
// reload when the release changed — but never mid-capture or mid-answer.
// The page side is a derived getter, never a stored flag, so it cannot go
// stale; on any error it reports busy (fail-closed: no reload).
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

test('page exposes a derived live-activity getter for the shell restore guard', () => {
  assert.match(appSrc, /Object\.defineProperty\(win, "__kompasLiveActivity"/);
  assert.match(appSrc, /deps\.captures\(\)\.some\(\(c\) => c && !c\.stopped\)/);
  assert.match(appSrc, /deps\.cards\(\)\.some\(\(c\) => c && c\.streaming\)/);
});

test('live-activity getter fails closed: any error reports busy, never idle', () => {
  const start = appSrc.indexOf('"__kompasLiveActivity"');
  const end = appSrc.indexOf('win.__kompasRestartCapture', start);
  assert.ok(start >= 0 && end > start, 'getter block found');
  const block = appSrc.slice(start, end);
  assert.match(block, /catch \{ return true; \}/, 'getter error path returns busy');
});

test('watchdog deps carry the card list the getter reads', () => {
  assert.match(appSrc, /cards: \(\) => cards,/);
});
