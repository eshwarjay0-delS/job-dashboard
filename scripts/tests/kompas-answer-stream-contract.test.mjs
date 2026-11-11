// Client wiring for the answer-engine contract in commit 40e44027:
// one-hop derive, title then partial card then done.card, and mid-call format/length/tone/STAR.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8");

function slice(start, end) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `${start} must exist in app.js`);
  return src.slice(a, b);
}
const code = [
  slice("// ── Answer stream contract", "// ── end answer stream contract ──"),
  slice("function questionFields(", "function askingLevel("),
].join("\n");

function load() {
  const s = { BUILD: "test", current: { length: undefined, tone: undefined, format: undefined, star: undefined } };
  vm.createContext(s);
  vm.runInContext(code + "\nthis.normalizeAnswerFormat=normalizeAnswerFormat;this.normalizeAnswerTone=normalizeAnswerTone;this.sessionAnswerControls=sessionAnswerControls;this.wantsInlineAnswerDerive=wantsInlineAnswerDerive;this.isPlaceholderTitle=isPlaceholderTitle;this.formatCardAnswer=formatCardAnswer;this.applyAnswerStreamEvent=applyAnswerStreamEvent;this.questionFields=questionFields;this.answerRequestBody=answerRequestBody;", s);
  return s;
}
const plain = (o) => JSON.parse(JSON.stringify(o));


test("controls: Script + bullets, balanced, Simple, STAR off are the defaults", () => {
  const s = load();
  assert.deepEqual(plain(s.sessionAnswerControls({})), { format: "script_bullets", length: "balanced", tone: "simple", star: false });
  assert.deepEqual(plain(s.sessionAnswerControls(undefined)), { format: "script_bullets", length: "balanced", tone: "simple", star: false });
  assert.equal(s.normalizeAnswerTone("professional"), "professional");
  assert.equal(s.normalizeAnswerTone("formal"), "formal");
  assert.equal(s.normalizeAnswerTone("conversational"), "simple");
  assert.equal(s.normalizeAnswerTone("confident"), "simple");
  assert.equal(s.normalizeAnswerFormat("Script + bullets"), "script_bullets");
  assert.equal(s.normalizeAnswerFormat("full script"), "full_script");
  assert.equal(s.normalizeAnswerFormat("Bullet points"), "bullets");
  const mid = s.sessionAnswerControls({ format: "bullet points", length: "Short", tone: "formal", star: "on" });
  assert.deepEqual(plain(mid), { format: "bullets", length: "short", tone: "formal", star: true });
});

test("one hop: derive: true is sent instead of a separate deriveOnly request, and not when the question is pinned", () => {
  const s = load();
  assert.equal(s.wantsInlineAnswerDerive({ consolidated: true }, ""), true);
  assert.equal(s.wantsInlineAnswerDerive({ consolidated: true }, "How do you rate limit?"), false);
  assert.equal(s.wantsInlineAnswerDerive({ consolidated: true, pinned: true }, ""), false);
  assert.equal(s.wantsInlineAnswerDerive({ consolidated: false }, ""), false);

  const inline = s.answerRequestBody("Them: How do you rate limit by IP?", {}, { consolidated: true, earlier: "earlier" }, "", "", { transcript: "earlier" });
  assert.equal(inline.derive, true);
  assert.equal(inline.stream, true);
  assert.equal(inline.consolidated, true);
  assert.equal(inline.pinned, false);
  assert.equal(inline.question, "Them: How do you rate limit by IP?");
  assert.equal(inline.derived, undefined);

  const pinned = s.answerRequestBody("heard", {}, { consolidated: true, pinned: true }, "How do you rate limit by IP?", "code", {});
  assert.equal(pinned.derive, undefined);
  assert.equal(pinned.pinned, true);
  assert.equal(pinned.derived, "How do you rate limit by IP?");

  const reqFn = src.slice(src.indexOf("async function generateAnswerRequest"), src.indexOf("/* ---- manual, AI Answer, screen, copy, export, shortcuts ---- */"));
  assert.match(reqFn, /derive: true/);
  assert.match(reqFn, /answerRequestBody\(/);
  assert.doesNotMatch(reqFn, /deriveBody\(/);
  assert.doesNotMatch(reqFn, /deriveOnly: true/);
});

test("title, then partial card (title + opening line), then done.card (title, opening line, 2-4 bullets)", () => {
  const s = load();
  const card = { question: "Deriving the question and answering…", cardLayout: null };
  const title = s.applyAnswerStreamEvent(card, { type: "title", text: "Rate limiting by IP vs API key" });
  assert.equal(title.kind, "title");
  assert.equal(title.title, "Rate limiting by IP vs API key");
  assert.equal(title.text, "");

  const partial = s.applyAnswerStreamEvent(card, { type: "card", partial: true, title: "Rate limiting by IP vs API key", script: "I'd key it on the API key first, because IPs are shared behind NAT.", bullets: [], format: "script_bullets" });
  assert.equal(partial.kind, "card-partial");
  assert.equal(partial.title, "Rate limiting by IP vs API key");
  assert.equal(partial.text, "I'd key it on the API key first, because IPs are shared behind NAT.");
  assert.deepEqual(partial.card.bullets, []);
  card.cardLayout = partial.card;

  const done = s.applyAnswerStreamEvent(card, {
    type: "done",
    card: {
      title: "Rate limiting by IP vs API key",
      script: "I'd key it on the API key first, because IPs are shared behind NAT.",
      bullets: ["A 429 with Retry-After tells clients when to come back.", "Bursts get a token bucket, e.g. 20 per second.", "Anonymous traffic can still fall back to the IP."],
      format: "script_bullets",
    },
  });
  assert.equal(done.kind, "done-card");
  assert.equal(done.title, "Rate limiting by IP vs API key");
  assert.match(done.text, /^I'd key it on the API key first/);
  assert.match(done.text, /^- A 429 with Retry-After/m);
  assert.equal(done.card.bullets.length, 3);
  assert.equal(done.card.partial, false);
});

test("fallback: deltas still form the answer when the server sends no title or card events", () => {
  const s = load();
  const card = { question: "How do you design a cache?", cardLayout: null };
  const delta = s.applyAnswerStreamEvent(card, { type: "delta", text: "I'd put the hot keys in Redis." });
  assert.equal(delta.kind, "delta");
  assert.equal(delta.text, "I'd put the hot keys in Redis.");
  assert.equal(delta.card, null);
  const done = s.applyAnswerStreamEvent(card, { type: "done", degraded: false });
  assert.equal(done.kind, "done");
  assert.equal(done.card, null);
  assert.equal(done.text, "");
});

test("placeholders never become a card title, and noQuestion is surfaced on meta and done", () => {
  const s = load();
  const card = { question: "Preparing…", cardLayout: null };
  assert.equal(s.isPlaceholderTitle("Preparing…"), true);
  assert.equal(s.isPlaceholderTitle("Listening, no new question yet"), true);
  assert.equal(s.isPlaceholderTitle("Deriving the question and answering…"), true);
  assert.equal(s.isPlaceholderTitle("How do you rate limit by IP?"), false);
  const skipped = s.applyAnswerStreamEvent(card, { type: "title", text: "Preparing…" });
  assert.equal(skipped.kind, "");
  const quiet = s.applyAnswerStreamEvent(card, { type: "done", noQuestion: true });
  assert.equal(quiet.noQuestion, true);
});

test("in-session format, length, tone and STAR controls exist and persist on the session", () => {
  assert.match(html, /id="liveFormat"/);
  assert.match(html, /id="liveLength"/);
  assert.match(html, /id="liveTone"/);
  assert.match(html, /id="liveStar"/);
  assert.match(html, /option value="script_bullets" selected>Script \+ bullets/);
  assert.match(html, /option value="simple" selected>Simple/);
  assert.match(html, /option value="off" selected>Off/);
  assert.match(src, /function persistLiveAnswerControls/);
  assert.match(src, /current\.format = k\.format/);
  assert.match(src, /current\.star = k\.star/);
  assert.match(src, /saveSession\(current\)/);
  assert.match(src, /liveFormat", "liveLength", "liveTone", "liveStar"/);
  // every answer request reads the controls from liveConfig / the session
  const reqFn = src.slice(src.indexOf("async function generateAnswerRequest"), src.indexOf("/* ---- manual, AI Answer, screen, copy, export, shortcuts ---- */"));
  assert.match(reqFn, /liveConfig\(\)/);
  assert.match(src, /sessionAnswerControls/);
});

test("earlier branch features stay: merge, outstanding ask, Listening hold, screenshot routing are still in the press path", () => {
  assert.match(src, /Listening, no new question yet/);
  assert.match(src, /mergeAdjacentAsks/);
  assert.match(src, /outstanding/);
  assert.match(src, /frameKind/);
  assert.match(src, /No question on screen/);
  assert.match(src, /function resolveLiveQuestion/);
});
