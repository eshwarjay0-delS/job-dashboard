// A resumed run gets its intro card too (27 Oct 2026): restoreLive restores
// the snapshot, then seedIdentity ensures the intro card, so Prev always has
// somewhere to go instead of sitting on a single card with nowhere to flip.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");

test("a resumed run gets its intro card too", () => {
  const start = src.indexOf("async function restoreLive");
  const end = src.indexOf("async function pauseRun", start);
  const body = src.slice(start, end);
  assert.ok(start >= 0 && end > start, "restoreLive exists");
  assert.ok(body.includes("seedIdentity(current)"), "restoreLive ensures the intro card so Prev has somewhere to go");
});
