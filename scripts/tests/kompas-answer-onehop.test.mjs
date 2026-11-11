// One-hop derive + Script/bullets card events + mid-call format/length/tone/STAR controls.
// Client contract for Chief commit 40e44027 (answer engine on branch loop).
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8");

function slice(start, end) {
  const a = src.indexOf(start);
  const b = src.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `${start} must exist in app.js`);
  return src.slice(a, b);
}

const helpers = slice(
  "// ── Answer stream contract",
  "function askingLevel()",
);

function load(extra = {}) {
  const ctx = {
    BUILD: "test",
    current: extra.current || null,
    liveModel: () => extra.liveModel || "",
    $: extra.$ || ((id) => extra.els && extra.els[id] || null),
    saveSession: extra.saveSession || (() => {}),
    ...extra,
  };
  vm.createContext(ctx);
  vm.runInContext(helpers, ctx);
  return ctx;
}

const requestSrc = slice("async function generateAnswerRequest(", "/* ---- manual, AI Answer, screen, copy, export, shortcuts ---- */");

test("defaults: Script + bullets, balanced length, Simple tone, STAR off", () => {
  const s = load();
  assert.equal(JSON.stringify(s.sessionAnswerControls({})), JSON.stringify({ format: "script_bullets", length: "balanced", tone: "simple", star: false }));
  assert.equal(s.normalizeAnswerTone("conversational"), "simple");
  assert.equal(s.normalizeAnswerTone("confident"), "simple");
  assert.equal(s.normalizeAnswerTone("Formal"), "formal");
  assert.equal(s.normalizeAnswerFormat("Bullet points"), "bullets");
  assert.equal(s.normalizeAnswerFormat("full script"), "full_script");
  assert.equal(JSON.stringify(s.sessionAnswerControls({ format: "bullets", length: "Short", tone: "professional", star: "on" })), JSON.stringify({
    format: "bullets", length: "short", tone: "professional", star: true,
  }));
});

test("one hop: derive: true on the answer request, never a separate deriveOnly hop", () => {
  const s = load();
  const opts = { consolidated: true };
  assert.equal(s.wantsInlineAnswerDerive(opts, ""), true);
  assert.equal(s.wantsInlineAnswerDerive(opts, "How do you rate limit?"), false);
  assert.equal(s.wantsInlineAnswerDerive({ deriveOnly: true, consolidated: true }, ""), false);
  assert.equal(s.wantsInlineAnswerDerive({ consolidated: true, pinned: true }, ""), false, "pinned without a title stays pinned; the server would ignore derive");
  const body = s.answerRequestBody("Them: How do you rate limit?", {}, opts, "", "");
  assert.equal(body.derive, true);
  assert.equal(body.pinned, false);
  assert.equal(body.consolidated, true);
  assert.equal(body.stream, true);
  const pinned = s.answerRequestBody("q", {}, { consolidated: true, pinned: true, derived: "How do you rate limit?" }, "How do you rate limit?", "kept");
  assert.equal(pinned.derive, undefined);
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.derived, "How do you rate limit?");
  // The live path no longer fires deriveBody / deriveOnly before /api/answer.
  assert.doesNotMatch(requestSrc, /deriveBody\(/);
  assert.doesNotMatch(requestSrc, /deriveOnly:\s*true/);
  assert.match(requestSrc, /answerRequestBody\(/);
  assert.match(src, /\$\{\.\.\.\(inline \? \{ derive: true \} : \{\}\)\}/.source ? /inline \? \{ derive: true \}/ : /derive: true/);
});

test("every answer request carries config.format, length, tone and star from liveConfig", () => {
  assert.match(requestSrc, /config: \{ \.\.\.liveConfig\(\)/);
  assert.match(src, /function liveConfig\(\)/); assert.match(src, /readLiveAnswerControls|sessionAnswerControls\(s\)/);
  assert.match(html, /id="liveFormat"/);
  assert.match(html, /id="liveLength"/);
  assert.match(html, /id="liveTone"/);
  assert.match(html, /id="liveStar"/);
  assert.match(html, /Script \+ bullets/);
  assert.match(html, /<option value="simple" selected>Simple<\/option>/);
  assert.match(html, /STAR structure for the next answer. Off by default/);
  assert.match(src, /el\.onchange = \(\) => persistLiveAnswerControls\(\)/);
  assert.match(css, /\.card-prefs/);
});

test("mid-call control changes persist on the session and apply to the next card", () => {
  const els = {
    liveFormat: { value: "full_script" },
    liveLength: { value: "short" },
    liveTone: { value: "formal" },
    liveStar: { value: "on" },
  };
  const saved = [];
  const current = { id: "s1", length: "balanced", tone: "simple", format: "script_bullets", star: false };
  const s = load({
    current,
    els,
    $: (id) => els[id] || null,
    saveSession: (sess) => saved.push({ ...sess }),
  });
  const k = s.persistLiveAnswerControls();
  assert.equal(JSON.stringify(k), JSON.stringify({ format: "full_script", length: "short", tone: "formal", star: true }));
  assert.equal(current.format, "full_script");
  assert.equal(current.length, "short");
  assert.equal(current.tone, "formal");
  assert.equal(current.star, true);
  assert.equal(saved.length, 1);
  assert.equal(saved[0].star, true);
});

test("stream: title first, then a partial card (opening line), then done.card (script + 2–4 bullets)", () => {
  const s = load();
  const card = { question: "Deriving the question and answering…", req: "ctl" };
  const title = s.applyAnswerStreamEvent(card, { type: "title", text: "Rate limiting by IP vs API key" });
  assert.equal(title.kind, "title");
  assert.equal(title.title, "Rate limiting by IP vs API key");
  assert.equal(title.text, "");
  const partial = s.applyAnswerStreamEvent(card, {
    type: "card", partial: true, title: "Rate limiting by IP vs API key",
    script: "I'd rate limit on the API key first, because IPs are shared behind NAT.",
    bullets: [], format: "script_bullets",
  });
  assert.equal(partial.kind, "card-partial");
  assert.equal(partial.card.partial, true);
  assert.equal(partial.text, "I'd rate limit on the API key first, because IPs are shared behind NAT.");
  assert.deepEqual(partial.card.bullets, []);
  card.cardLayout = partial.card;
  const done = s.applyAnswerStreamEvent(card, {
    type: "done",
    card: {
      title: "Rate limiting by IP vs API key",
      format: "script_bullets",
      script: "I'd rate limit on the API key first, because IPs are shared behind NAT.",
      bullets: ["The IP stays a fallback for anonymous traffic.", "I'd return a 429 with Retry-After so clients back off.", "Bursts get a token bucket."],
    },
  });
  assert.equal(done.kind, "done-card");
  assert.equal(done.card.partial, false);
  assert.equal(done.card.bullets.length, 3);
  assert.match(done.text, /^I'd rate limit on the API key first/);
  assert.match(done.text, /^- The IP stays a fallback/m);
  assert.match(done.text, /token bucket\.$/m);
});

test("fallback: servers that only emit delta/done/text still produce an answer", () => {
  const s = load();
  const card = { question: "How do you rate limit?" };
  const delta = s.applyAnswerStreamEvent(card, { type: "delta", text: "I'd key it on the API key first." });
  assert.equal(delta.kind, "delta");
  assert.equal(delta.text, "I'd key it on the API key first.");
  assert.equal(delta.card, null);
  const done = s.applyAnswerStreamEvent(card, { type: "done", guarded: true });
  assert.equal(done.kind, "done");
  assert.equal(done.card, null);
  assert.equal(done.noQuestion, false);
  assert.equal(s.formatCardAnswer(null), "");
  // Live path still shows deltas when no card layout has arrived, and JSON still reads data.text.
  assert.match(requestSrc, /ev\.type === "delta"/);
  assert.match(requestSrc, /if \(!card\.cardLayout\) show\(text\)/);
  assert.match(requestSrc, /const data = await res\.json\(\); text = data\.text/);
});

test("placeholders never become a card title; noQuestion is surfaced on done", () => {
  const s = load();
  assert.equal(s.isPlaceholderTitle("Deriving the question and answering…"), true);
  assert.equal(s.isPlaceholderTitle("Preparing…"), true);
  assert.equal(s.isPlaceholderTitle("How do you scope an access review?"), false);
  const card = { question: "Preparing…" };
  const skipped = s.applyAnswerStreamEvent(card, { type: "title", text: "Preparing…" });
  assert.equal(skipped.kind, "");
  const none = s.applyAnswerStreamEvent(card, { type: "done", noQuestion: true });
  assert.equal(none.noQuestion, true);
});

test("live request handles book match after meta.derived and does not retry a served book", () => {
  assert.match(requestSrc, /servedBook/);
  assert.match(requestSrc, /if \(servedBook\) return/);
  assert.match(requestSrc, /paintTitle/);
  assert.match(requestSrc, /paintLayout/);
  assert.match(requestSrc, /takeEvent/);
});

test("branch features stay in place: merge, outstanding ask, Listening hold, anchor, screenshot routing", () => {
  assert.match(src, /function mergeAdjacentAsks\(/);
  assert.match(src, /outstanding/);
  assert.match(src, /Listening, no new question yet/);
  assert.match(src, /source: "screen"/);
  assert.match(src, /frameKind/);
  assert.match(src, /function paintFromAnchors\(/);
  assert.match(src, /kompasScreenFrame|frameKind: first\.kind|frameKind: routed\.kind/);
});
