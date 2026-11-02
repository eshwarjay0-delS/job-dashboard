import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createContext, runInContext } from 'node:vm';
import test from 'node:test';

const app = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8');
const desktop = readFileSync(new URL('../../legacy/perfact/desktop/main.js', import.meta.url), 'utf8');
const uiStart = app.indexOf('let sysConnecting = false;');
const uiEnd = app.indexOf('$("micBtn").onclick =', uiStart);
const captureStart = app.indexOf('async function startSys() {');
const captureEnd = app.indexOf('// Silence warning', captureStart);
assert.ok(uiStart >= 0 && uiEnd > uiStart && captureStart >= 0 && captureEnd > captureStart);
const code = app.slice(uiStart, uiEnd) + '\n' + app.slice(captureStart, captureEnd)
  + '\nthis.api = { startSys, syncSrc, cancel: () => { sysAttempt++; sysConnecting = false; syncSrc(); } };';

function harness(getDisplayMedia, attach) {
  const attributes = {};
  const buttons = Object.fromEntries(['micBtn', 'sysBtn'].map(id => [id, {
    title: '',
    attributes: {},
    classList: { toggle(name, on) { attributes[id + ':' + name] = !!on; } },
    setAttribute(name, value) { this.attributes[name] = value; },
  }]));
  const state = {
    running: true,
    captures: [],
    captureErrors: [],
    srcOn: { mic: true, sys: true },
    sourceGeneration: { Them: 0 },
    window: { kompasDesktop: { systemAudio: true } },
    navigator: { mediaDevices: { getDisplayMedia } },
    MediaStream: class { constructor(tracks) { this.tracks = tracks; } },
    attachSource: async (...args) => { if (attach) await attach(state, ...args); else state.captures.push({ who: 'Them', stream: { getAudioTracks: () => [audioTrack] } }); },
    $: id => buttons[id],
  };
  const context = createContext(state);
  runInContext(code, context);
  return { state, buttons, attributes, api: context.api };
}
const audioTrack = { kind: 'audio', readyState: 'live', stop() {} };
const available = () => ({ getAudioTracks: () => [audioTrack], getTracks: () => [audioTrack] });
const noAudio = () => ({ getAudioTracks: () => [], getTracks: () => [{ stop() {} }] });

test('initial source control render waits until lexical running and captures state exists', () => {
  const runningAt = app.indexOf('let running = false;');
  const capturesAt = app.indexOf('let captures = [];');
  const renderAt = app.indexOf('\nsyncSrc();', capturesAt);
  assert.ok(runningAt >= 0 && capturesAt > runningAt && renderAt > capturesAt,
    'initial syncSrc must run after both lexical declarations; otherwise app boot throws ReferenceError');
  assert.equal(app.slice(uiStart, capturesAt).includes('\nsyncSrc();'), false,
    'do not invoke initial syncSrc in the temporal dead zone');
});
test('Windows output-mix handler remains wired and requires an explicit session capture', () => {
  assert.match(desktop, /setDisplayMediaRequestHandler/);
  assert.match(desktop, /audio: "loopback"/);
  assert.match(app, /if \(srcOn\.sys\) opening\.push\(startSys\(\)\)/);
  assert.match(app, /if \(who === "Them"\) \{ displayVideo = null; sysAttempt\+\+;/);
});
test('computer-audio control says ready before a session, not listening', () => {
  const { state, buttons, api } = harness(async () => available());
  state.running = false;
  api.syncSrc();
  assert.match(buttons.sysBtn.title, /ready for next Start/);
  assert.equal(buttons.sysBtn.attributes['aria-busy'], 'false');
});
test('successful Windows loopback reports listening only after track attachment', async () => {
  let options;
  const { buttons, attributes, api, state } = harness(async opts => { options = opts; return available(); });
  await api.startSys();
  assert.equal(buttons.sysBtn.title, 'Computer audio (interviewer) — listening');
  assert.equal(buttons.sysBtn.attributes['aria-pressed'], 'true');
  assert.equal(buttons.sysBtn.attributes['aria-busy'], 'false');
  assert.equal(attributes['sysBtn:on'], true);
  assert.equal(state.captures.length, 1);
  assert.equal(options.video, true);
  assert.equal(options.audio, true);
  assert.equal(options.systemAudio, undefined);
});
test('while loopback is pending the control says connecting, not listening', async () => {
  let release;
  const { buttons, api } = harness(() => new Promise(resolve => { release = resolve; }));
  const pending = api.startSys();
  assert.match(buttons.sysBtn.title, /connecting/);
  assert.equal(buttons.sysBtn.attributes['aria-busy'], 'true');
  assert.equal(buttons.sysBtn.attributes['aria-pressed'], 'false');
  release(available());
  await pending;
  assert.match(buttons.sysBtn.title, /listening/);
});
test('ended or stopped computer-audio tracks never display listening', async () => {
  const { state, buttons, api } = harness(async () => available());
  await api.startSys();
  assert.match(buttons.sysBtn.title, /listening/);
  const cap = state.captures[0];
  cap.stream.getAudioTracks = () => [{ readyState: 'ended' }];
  api.syncSrc();
  assert.match(buttons.sysBtn.title, /off/);
  assert.equal(buttons.sysBtn.attributes['aria-pressed'], 'false');
  cap.stream.getAudioTracks = () => [audioTrack];
  cap.stopped = true;
  api.syncSrc();
  assert.match(buttons.sysBtn.title, /off/);
});
test('missing Windows audio track fails visibly and resets requested state', async () => {
  const { state, buttons, api } = harness(async () => noAudio());
  await api.startSys();
  assert.equal(state.srcOn.sys, false);
  assert.equal(buttons.sysBtn.attributes['aria-pressed'], 'false');
  assert.match(state.captureErrors.join(' '), /Windows loopback returned no audio track/);
  assert.match(state.captureErrors.join(' '), /default output device/);
});
test('denied capture reports an actionable error rather than a silent OFF toggle', async () => {
  const { state, buttons, api } = harness(async () => { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }); });
  await api.startSys();
  assert.equal(state.srcOn.sys, false);
  assert.match(state.captureErrors.join(' '), /Windows audio capture was denied/);
  assert.equal(buttons.sysBtn.attributes['aria-busy'], 'false');
});
test('retry clears previous call-audio error when audio becomes available', async () => {
  let fail = true;
  const { state, api, buttons } = harness(async () => fail ? noAudio() : available());
  await api.startSys();
  assert.equal(state.captureErrors.length, 1);
  fail = false;
  state.srcOn.sys = true;
  await api.startSys();
  assert.equal(state.captureErrors.length, 0);
  assert.match(buttons.sysBtn.title, /listening/);
});
test('a returned but unattached audio track is not misrepresented as live', async () => {
  const { state, api, buttons } = harness(async () => available(), async () => {});
  await api.startSys();
  assert.equal(state.srcOn.sys, false);
  assert.match(state.captureErrors.join(' '), /could not be initialized/);
  assert.equal(buttons.sysBtn.attributes['aria-pressed'], 'false');
});
test('cancelled pending capture does not restore stale busy state', async () => {
  let release;
  const { state, api, buttons } = harness(() => new Promise(resolve => { release = resolve; }),
    async (s) => { if (s.srcOn.sys) s.captures.push({ who: 'Them', stream: { getAudioTracks: () => [audioTrack] } }); });
  const pending = api.startSys();
  state.srcOn.sys = false;
  state.sourceGeneration.Them++;
  api.cancel();
  release(available());
  await pending;
  assert.equal(buttons.sysBtn.attributes['aria-busy'], 'false');
  assert.equal(buttons.sysBtn.attributes['aria-pressed'], 'false');
});
