import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual browser functions against synthetic HTTP responses. No
// microphone, recording, user identity, network call or transcript is stored.
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
function between(start, end) {
  const a = app.indexOf(start), b = app.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, "Kompas retry implementation must be present");
  return app.slice(a, b);
}
const implementation = between("function speechRetryDelay(", "// Gap B3");
function response(status, retryAfter = null, text = "") {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => retryAfter },
    json: async () => ({ text }),
  };
}
function harness(responses, { final = true, onWait } = {}) {
  const log = { requests: [], waits: [], lines: [], states: [] };
  const ctx = {
    Date, Promise, AbortController,
    transcriptionEpoch: 1, transcriptionOrder: Promise.resolve(),
    transcriptionFailedEpoch: -1, interimOffUntil: 0,
    current: { language: "en" }, running: true,
    performance: { now: () => 1000 },
    whisperPrompt: () => "SIEM, CyberArk",
    cleanTranscript: (x) => String(x || "").trim(),
    dictationRetry: () => false,
    priorOrTimeout: async () => {},
    onTranscript: (...args) => log.lines.push(args),
    showCaption: () => {},
    status: (...args) => log.states.push(args),
    setTimeout(fn, ms) {
      if (ms !== 18000) {
        log.waits.push(ms);
        queueMicrotask(() => { onWait?.(ctx, ms); fn(); });
      }
      return 1;
    },
    clearTimeout() {},
    async fetch(url, options) {
      log.requests.push({ url, body: options.body, headers: options.headers });
      const next = responses.shift();
      if (next instanceof Error) throw next;
      assert.ok(next, "unexpected extra request");
      return next;
    },
  };
  vm.runInNewContext(implementation + "\nthis.transcribe = transcribe; this.speechRetryDelay = speechRetryDelay;", ctx);
  const blob = { type: "audio/webm", size: 12345 };
  return { ctx, log, blob, run: () => ctx.transcribe(blob, "Them", { final, epoch: 1, spokenAt: 123 }) };
}

test("retry policy respects 429/503 delta-seconds, HTTP dates and permanent errors", () => {
  const { ctx } = harness([]);
  const now = Date.UTC(2026, 10, 1, 19, 0, 0);
  const cases = [
    [429, "0", 0, true, 500],
    [429, "0.75", 0, true, 750],
    [429, "3", 0, true, 3000],
    [429, "30", 0, true, 30000],
    [429, "60", 0, true, 60000],
    [429, "61", 0, true, null],
    [429, "120", 0, true, null],
    [429, "garbled", 0, true, 1000],
    [429, null, 0, true, 1000],
    [429, new Date(now + 8000).toUTCString(), 0, true, 8000],
    [429, new Date(now - 8000).toUTCString(), 0, true, 500],
    [503, "4", 0, true, 4000],
    [503, null, 0, true, 500],
    [500, null, 0, true, 500],
    [502, null, 0, true, 500],
    [400, "3", 0, true, null],
    [401, "3", 0, true, null],
    [403, "3", 0, true, null],
    [422, "3", 0, true, null],
    [429, "3", 1, true, null],
    [429, "3", 0, false, null],
    [503, "3", 0, false, null],
  ];
  for (const [status, header, attempt, final, expected] of cases) {
    assert.equal(ctx.speechRetryDelay(status, header, attempt, final, now), expected,
      JSON.stringify({ status, header, attempt, final }));
  }
});

test("a 30-second 429 cooldown reuses exact audio and commits one interviewer line", async () => {
  const h = harness([response(429, "30"), response(200, null, "How does SIEM work?")]);
  assert.equal(await h.run(), undefined);
  assert.deepEqual(h.log.waits, [30000]);
  assert.equal(h.log.requests.length, 2);
  assert.strictEqual(h.log.requests[0].body, h.blob);
  assert.strictEqual(h.log.requests[1].body, h.blob);
  assert.deepEqual(h.log.lines[0], ["Them", "How does SIEM work?", false, 123]);
  assert.equal(h.log.lines.length, 1);
  assert.equal(h.ctx.transcriptionFailedEpoch, -1);
});

test("503 Retry-After is respected, not retried early", async () => {
  const h = harness([response(503, "5"), response(200, null, "Explain CyberArk")]);
  await h.run();
  assert.deepEqual(h.log.waits, [5000]);
  assert.equal(h.log.lines.length, 1);
});

test("ordinary 500 gets one bounded retry with identical audio", async () => {
  const h = harness([response(500), response(200, null, "What is OAuth?")]);
  await h.run();
  assert.deepEqual(h.log.waits, [500]);
  assert.equal(h.log.requests.length, 2);
  assert.strictEqual(h.log.requests[0].body, h.log.requests[1].body);
});

test("a cooldown longer than one minute is surfaced without an early retry", async () => {
  const h = harness([response(429, "120")]);
  assert.equal(await h.run(), false);
  assert.equal(h.log.requests.length, 1);
  assert.equal(h.log.waits.length, 0);
  assert.equal(h.log.lines.length, 0);
  assert.equal(h.ctx.transcriptionFailedEpoch, 1);
  assert.match(h.log.states.at(-1)[0], /429/);
});

test("interim captions never cause a 429 retry or extra billable upload", async () => {
  const h = harness([response(429, "5")], { final: false });
  await h.run();
  assert.equal(h.log.requests.length, 1);
  assert.equal(h.log.waits.length, 0);
  assert.equal(h.log.lines.length, 0);
});

test("auth and malformed-audio responses never retry", async () => {
  for (const status of [400, 401, 403, 413, 422]) {
    const h = harness([response(status, "3")]);
    await h.run();
    assert.equal(h.log.requests.length, 1, String(status));
    assert.equal(h.log.lines.length, 0, String(status));
  }
});

test("a second 429 ends the bounded retry rather than spinning", async () => {
  const h = harness([response(429, "3"), response(429, "3")]);
  await h.run();
  assert.deepEqual(h.log.waits, [3000]);
  assert.equal(h.log.requests.length, 2);
  assert.equal(h.log.lines.length, 0);
});

test("session switch during cooldown cancels the stale second upload", async () => {
  const h = harness([response(429, "5")], { onWait: (ctx) => { ctx.transcriptionEpoch = 2; } });
  await h.run();
  assert.deepEqual(h.log.waits, [5000]);
  assert.equal(h.log.requests.length, 1);
  assert.equal(h.log.lines.length, 0);
});

test("temporary network failure retries the original blob once", async () => {
  const h = harness([new Error("offline"), response(200, null, "Explain RBAC")]);
  await h.run();
  assert.deepEqual(h.log.waits, [500]);
  assert.equal(h.log.requests.length, 2);
  assert.strictEqual(h.log.requests[0].body, h.log.requests[1].body);
  assert.equal(h.log.lines.length, 1);
});
