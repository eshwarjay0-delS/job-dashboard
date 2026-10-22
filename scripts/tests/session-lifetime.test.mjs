import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const H = 60 * 60 * 1000;
const NOW = 1_800_000_000_000;

function memStorage(seed = {}) {
  const m = new Map(Object.entries(seed));
  return {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: k => m.delete(k),
    _map: m,
  };
}

test('session clock is diagnostic and never imposes a client-side expiry', async () => {
  globalThis.localStorage = memStorage();
  const clock = await import('../../src/lib/session-clock.ts');
  assert.equal(clock.MINIMUM_EXPECTED_SESSION_MS, 72 * H);
  clock.stampLoginClock(NOW);
  assert.equal('reauthDue' in clock, false);
  assert.equal(clock.ensureLoginClock(NOW + 5 * H), NOW);
  clock.clearLoginClock();
  assert.equal(clock.ensureLoginClock(NOW + 9 * H), NOW + 9 * H);
});

const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const guardSrc = readFileSync(new URL('../../src/app/dashboard/session-lifetime-guard.tsx', import.meta.url), 'utf8');

test('Kompas never reloads or navigates merely because time passed or a deploy arrived', () => {
  assert.doesNotMatch(appSrc, /REAUTH_AFTER_MS|LOGIN_TTL_MS|checkLoginClock/);
  assert.doesNotMatch(appSrc, /window\.location\.href\s*=\s*["']\/login/);
  assert.match(appSrc, /b\.onclick = \(\) => location\.reload\(\)/);
  assert.doesNotMatch(appSrc, /if \(!live\) return location\.reload\(\)/);
});

test('web dashboard renews on open, focus, visibility and a 20-minute interval without redirecting', () => {
  assert.match(guardSrc, /supabase\.auth\.refreshSession\(\)/);
  assert.match(guardSrc, /addEventListener\("focus", renew\)/);
  assert.match(guardSrc, /addEventListener\("visibilitychange", renew\)/);
  assert.match(guardSrc, /20 \* 60 \* 1000/);
  assert.doesNotMatch(guardSrc, /location\.(?:assign|replace)|router\.(?:push|replace)/);
});

test('desktop bridge is preferred for renewal and reconnect is user-controlled', () => {
  assert.match(appSrc, /typeof window\.kompasDesktop\.refreshAuth === "function"/);
  assert.match(appSrc, /await window\.kompasDesktop\.refreshAuth\(\)/);
  assert.match(appSrc, /link\.textContent = "Reconnect sign-in"/);
  assert.match(appSrc, /window\.kompasDesktop\.openSignIn\(\)/);
  assert.match(appSrc, /window\.open\("\/login\?next="/);
});

test('1000 desktop renewal attempts use the bridge without navigation', async () => {
  const start = appSrc.indexOf('async function tryRefreshAuth()');
  const end = appSrc.indexOf('// Idle is where sessions used to die', start);
  const body = appSrc.slice(start, end) + '\nthis.tryRefreshAuth = tryRefreshAuth;';
  let calls = 0;
  const context = {
    window: { kompasDesktop: { refreshAuth: async () => { calls++; return true; } } },
    fetch: async () => { throw new Error('cookie fallback must not run'); },
    Date,
    __lastAuthRefresh: 0,
  };
  const { runInNewContext } = await import('node:vm');
  runInNewContext(body, context);
  for (let i = 0; i < 1000; i++) assert.equal(await context.tryRefreshAuth(), true);
  assert.equal(calls, 1000);
});

test('sign-in paths still stamp the diagnostic login time', () => {
  const layout = readFileSync(new URL('../../src/app/dashboard/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /SessionLifetimeGuard/);
  const callback = readFileSync(new URL('../../src/app/auth/callback/page.tsx', import.meta.url), 'utf8');
  assert.match(callback, /if \(fresh\) stampLoginClock\(\)/);
  const login = readFileSync(new URL('../../src/app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(login, /stampLoginClock\(\)/);
});
