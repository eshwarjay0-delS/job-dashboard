// Transcript recovery (26 Oct 2026): a transcript row can exist while its
// text record does not — the entry is saved synchronously on leave, the
// IndexedDB text put is async and can lose a race with a killed window.
// When no text record survives, the raw run log still in this browser
// rebuilds the transcript; only when that log is gone too does the viewer
// say the transcript is no longer stored here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");

function extract(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `extract ${from} … ${to}`);
  return src.slice(a, b);
}

function runWith(storedLog) {
  const ctx = {
    BUILD: "test",
    DossierDB: { get: async () => null },
    localStorage: { getItem: (k) => (k === "perfact.log.sess1" && storedLog ? JSON.stringify(storedLog) : null) },
  };
  vm.createContext(ctx);
  vm.runInContext(
    extract("function transcriptText", "function transcriptName") +
    extract("async function sessionTranscript", "async function viewTranscripts") +
    "\nthis.sessionTranscript = sessionTranscript;",
    ctx
  );
  return ctx;
}

const log = [
  { t: "line", who: "Them", text: "How do you handle a Sev1 at 3am?", at: 1000 },
  { t: "answer", question: "How do you handle a Sev1 at 3am?", derived: "How do you handle a Sev1 at 3am?", text: "Page, contain, then fix.", at: 2000 },
];
const session = { id: "sess1", role: "SOC Analyst", company: "TestCo", transcripts: [{ key: "sess1:tx:1000", at: 1000 }] };

test("a missing text record rebuilds from the raw log still in this browser", async () => {
  const ctx = runWith(log);
  const t = await ctx.sessionTranscript(session);
  assert.ok(t, "transcript recovered, not null");
  assert.match(t.text, /How do you handle a Sev1 at 3am\?/);
  assert.match(t.text, /Page, contain, then fix\./);
});

test("no text record and no log still reports the transcript as gone", async () => {
  const ctx = runWith(null);
  const t = await ctx.sessionTranscript(session);
  assert.equal(t, null);
});

test("the viewer keeps its stored-here message for the truly gone case", () => {
  assert.ok(src.includes("This transcript is no longer stored in this browser."));
});
