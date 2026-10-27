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

test("question box is 2 lines tall, not the old 5-line box", () => {
  const q = css.match(/\.q\{[^}]*\}/)[0];
  assert.ok(q.includes("max-height:3.1em"), "2 lines at 1.55 line-height");
  assert.ok(!q.includes("max-height:7.75em"), "old 5-line height is gone");
});

test("hidden question collapses away (box gone), it does not just fade", () => {
  const rule = css.match(/\.card\.q-away \.q\{[^}]*\}/)[0];
  assert.ok(rule.includes("max-height:0"), "box height collapses to zero");
  assert.ok(rule.includes("margin-bottom:0"), "its gap collapses too");
  assert.ok(rule.includes("overflow:hidden"), "nothing peeks out while collapsed");
});

test("collapse and reveal animate slowly and smoothly, not in a snap", () => {
  const q = css.match(/\.q\{[^}]*\}/)[0];
  assert.ok(q.includes("max-height .5s cubic-bezier(.22,1,.36,1)"), "half-second smooth curve on height");
  assert.ok(q.includes("margin-bottom .5s cubic-bezier(.22,1,.36,1)"), "gap animates on the same curve");
});

test("scrolling to the top alone never reveals the question; only an overscroll does", () => {
  const sync = src.match(/function syncQuestion\(\) \{[^}]*\}/)[0];
  assert.ok(sync.includes('classList.add("q-away")'), "scrolling down hides");
  assert.ok(!sync.includes("toggle"), "no toggle that would reveal on reaching the top");
  assert.ok(!sync.includes('remove("q-away")'), "reaching the top alone never reveals");
  assert.ok(src.includes('e.deltaY < 0 && answerPane && answerPane.scrollTop <= 0) card.classList.remove("q-away")'), "wheel up at the very top reveals");
  assert.ok(src.includes('touchReveal(touchStartTop, answerPane.scrollTop, y - touchStartY)) card.classList.remove("q-away")'), "touch reveal is two-phase: only a drag that starts at the top reveals (27 Oct)");
});

test("a generated answer collapses the question away on both answer paths", () => {
  const hits = src.match(/classList\.add\("q-away"\)/g) || [];
  assert.ok(hits.length >= 5, `hide sites: scroll, wheel, touch, generated, book (got ${hits.length})`);
  assert.ok(!src.includes('first words in'), "no latency readout on the live screen (owner, 27 Oct: only show what he needs)");
});

test("heard-only re-presses go through the derive cut, never pinned", () => {
  assert.ok(src.includes("derived: heardOnly ? undefined : q, reask: true, pinned: !heardOnly"), "heard-only re-press is unpinned with no derived question");
  assert.ok(src.includes("showPressed(cur, heardOnly ? cur.question : q)"), "card keeps its old question until the cut lands — the concatenation never shows");
  assert.ok(src.includes("derived: heardOnly ? undefined : said, pinned: !heardOnly"), "fresh heard presses keep the same routing");
});

test("timer aborts retry instead of stranding a card on a stale status", () => {
  const aborts = (src.match(/stallRetry\(\);/g) || []).length;
  assert.ok(aborts >= 2, `derive and stream abort paths both retry (got ${aborts})`);
  assert.ok(!src.includes('card.meta = "superseded by the next question"'), "the misleading superseded meta is gone");
  assert.ok(src.includes('status("Answer stalled — press AI Answer to try again.", "live")'), "the give-up says plainly what to do");
});

test("a hung fetch and a hung anchors load fail fast into the retry", () => {
  assert.ok(src.includes("}, 45000)"), "fetch watchdog at 45s, well inside the 2-minute wall");
  assert.ok(src.includes("clearTimeout(fetchTimer)"), "watchdog is cleared on response and in finally");
  assert.ok(src.includes("setTimeout(() => r(null), 15000)"), "anchors load races a 15s timeout and proceeds without them");
});
