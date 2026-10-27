// Touch reveal gate (27 Oct 2026): a touch drag reveals the question only
// when it starts at the top — a drag that arrives at the top mid-stroke
// never reveals, however far it pulls past it, so scrolling up to read
// cannot pop the question back. The wheel rule is unchanged (wheel-up at
// the very top reveals at once; the arriving wheel event itself cannot,
// it sees the pane above the top) and stays pinned by
// kompas-question-focus.test.mjs. The old eager touch line (any pull past
// 24px from anywhere) is gone — these tests fail if it comes back.
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

const ctx = {};
vm.createContext(ctx);
vm.runInContext(
  extract("function touchReveal", "// Touch reveal wiring ends here.") +
    "\nthis.touchReveal = touchReveal;",
  ctx,
);

test("touch reveal: only when the drag starts at the top", () => {
  assert.equal(ctx.touchReveal(0, 0, 25), true);
  assert.equal(ctx.touchReveal(0, 0, 100), true);
  assert.equal(ctx.touchReveal(0, 0, 24), false);
  assert.equal(ctx.touchReveal(5, 0, 100), false);
  assert.equal(ctx.touchReveal(0, 5, 100), false);
  assert.equal(ctx.touchReveal(0, 0, 0), false);
});

test("touch handler uses the gate, and the old eager touch line is gone", () => {
  assert.ok(src.includes("touchReveal(touchStartTop, answerPane.scrollTop, y - touchStartY)"), "touch handler calls the gate");
  assert.ok(src.includes("touchStartTop = answerPane ? answerPane.scrollTop : 0"), "touchstart records the top");
  assert.ok(!src.includes("answerPane.scrollTop <= 0 && y - touchStartY > 24) card.classList.remove"), "old eager touch line is gone");
  assert.ok(src.includes("e.deltaY < 0 && answerPane && answerPane.scrollTop <= 0) card.classList.remove"), "wheel rule untouched");
});
