import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Owner, 1 Nov 2026: no auth UI ever mid-session. The 31 Oct reconnect pill
// is gone; when renewal fails the session waits silently on a 30s probe, and
// the failed answer resumes itself the moment auth heals. These tests run
// the real wait/heal slice, not a source grep, for the behavior that matters.
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function loadWait(overrides = {}) {
  const start = appSrc.indexOf('let __authWaitTimer');
  const end = appSrc.indexOf('async function preparePack', start);
  assert.ok(start >= 0 && end > start, 'silent-auth slice found');
  const body = appSrc.slice(start, end) + '\nthis.waitForAuthSilently = waitForAuthSilently;\nthis.healAuthSilently = healAuthSilently;';
  let captured = null;
  let timers = 0;
  let cleared = 0;
  const context = {
    cards: overrides.cards || [],
    idx: 0,
    renderCard: () => {},
    generateAnswer: overrides.generateAnswer || (() => {}),
    tryRefreshAuth: overrides.tryRefreshAuth || (async () => false),
    fetch: overrides.fetch || (async () => ({ ok: true })),
    setInterval: (fn) => { timers++; captured = fn; return 1; },
    clearInterval: () => { cleared++; },
  };
  runInNewContext(body, context);
  return { context, tick: () => captured, timers: () => timers, cleared: () => cleared };
}

test('auth wait shows no UI and auto-retries the failed answer when the probe heals', async () => {
  const card = { question: 'Q', answer: ['…'] };
  const generated = [];
  const w = loadWait({ cards: [card], generateAnswer: (...a) => generated.push(a) });
  w.context.waitForAuthSilently({ question: 'Q', card, opts: { derived: 'DQ' } });
  assert.equal(generated.length, 0, 'nothing retries before auth heals');
  assert.equal(typeof w.tick(), 'function', 'probe timer started');
  await w.tick()();
  assert.equal(generated.length, 1, 'failed answer resumes on heal');
  assert.equal(generated[0][0], 'Q');
  assert.equal(generated[0][1], card);
  assert.equal(generated[0][2].derived, 'DQ', 'derived question preserved across the wait');
});

test('a second failure while waiting queues behind the first, and heal runs both', async () => {
  const cardA = { question: 'A', answer: ['…'] };
  const cardB = { question: 'B', answer: ['…'] };
  const generated = [];
  const w = loadWait({ cards: [cardA, cardB], generateAnswer: (...a) => generated.push(a) });
  w.context.waitForAuthSilently({ question: 'A', card: cardA, opts: {} });
  w.context.waitForAuthSilently({ question: 'B', card: cardB, opts: {} });
  assert.equal(w.timers(), 1, 'one probe for the whole wait');
  await w.tick()();
  assert.deepEqual(generated.map(g => g[0]), ['A', 'B'], 'both queued answers resume in order');
});

test('the same card failing twice while waiting retries only once on heal', async () => {
  const card = { question: 'Q', answer: ['…'] };
  const generated = [];
  const w = loadWait({ cards: [card], generateAnswer: (...a) => generated.push(a) });
  w.context.waitForAuthSilently({ question: 'Q', card, opts: {} });
  w.context.waitForAuthSilently({ question: 'Q', card, opts: {} });
  await w.tick()();
  assert.equal(generated.length, 1, 'no duplicate retry for the same card');
});

test('wait stops after 20 failed probes with a neutral, non-auth message and no retry', async () => {
  const card = { question: 'Q', answer: ['…'] };
  const generated = [];
  const w = loadWait({ cards: [card], fetch: async () => ({ ok: false }), generateAnswer: (...a) => generated.push(a) });
  w.context.waitForAuthSilently({ question: 'Q', card, opts: {} });
  for (let i = 0; i < 20; i++) await w.tick()();
  assert.equal(generated.length, 0, 'nothing retries while auth stays down');
  assert.ok(w.cleared() >= 1, 'probe timer stopped');
  const msg = card.answer[0];
  assert.match(msg, /Still waiting for the session/);
  assert.doesNotMatch(msg, /sign|auth|login|reconnect/i, 'cap message never names auth');
});

test('no auth UI text remains in the client', () => {
  assert.doesNotMatch(appSrc, /sessionReconnect|Reconnect sign-in|Sign-in expired/);
});
