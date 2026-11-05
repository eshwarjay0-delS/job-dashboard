import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8');
const start = app.indexOf('function trackEndStopsCapture');
const end = app.indexOf('async function attachSource', start);
assert.ok(start >= 0 && end > start);
const ctx = createContext({});
runInContext(app.slice(start, end) + '\nthis.trackEndStopsCapture = trackEndStopsCapture;', ctx);

test('the screen picture ending does not stop computer audio, twenty folds', () => {
  const cases = [
    ['Them', 'video', false],
    ['Them', 'audio', true],
    ['You', 'audio', true],
    ['You', 'video', true],
  ];
  for (let fold = 0; fold < 20; fold++) {
    for (const [who, kind, stops] of cases) {
      assert.equal(ctx.trackEndStopsCapture(who, kind), stops, fold + ' ' + who + ' ' + kind);
    }
  }
  const handler = app.indexOf('track.addEventListener("ended"');
  const stop = app.indexOf('void stopSource(who);', handler);
  assert.ok(handler >= 0 && stop > handler);
  assert.match(app.slice(handler, stop), /trackEndStopsCapture\(who, track\.kind\)/);
  assert.match(app, /cap\.holdVideo = hold/);
});
