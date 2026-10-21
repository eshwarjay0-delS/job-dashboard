import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Owner rule, 20 Oct 2026: a login lasts 3 days; opening the app inside the
// final 24 hours redirects to login for a fresh 3 days.

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

// ── src/lib/session-clock.ts ──────────────────────────────────────────────
test('session-clock: 3-day TTL, reauth due exactly at 48h', async () => {
  globalThis.localStorage = memStorage();
  const clock = await import('../../src/lib/session-clock.ts');
  assert.equal(clock.LOGIN_TTL_MS, 72 * H);
  assert.equal(clock.REAUTH_AFTER_MS, 48 * H);

  assert.equal(clock.loginClockStart(), 0);
  assert.equal(clock.reauthDue(NOW), false);

  clock.stampLoginClock(NOW);
  assert.equal(clock.loginClockStart(), NOW);
  assert.equal(clock.reauthDue(NOW + 47 * H), false);
  assert.equal(clock.reauthDue(NOW + 48 * H - 1), false);
  assert.equal(clock.reauthDue(NOW + 48 * H), true);
  assert.equal(clock.reauthDue(NOW + 73 * H), true);

  // ensureLoginClock never overwrites an existing stamp
  assert.equal(clock.ensureLoginClock(NOW + 5 * H), NOW);
  clock.clearLoginClock();
  assert.equal(clock.loginClockStart(), 0);
  assert.equal(clock.ensureLoginClock(NOW + 9 * H), NOW + 9 * H);
});

// ── public/kompas/app.js login-clock block ────────────────────────────────
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');  // a Windows checkout has CRLF; the repo stores LF
const block = appSrc.slice(appSrc.indexOf('// ── Login clock'), appSrc.indexOf('// ── end login clock ──'));

function kompasFixture({ session = true, stampAgeH = null } = {}) {
  const seed = stampAgeH === null ? {} : { mf_login_at: String(NOW - stampAgeH * H) };
  const storage = memStorage(seed);
  const calls = { redirects: [] };
  const context = vm.createContext({
    localStorage: storage,
    location: { protocol: 'https:' },
    supabaseSession: () => (session ? { access_token: 'x' } : null),
    redirectToLogin: msg => calls.redirects.push(msg),
    Date: { now: () => NOW },
    parseInt, isFinite,
    console,
  });
  vm.runInContext(block, context);
  return { storage, calls, context };
}

test('kompas clock: signed out — no stamp, no redirect', () => {
  const f = kompasFixture({ session: false });
  assert.equal(f.storage._map.has('mf_login_at'), false);
  assert.equal(f.calls.redirects.length, 0);
});

test('kompas clock: first sight of a session starts the clock', () => {
  const f = kompasFixture({ session: true });
  assert.equal(f.storage._map.get('mf_login_at'), String(NOW));
  assert.equal(f.calls.redirects.length, 0);
});

test('kompas clock: 47h in — still silent', () => {
  const f = kompasFixture({ stampAgeH: 47 });
  assert.equal(f.calls.redirects.length, 0);
  assert.equal(f.storage._map.get('mf_login_at'), String(NOW - 47 * H));
});

test('kompas clock: 48h in — redirect to login for a fresh 3 days', () => {
  const f = kompasFixture({ stampAgeH: 48 });
  assert.equal(f.calls.redirects.length, 1);
  assert.match(f.calls.redirects[0], /3-day sign-in is nearly up/);
  assert.equal(f.storage._map.has('mf_login_at'), false);
});

test('kompas clock: past 3 days — redirect', () => {
  const f = kompasFixture({ stampAgeH: 80 });
  assert.equal(f.calls.redirects.length, 1);
});

// ── wiring ────────────────────────────────────────────────────────────────
test('wiring: keepalive checks the clock; sign-in paths stamp it', () => {
  assert.match(appSrc, /function keepAuthAlive\(\) \{\n  checkLoginClock\(\);/);
  const layout = readFileSync(new URL('../../src/app/dashboard/layout.tsx', import.meta.url), 'utf8');
  assert.match(layout, /SessionLifetimeGuard/);
  const callback = readFileSync(new URL('../../src/app/auth/callback/page.tsx', import.meta.url), 'utf8');
  assert.match(callback, /if \(fresh\) stampLoginClock\(\)/);
  assert.match(callback, /finish\(existing\.session, false\)/);
  const login = readFileSync(new URL('../../src/app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(login, /stampLoginClock\(\)/);
});
