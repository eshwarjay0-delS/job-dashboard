// Spelling correction (owner, 2026-10-26): heard terms must come back spelled
// the way his stack spells them, even when recognition splits or garbles them.
// Runs the REAL fixTerms/fixPhrases sliced out of public/kompas/app.js, with
// no resume or JD loaded — so only the always-on ecosystem list counts, which
// is exactly the case that used to leave Zscaler, Venafi and Saviynt uncorrected.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const src = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8");
function slice(from, to) {
  const a = src.indexOf(from);
  const b = to ? src.indexOf(to, a + from.length) : src.indexOf("\n", a);
  assert.ok(a >= 0 && b > a, `slice ${from}`);
  return src.slice(a, to ? b : b + 1);
}
const script = [
  slice("const DOMAIN_TERMS ="),
  slice("const KNOWN_ACRONYMS ="),
  slice("const HEADER_WORDS ="),
  slice("let termCache ="),
  slice("function termVocab()", "function edits1"),
  slice("function edits1", "const PHRASE_FIXES"),
  slice("const PHRASE_FIXES", "\n];") + "\n];",
  slice("function fixPhrases", "function fixTerms"),
  slice("function fixTerms", "function heardDraft"),
].join("\n");

const ctx = { current: {}, cards: [] };
vm.createContext(ctx);
vm.runInContext(script + "\nthis.fixTerms = fixTerms; this.fixPhrases = fixPhrases;", ctx);
const { fixTerms, fixPhrases } = ctx;
const clean = (s) => fixTerms(fixPhrases(s));

test("a split Zscaler comes back as one name", () => {
  assert.equal(clean("the z scaler proxy failed"), "the Zscaler proxy failed");
  assert.equal(clean("the zee scaler policy"), "the Zscaler policy");
  assert.equal(clean("the see scaler policy"), "the Zscaler policy");
});

test("a garbled Zscaler, Venafi or Saviynt comes back spelled right", () => {
  assert.equal(clean("the zscaller policy"), "the Zscaler policy");
  assert.equal(clean("the ven a fi policy"), "the Venafi policy");
  assert.equal(clean("the savient connector"), "the Saviynt connector");
  assert.equal(clean("the sail point discussion"), "the SailPoint discussion");
});

test("existing corrections still hold, and ordinary words pass through", () => {
  assert.equal(clean("the sentinal logs"), "the Sentinel logs");
  assert.equal(clean("let me see the scale of the issue"), "let me see the scale of the issue");
  assert.equal(clean("the crowd strike rollout"), "the CrowdStrike rollout");
});
