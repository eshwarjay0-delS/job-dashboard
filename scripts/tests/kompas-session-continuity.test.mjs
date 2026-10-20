import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8');
const life = source.slice(source.indexOf('function sweepSessions()'), source.indexOf('// Another window changed the sessions:'));
function fixture(ageMinutes, { live = false, elsewhere = false, ended = false, interrupted = false } = {}) {
  const now = 100000000;
  const record = { id: 'meeting', runAt: 1, pausedAt: interrupted ? null : now - ageMinutes * 60000, endedAt: ended ? 2 : null };
  const calls = { launched: 0, closed: 0, writes: 0 };
  const context = vm.createContext({ sessions: [record], Date: { now: () => now },
    CONTINUE_MS: 30 * 60000, endTimer: 0, clearTimeout() {}, setTimeout() { return 1; },
    sessionOpen: s => !!s.runAt && !s.endedAt, liveOpenFor: () => live, liveElsewhere: () => elsewhere,
    lastHeardAt: () => now - ageMinutes * 60000,
    LS: { get: () => [record], set: () => calls.writes++ }, renderSessions: () => {},
    launchCopilot: () => calls.launched++, closeRun: (s, at, by) => { calls.closed++; s.endedAt = at; s.endedBy = by; },
  });
  vm.runInContext(life, context);
  return { record, calls, context };
}
for (const age of [20, 30, 40, 60, 1440]) {
  test(`paused session remains recoverable after ${age} minutes`, () => {
    const f = fixture(age);
    vm.runInContext('sweepSessions(); continueSession(sessions[0]);', f.context);
    assert.equal(f.calls.closed, 0); assert.equal(f.calls.launched, 1); assert.equal(f.record.endedAt, null);
  });
}
test('lost heartbeat after 40 minutes preserves an interrupted run', () => {
  const f = fixture(40, { interrupted: true });
  vm.runInContext('sweepSessions(); continueSession(sessions[0]);', f.context);
  assert.equal(f.calls.closed, 0); assert.equal(f.calls.launched, 1);
});
test('background live session is not marked stopped', () => {
  const f = fixture(60, { interrupted: true, live: true });
  vm.runInContext('sweepSessions()', f.context);
  assert.equal(f.record.pausedAt, null); assert.equal(f.calls.closed, 0);
});
test('another active window retains ownership', () => {
  const f = fixture(40, { elsewhere: true });
  vm.runInContext('continueSession(sessions[0]); endSession(sessions[0]);', f.context);
  assert.equal(f.calls.launched, 0); assert.equal(f.calls.closed, 0);
});
test('explicit End still finalizes a session', () => {
  const f = fixture(40);
  vm.runInContext('endSession(sessions[0]); continueSession(sessions[0]);', f.context);
  assert.equal(f.calls.closed, 1); assert.equal(f.record.endedBy, 'you'); assert.equal(f.calls.launched, 0);
});
test('historical ended sessions are not silently reopened', () => {
  const f = fixture(40, { ended: true });
  vm.runInContext('sweepSessions(); continueSession(sessions[0]);', f.context);
  assert.equal(f.record.endedAt, 2); assert.equal(f.calls.launched, 0);
});
