// Fix 7: honest scoring.
import test from "node:test"
import assert from "node:assert/strict"
const { renameDims, honestTotal, HEADLINE_KEYS, DEMOTED, parseJudge } = await import("../../src/lib/kompasHonestScore.ts")
test("grounded is reported as ledgerConsistent", () => {
  const d = renameDims({ grounded: 99, antiAI: 97 })
  assert.equal(d.ledgerConsistent, 99); assert.equal("grounded" in d, false)
})
test("demoted delivery dimensions are not in the headline", () => {
  for (const k of DEMOTED) assert.equal(HEADLINE_KEYS.includes(k), false, k)
})
test("a hard failure caps the total no matter how polished", () => {
  const dims = { partCoverage: 100, ledgerConsistent: 100, technicalCoherence: 100, reasoning: 100, maturity: 100, antiAI: 100, pitch: 100 }
  assert.ok(honestTotal(dims, false).total > 90)
  assert.equal(honestTotal(dims, true).total, 49)
})
test("judge verdict parsing clamps and keeps the three scores separate", () => {
  const v = parseJudge('ok {"parts":[{"part":"who signs","covered":false}],"factuality":140,"partCoverage":50,"delivery":80,"hire":"No","problems":["x"]}')
  assert.equal(v.factuality, 100); assert.equal(v.partCoverage, 50); assert.equal(v.hire, "no"); assert.equal(v.parts[0].covered, false)
})
