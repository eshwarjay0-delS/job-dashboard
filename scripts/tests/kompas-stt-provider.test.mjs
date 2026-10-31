// Parakeet provider switch (29 Oct 2026): off by default, Whisper fallback, no network in these tests.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const P = await import("../../src/lib/kompasSttProvider.ts");
const input = { audio: new Uint8Array(1000), mime: "audio/webm", purpose: "flow" };
const whisper = async () => ({ text: "from whisper", model: "whisper-large-v3" });

test("1. Whisper is the default; the flag alone, or a bad address, keeps Whisper", () => {
  assert.equal(P.sttProvider({}), "whisper");
  assert.equal(P.sttProvider({ KOMPAS_STT_PROVIDER: "parakeet" }), "whisper");
  assert.equal(P.sttProvider({ KOMPAS_STT_PROVIDER: "parakeet", KOMPAS_PARAKEET_URL: "not a url" }), "whisper");
  assert.equal(P.sttProvider({ KOMPAS_STT_PROVIDER: "parakeet", KOMPAS_PARAKEET_URL: "http://127.0.0.1:8000/asr" }), "parakeet");
});

test("2. flag off: Whisper's result is returned unchanged and Parakeet is never called", async () => {
  let called = false;
  const out = await P.transcribeWithFallback(input, { whisper, parakeet: async () => { called = true; return { text: "x" }; } }, {});
  assert.deepEqual(out, { text: "from whisper", model: "whisper-large-v3" });
  assert.equal(called, false);
});

test("3. flag on: Parakeet answers; failsafe: a Parakeet failure falls back to Whisper", async () => {
  const env = { KOMPAS_STT_PROVIDER: "parakeet", KOMPAS_PARAKEET_URL: "http://127.0.0.1:8000/asr" };
  assert.equal((await P.transcribeWithFallback(input, { whisper, parakeet: async () => ({ text: "from parakeet" }) }, env)).text, "from parakeet");
  assert.equal((await P.transcribeWithFallback(input, { whisper, parakeet: async () => { throw new Error("down"); } }, env)).text, "from whisper");
});

test("4. the Parakeet adapter reads text, and refuses empty, failed or unset", async () => {
  const env = { KOMPAS_PARAKEET_URL: "http://127.0.0.1:8000/asr" };
  const ok = async () => ({ ok: true, status: 200, json: async () => ({ text: " What is PKI? " }) });
  const r = await P.parakeetTranscribe(input, env, ok);
  assert.equal(r.text, "What is PKI?");
  assert.equal(r.model, "parakeet");
  await assert.rejects(P.parakeetTranscribe(input, env, async () => ({ ok: true, status: 200, json: async () => ({ text: "" }) })));
  await assert.rejects(P.parakeetTranscribe(input, env, async () => ({ ok: false, status: 503, json: async () => ({}) })));
  await assert.rejects(P.parakeetTranscribe(input, {}, ok));
});

test("5. the speech route goes through the switch", () => {
  const route = readFileSync(new URL("../../src/app/api/kompas/speech/route.ts", import.meta.url), "utf8");
  assert.ok(route.includes("transcribeWithFallback({"));
  assert.ok(route.includes("{ whisper: transcribeAudio, parakeet: parakeetTranscribe }"));
});


const parakeetEnv = { KOMPAS_STT_PROVIDER: "parakeet", KOMPAS_PARAKEET_URL: "http://127.0.0.1:8000/asr" };
const fakeResponse = data => async () => ({ ok: true, status: 200, json: async () => data });

test("6. valid Parakeet transcript retains words, finite duration and language", async () => {
  const out = await P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "  Active Directory  ", seconds: 2.75, language: " en-US " }));
  assert.equal(out.text, "Active Directory");
  assert.equal(out.seconds, 2.75);
  assert.equal(out.language, "en-US");
});

test("7. invalid Parakeet durations cannot corrupt playback timing", async () => {
  for (const seconds of [-1, Infinity, -Infinity, NaN, "3", {}]) {
    const out = await P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "safe", seconds }));
    assert.equal(out.seconds, null);
  }
  assert.equal((await P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "safe", seconds: 0 }))).seconds, 0);
});

test("8. invalid language metadata is discarded without losing a valid transcript", async () => {
  for (const language of ["\u0000en", "en\nUS", "a".repeat(33), 42]) {
    const out = await P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "safe", language }));
    assert.equal(out.text, "safe");
    assert.equal(out.language, null);
  }
});

test("9. runaway Parakeet text is rejected, not displayed as an answer", async () => {
  await assert.rejects(P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "a".repeat(100_001) })), /invalid transcript/);
  assert.equal((await P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "a".repeat(100_000) }))).text.length, 100_000);
});

test("10. NUL-bearing Parakeet text is rejected without logging the transcript", async () => {
  await assert.rejects(P.parakeetTranscribe(input, parakeetEnv, fakeResponse({ text: "secret\u0000text" })), /invalid transcript/);
});

test("11. invalid Parakeet output automatically falls back to existing Whisper", async () => {
  let whisperCalls = 0;
  const result = await P.transcribeWithFallback(input, {
    whisper: async () => { whisperCalls++; return { text: "from whisper" }; },
    parakeet: async clip => P.parakeetTranscribe(clip, parakeetEnv, fakeResponse({ text: "x".repeat(100_001) })),
  }, parakeetEnv);
  assert.equal(result.text, "from whisper");
  assert.equal(whisperCalls, 1);
});

test("12. provider-off mode never invokes the guarded Parakeet adapter", async () => {
  let invoked = 0;
  const result = await P.transcribeWithFallback(input, {
    whisper,
    parakeet: async () => { invoked++; throw Error("should not run"); },
  }, {});
  assert.equal(result.text, "from whisper");
  assert.equal(invoked, 0);
});

test("13. streamed Parakeet JSON preserves technical dictation and timing", async () => {
  const payload = { text: "CyberArk EPM, AS-REP, OAuth 2.0, PKI.", seconds: 1.5, language: "en-US" };
  const result = await P.parakeetTranscribe(input, parakeetEnv, async () => new Response(JSON.stringify(payload), { status: 200 }));
  assert.equal(result.text, payload.text);
  assert.equal(result.seconds, 1.5);
  assert.equal(result.language, "en-US");
});

test("14. oversized streamed JSON is stopped before parsing and Whisper recovers", async () => {
  const oversized = JSON.stringify({ text: "x".repeat(P.MAX_PARAKEET_RESPONSE_BYTES + 1) });
  const fetcher = async () => new Response(oversized, { status: 200 });
  await assert.rejects(P.parakeetTranscribe(input, parakeetEnv, fetcher), /response too large/);
  const result = await P.transcribeWithFallback(input, {
    whisper,
    parakeet: clip => P.parakeetTranscribe(clip, parakeetEnv, fetcher),
  }, parakeetEnv);
  assert.equal(result.text, "from whisper");
});

test("15. exact response byte limit is allowed for otherwise valid JSON", async () => {
  const empty = JSON.stringify({ text: "safe", padding: "" });
  const body = JSON.stringify({ text: "safe", padding: "x".repeat(P.MAX_PARAKEET_RESPONSE_BYTES - Buffer.byteLength(empty)) });
  assert.equal(Buffer.byteLength(body), P.MAX_PARAKEET_RESPONSE_BYTES);
  const result = await P.parakeetTranscribe(input, parakeetEnv, async () => new Response(body, { status: 200 }));
  assert.equal(result.text, "safe");
});

test("16. invalid UTF-8 provider JSON fails closed without leaking a transcript", async () => {
  const invalid = new Uint8Array([123, 34, 116, 101, 120, 116, 34, 58, 34, 255, 34, 125]);
  const fetcher = async () => new Response(invalid, { status: 200 });
  await assert.rejects(P.parakeetTranscribe(input, parakeetEnv, fetcher));
  const result = await P.transcribeWithFallback(input, {
    whisper,
    parakeet: clip => P.parakeetTranscribe(clip, parakeetEnv, fetcher),
  }, parakeetEnv);
  assert.equal(result.text, "from whisper");
});
