// Slice 12: in call mode Auto waited for EVERY capture to go quiet, so the candidate's own mic (talking, or a steady
// room level) held back the answer to the interviewer's question. Only the question source's voice holds Auto.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
test("Auto waits for the question source to finish, not for the candidate's mic", () => {
  const fire = src.slice(src.indexOf("function scheduleAuto()"), src.indexOf("function noteTurnGate()"));
  assert.match(fire, /captures\.some\(c => c\.voiced && c\.who === questionSource\(\)\)/);
  assert.doesNotMatch(fire, /captures\.some\(c => c\.voiced\) \|\|/);
});
