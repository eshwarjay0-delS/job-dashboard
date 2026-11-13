// Question focus + stall recovery + re-press gate (26 Oct 2026): while
// generating the question shows; scrolling down collapses it away (not a
// fade — the box itself goes, so the response rises to the top) with a slow
// smooth transition; only an overscroll at the very top brings it back, cut
// to 2 lines. A timer-aborted request retries twice instead of stranding a
// "…" card forever, and a heard-only re-press goes through the same derive
// cut and no-question gate as a fresh heard press instead of pinning the
// whole concatenation to the card and answering it.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
const css = readFileSync(new URL("../../public/kompas/styles.css", import.meta.url), "utf8");

function extract(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  assert.ok(a >= 0 && b > a, `extract ${from} … ${to}`);
  return src.slice(a, b);
}

const ctx = {};
vm.createContext(ctx);
vm.runInContext(extract("function nextStallTry", "async function generateAnswerRequest") + "\nthis.nextStallTry = nextStallTry;", ctx);

test("stall retries: first two stalls retry, the third says so plainly", () => {
  assert.equal(ctx.nextStallTry(0), 1);
  assert.equal(ctx.nextStallTry(1), 2);
  assert.equal(ctx.nextStallTry(2), 0);
  assert.equal(ctx.nextStallTry(undefined), 1);
});

test("question box stays tall enough to read, not the old 5-line box", () => {
  const q = css.match(/\.q\{[^}]*\}/)[0];
  assert.ok(q.includes("max-height:4.65em"), "the question box keeps its height");
  assert.ok(!q.includes("max-height:7.75em"), "old 5-line height is gone");
});

test("the question box stays rendered even when an old q-away class is present", () => {
  const rule = css.match(/\.card\.q-away \.q\{[^}]*\}/)[0];
  assert.ok(rule.includes("opacity:1"), "the box stays visible");
  assert.ok(rule.includes("max-height:4.65em"), "the box keeps its height");
  assert.equal(rule.includes("max-height:0"), false);
});

test("collapse and reveal animate slowly and smoothly, not in a snap", () => {
  const q = css.match(/\.q\{[^}]*\}/)[0];
  assert.ok(q.includes("max-height .5s cubic-bezier(.22,1,.36,1)"), "half-second smooth curve on height");
  assert.ok(q.includes("margin-bottom .5s cubic-bezier(.22,1,.36,1)"), "gap animates on the same curve");
});

test("scrolling never hides the question box", () => {
  const sync = src.match(/function syncQuestion\(\) \{[^}]*\}/)[0];
  assert.equal(sync.includes('classList.add("q-away")'), false);
  assert.ok(sync.includes('remove("q-away")'));
  assert.equal((src.match(/classList\.add\("q-away"\)/g) || []).length, 0);
});

test("heard-only re-presses go through the derive cut, never pinned", () => {
  assert.ok(src.includes("derived: heardOnly ? undefined : q, reask: true, pinned: !heardOnly"), "heard-only re-press is unpinned with no derived question");
  assert.ok(src.includes("showPressed(page, heardOnly ? cur.question : q)"), "the new page keeps the old question until the cut lands — the concatenation never shows");
  assert.ok(/derived: heardOnly \? undefined : (?:said|shownSaid), pinned: !heardOnly/.test(src), "fresh heard presses keep the same routing");   // demo-final: slice10b passes the logistics-free typed words (shownSaid)
});

test("timer aborts retry instead of stranding a card on a stale status", () => {
  const aborts = (src.match(/stallRetry\(\);/g) || []).length;
  // One-hop removed the separate derive request; the stream abort path still retries.
  assert.ok(aborts >= 1, `stream abort path retries (got ${aborts})`);
  assert.ok(!src.includes('card.meta = "superseded by the next question"'), "the misleading superseded meta is gone");
  assert.ok(src.includes('status("Answer stalled — press AI Answer to try again.", "live")'), "the give-up says plainly what to do");
});

test("a hung fetch and a hung anchors load fail fast into the retry", () => {
  assert.ok(src.includes("}, 45000)"), "fetch watchdog at 45s, well inside the 2-minute wall");
  assert.ok(src.includes("clearTimeout(fetchTimer)"), "watchdog is cleared on response and in finally");
  assert.ok(src.includes("setTimeout(() => r(null), 15000)"), "anchors load races a 15s timeout and proceeds without them");
});
