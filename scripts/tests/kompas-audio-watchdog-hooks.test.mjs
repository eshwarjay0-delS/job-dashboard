// Slice 5d (29 Oct 2026): the web hooks the desktop audio-silence watchdog reads (desktop-patches/audio-silence-watchdog.md).
// installWatchdogHooks is sliced from public/kompas/app.js and run against a fake window, fake captures and a fake
// AudioContext. Nothing here touches a real device.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const a = src.indexOf("function installWatchdogHooks("), b = src.indexOf("let kompasLevelTap", a);
assert.ok(a > 0 && b > a, "installWatchdogHooks is in app.js");
const ctx = { Date, Number, Math, Object, Promise, Set, Array };
vm.createContext(ctx);
vm.runInContext(src.slice(a, b) + "\nthis.install = installWatchdogHooks;", ctx);

const track = (state = "live") => ({ kind: "audio", readyState: state, stop() { this.readyState = "ended"; } });
function rig({ running = true, desktop = true, sources = ["You", "Them"], failStart = false } = {}) {
  const win = {};
  const audio = { state: "running", closes: 0 };
  const calls = [];
  const st = { running, captures: sources.map((who) => ({ who, stopped: false, stream: { getAudioTracks: () => [track()] } })) };
  const deps = {
    captures: () => st.captures, running: () => st.running, desktop: () => desktop,
    stopSource: async (w) => { calls.push("stop:" + w); st.captures = st.captures.filter((c) => c.who !== w); },
    startMic: async () => { calls.push("start:You"); if (failStart) throw new Error("NotReadableError"); st.captures.push({ who: "You", stopped: false, stream: { getAudioTracks: () => [track()] } }); },
    startSys: async () => { calls.push("start:Them"); st.captures.push({ who: "Them", stopped: false, stream: { getAudioTracks: () => [track()] } }); },
    primeAudio: () => { calls.push("prime"); if (audio.state === "closed") audio.state = "running"; },
    reportSources: () => calls.push("report"),
  };
  const tap = ctx.install(win, deps);
  return { win, tap, calls, st, audio };
}
const settle = () => new Promise((r) => setTimeout(r, 5));

test("5d-1. __kompasLevels is the louder source over the last second, written only from the level tap", () => {
  const { win, tap } = rig();
  assert.equal(win.__kompasLevels, undefined);
  tap("You", 0.01); tap("Them", 0.2);
  assert.equal(win.__kompasLevels.peak, 0.2);
  assert.ok(Math.abs(win.__kompasLevels.at - Date.now()) < 1000);
  for (const bad of [NaN, -1, "x", undefined, Infinity]) tap("You", bad);
  tap("Robot", 0.9);
  assert.equal(win.__kompasLevels.peak, 0.2, "bad input and unknown sources are ignored");
});

test("5d-2. __kompasTracks lists the attached tracks and the desktop can read readyState", () => {
  const { win, st } = rig();
  assert.ok(Array.isArray(win.__kompasTracks));
  assert.deepEqual(Array.from(win.__kompasTracks, (t) => t.readyState), ["live", "live"]);
  st.captures = [st.captures[0]];
  assert.equal(win.__kompasTracks.length, 1, "a source that is off is left out");
  st.captures = null;   // a broken captures list never throws
  assert.deepEqual(Array.from(win.__kompasTracks), []);
});

test("5d-3. __kompasRestartCapture restarts the attached sources once per call and never throws", async () => {
  const r = rig();
  assert.equal(r.win.__kompasRestartCapture(), true);
  assert.equal(r.win.__kompasRestartCapture(), false, "a second call while restarting does nothing");
  await settle();
  assert.deepEqual(r.calls, ["stop:You", "prime", "start:You", "stop:Them", "prime", "start:Them", "report"]);
  assert.equal(r.win.__kompasRestartCapture(), true, "after it finishes, a new explicit call may restart again");
});

test("5d-4 failsafe: not capturing, browser call audio, a failing device, or a closed context", async () => {
  const idle = rig({ running: false });
  assert.equal(idle.win.__kompasRestartCapture(), false);
  await settle();
  assert.deepEqual(idle.calls, []);
  const browser = rig({ desktop: false });
  browser.win.__kompasRestartCapture(); await settle();
  assert.ok(!browser.calls.includes("start:Them"), "a browser page never re-opens the share dialog by itself");
  const failing = rig({ failStart: true, sources: ["You"] });
  assert.doesNotThrow(() => failing.win.__kompasRestartCapture()); await settle();
  assert.ok(failing.calls.includes("report"), "a failed restart still finishes");
  const before = failing.calls.length;
  assert.equal(failing.win.__kompasRestartCapture(), false);
  assert.deepEqual(failing.calls.slice(before), ["prime"], "the guard was released: the next call ran (nothing left to restart)");
  const none = rig({ sources: [] });
  assert.equal(none.win.__kompasRestartCapture(), false);
  assert.deepEqual(none.calls, ["prime"], "nothing attached: only the AudioContext is resumed");
});

test("5d-5. nothing on the page calls the restart, and the hooks never navigate or touch sign-in", () => {
  const callers = src.split("__kompasRestartCapture(").length - 1;
  assert.equal(callers, 1, "only the comment/definition mentions a call");
  const block = src.slice(a, b);
  assert.doesNotMatch(block, /location|reload|navigate|localStorage|sessionStorage|signOut|logout|cookie|fetch\(/);
  const vad = src.slice(src.indexOf("function vadStep("), src.indexOf("function vadStep(") + 200);
  assert.match(vad, /if \(cap\.stopped \|\| !running\) return;\n  try \{ kompasLevelTap\(cap\.who, rms\); \} catch \{\}/);
});
