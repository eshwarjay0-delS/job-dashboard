import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Owner, 1 Nov 2026: a press that finds nothing to answer must say which
// link is missing instead of the dead-end "no question detected". The
// helper is pure; the call site in aiAnswer computes the four flags from
// live state (captures, speaker-button state, the Them cap's last audible
// time). The answer-anyway flow for lines judged noise is untouched.
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function loadFn() {
  const start = appSrc.indexOf('function emptyPressReason(');
  const end = appSrc.indexOf('\n}', start);
  assert.ok(start >= 0 && end > start, 'emptyPressReason slice found');
  const context = {};
  runInNewContext(appSrc.slice(start, end + 2) + '\nthis.emptyPressReason = emptyPressReason;', context);
  return context.emptyPressReason;
}

test('nothing capturing at all says so', () => {
  assert.equal(loadFn()(false, false, false, false), 'Nothing is capturing right now — press Start, or type a question.');
});

test('speaker button on but no system track says the share ended', () => {
  assert.equal(loadFn()(true, true, false, false), 'Call audio sharing ended — press the speaker button to share it again.');
});

test('system track silent for a while says to check the shared tab', () => {
  assert.equal(loadFn()(true, true, true, true), 'Kompas hears silence from the shared audio — check the shared tab is playing sound and tab audio is shared, then keep playing.');
});

test('system track audible but nothing transcribed says to keep playing', () => {
  assert.equal(loadFn()(true, true, true, false), 'Kompas hears the call audio but nothing has been transcribed yet — keep playing, then press AI Answer again.');
});

test('mic-only capture with nothing said keeps the generic line', () => {
  assert.equal(loadFn()(true, false, false, false), 'Nothing heard yet — press Start, or type a question.');
});

test('aiAnswer calls the helper with live capture state', () => {
  assert.match(appSrc, /emptyPressReason\(captures\.length > 0/);
  assert.match(appSrc, /captures\.find\(c => c\.who === "Them"\)/);
  assert.match(appSrc, /lastAudibleAt \|\| 0\) > 20000/);
});
