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
