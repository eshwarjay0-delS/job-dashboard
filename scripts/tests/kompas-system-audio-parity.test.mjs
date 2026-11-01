import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// Owner, 1 Nov 2026, parity rule: microphone accuracy and computer audio
// must be the same level every time. Diagnosis from code alone: the mic
// gets browser auto-gain, the raw system loopback gets none, so quiet call
// audio sat under the VAD floor and dropped every 6 s while the mic
// transcribed fine. The fix is a Them-only tap gain on the measured level
// (never the recorded stream); VAD thresholds are untouched.
const appSrc = readFileSync(new URL('../../public/kompas/app.js', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function loadVad() {
  const start = appSrc.indexOf('function dictateStep(');
  const end = appSrc.indexOf('// Audio-silence watchdog hooks', start);
  assert.ok(start >= 0 && end > start, 'dictateStep slice found');
  const body = appSrc.slice(start, end) + '\nthis.dictateStep = dictateStep;';
  const context = {};
  runInNewContext(body, context);
  return context.dictateStep;
}

function runTrack(dictateStep, who, levels) {
  const cap = { who, noise: 0.001, speechMs: 0, voiced: false, lastVoice: 0, lastTick: 0, segStart: 0 };
  let now = 100;
  const actions = [];
  for (const rms of levels) {
    const step = dictateStep(cap, rms, now, undefined);
    Object.assign(cap, { noise: step.noise, speechMs: step.speechMs, voiced: step.voiced, lastVoice: step.lastVoice, lastTick: step.lastTick, floorMin: step.floorMin, floorAt: step.floorAt });
    actions.push(step.action);
    now += 100;
  }
  return { cap, actions };
}

const quiet = Array(71).fill(0.002);
const boosted = [...Array(20).fill(0.008), ...Array(20).fill(0.0005)];

test('VAD level boundary: steady quiet audio under the floor never counts as speech', () => {
  const dictateStep = loadVad();
  const { cap, actions } = runTrack(dictateStep, 'Them', quiet);
  assert.equal(cap.speechMs, 0, 'no voiced millisecond counted in 7 s of quiet audio');
  assert.ok(actions.includes('drop'), 'idle recycle drops the below-floor segment');
  assert.ok(!actions.includes('end') && !actions.includes('rescue'), 'nothing rescues it');
});

test('the same audio lifted 4x (the Them tap gain) speaks and ends cleanly', () => {
  const dictateStep = loadVad();
  const { cap, actions } = runTrack(dictateStep, 'Them', boosted);
  assert.ok(cap.speechMs > 120, 'voiced time counted once lifted above the floor');
  assert.ok(actions.includes('end'), 'silence after speech ends the segment for transcription');
});

test('Them-only tap gain is wired before both level paths, recording untouched', () => {
  assert.match(appSrc, /who === "Them" && typeof ctx\.createGain === "function"/, 'tap only for the system track');
  assert.match(appSrc, /tap\.gain\.value = 4/, 'tap gain is 4x');
  assert.match(appSrc, /tapSrc\.connect\(an\)/, 'analyser reads the tapped level');
  assert.match(appSrc, /tapSrc\.connect\(node\)/, 'worklet reads the tapped level');
  assert.match(appSrc, /cap\.tap && cap\.tap\.disconnect\(\)/, 'tap torn down with the source');
  assert.match(appSrc, /new MediaRecorder\(cap\.stream/, 'recording still uses the raw stream, never the tap');
});
