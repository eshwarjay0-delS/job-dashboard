// Capture silence warning parity (1 Nov 2026): the microphone warned after 20 s of silence, the shared-audio
// track never did, so a quiet or wrongly shared tab failed silently. The rule is a pure helper so it is tested
// directly; the watchdog call site is wired to it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const m = src.match(/function silenceWarningFor\(cap, now\) \{[\s\S]*?\n\}/);
assert.ok(m, "silenceWarningFor not found in app.js");
const ctx = {};
vm.createContext(ctx);
vm.runInContext(m[0] + "\nthis.silenceWarningFor = silenceWarningFor;", ctx);
const warn = ctx.silenceWarningFor;
const MIC = "Kompas is hearing silence from the microphone. Check the input device in your system sound settings, then keep talking.";
const SYS = "Kompas is hearing silence from the shared audio. Check the shared tab is playing sound and tab audio is shared, then keep playing.";

test("mic and system tracks warn on the same 20 s silence rule", () => {
  assert.equal(warn({ who: "You", zeroWarned: false, lastAudibleAt: 1000 }, 21001), MIC);
  assert.equal(warn({ who: "Them", zeroWarned: false, lastAudibleAt: 1000 }, 21001), SYS);
  assert.equal(warn({ who: "You", zeroWarned: false, lastAudibleAt: 1000 }, 21000), null);
  assert.equal(warn({ who: "Them", zeroWarned: false, lastAudibleAt: 1000 }, 21000), null);
  assert.equal(warn({ who: "You", zeroWarned: true, lastAudibleAt: 1000 }, 99999), null);
  assert.equal(warn({ who: "Them", zeroWarned: true, lastAudibleAt: 1000 }, 99999), null);
  assert.equal(warn({ who: "Them", zeroWarned: false, lastAudibleAt: 0 }, 1), null);
  assert.equal(warn({ who: "Them", zeroWarned: false }, 99999), null);
  assert.equal(warn({ who: "Other", zeroWarned: false, lastAudibleAt: 1000 }, 99999), null);
  assert.equal(warn(null, 99999), null);
});

test("the watchdog call site uses the helper", () => {
  assert.ok(src.includes("silenceWarningFor(cap, now)"), "watchdog must call silenceWarningFor");
  assert.ok(!src.includes('cap.who === "You" && !cap.zeroWarned'), "mic-only watchdog branch must be gone");
});
