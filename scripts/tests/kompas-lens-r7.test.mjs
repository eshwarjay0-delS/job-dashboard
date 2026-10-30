// Lens r7 (29 Oct 2026): full-matrix regression. Red items found by the matrix are pinned here first.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { lensBlock } from "../../src/lib/kompasAudience.ts"
import { contradictions } from "../kompas-lens-prompt-check.mjs"
import { openerPrompt } from "../../src/lib/kompasOpener.ts"
import { runMatrix } from "../kompas-lens-matrix.mjs"

vm.runInThisContext(readFileSync(new URL("../../public/kompas/levels-core.js", import.meta.url), "utf8"))
const K = globalThis.KompasLevels

test("r7 red 1: levels-core shows the same lens the prompt uses for a hiring manager (Director)", () => {
  const L = K.lensFor("hiring_manager")
  assert.ok(lensBlock("hiring_manager", "What is MFA?").startsWith(`LENS ${L.label.split(" / ")[0]}`), L.label)
})

test("r7 red 2 (checker): a multi-sentence opener does not hide the reconciliation sentence from the contradiction checker", () => {
  const op = { text: "Built the alert pipeline. Experienced in Splunk and Sentinel.", leadIn: "", sourceId: "b", sourceDoc: "resume", category: "experience-story", verbatim: true }
  const t = ["Sentence one is the answer.", openerPrompt(op)].join("\n\n")
  assert.deepEqual(contradictions(t).map((c) => c.id), [])
})

test("r7 full matrix, 200 folds: every count on target", { timeout: 300000 }, () => {
  const c = runMatrix(200)
  assert.equal(c.contra, 0); assert.equal(c.lensOk, c.prompts); assert.equal(c.depthOk, c.prompts); assert.equal(c.explainOk, c.explainN)
  assert.equal(c.openerPromptOk, c.openerPromptN); assert.equal(c.levelsOk, c.levelsN)
  assert.equal(c.T1, c.T1n); assert.equal(c.T2v, 0); assert.ok(c.T3 / c.T3n >= 0.95); assert.ok(c.T4 / c.T4n >= 0.9)
  assert.equal(c.T5, c.T5n); assert.equal(c.T5dated, 0); assert.equal(c.T5tic, 0)
  assert.equal(c.opener, c.openerN); assert.equal(c.leadIn, c.leadInN); assert.equal(c.empty, c.emptyN); assert.equal(c.blank, c.blankN); assert.equal(c.notCovered, c.notCoveredN); assert.equal(c.properKept, c.properN)
  assert.ok(c.openerN > 0 && c.T4n > 0 && c.T3n > 0)
})
