import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Owner, 1 Nov 2026: the Screen Answer button captures windows first and
// foremost. Two halves: the page asks the browser for a window surface
// first (a refusal falls back to the plain call, a cancelled picker is
// never retried), and the desktop shell answers its own display-media
// request with a window source before any screen.
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const mainSrc = readFileSync(new URL('../../../perfact-desktop/main.js', import.meta.url), 'utf8');

test('screenStream asks for a window surface before the plain call', () => {
  const start = appSrc.indexOf('async function screenStream()');
  const end = appSrc.indexOf('function stripScreenChrome', start);
  assert.ok(start >= 0 && end > start, 'screenStream slice found');
  const body = appSrc.slice(start, end);
  assert.match(body, /\{ displaySurface: "window" \}/);
  assert.ok(body.indexOf('displaySurface: "window"') < body.indexOf('audio: desktop'), 'window hint precedes the audio retry');
  assert.match(body, /name === "NotAllowedError"\) throw e/);
});

test('the shell answers display-media with windows before screens', () => {
  assert.match(mainSrc, /types: \["window", "screen"\]/);
  assert.match(mainSrc, /pickDisplaySource\(sources, ownWindowHandle\(\)\)/);
  assert.ok(!/types: \["screen"\]/.test(mainSrc), 'no screen-only request remains');
});
