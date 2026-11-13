// Fix 3: never ship worse.
import test from "node:test"
import assert from "node:assert/strict"
const { decideShip, passesAllHardGates, replacedByWorse, fullRank } = await import("../../src/lib/kompasShipGate.ts")
const P = (rank, extra = {}) => ({ detPass: true, rank, hardCodes: [], interrogation: { pass: true, survives: true }, ...extra })
test("a hard failure overrides a high score", () => {
  assert.equal(passesAllHardGates(P(900, { hardCodes: ["part-missed"] })), false)
  assert.equal(passesAllHardGates(P(900, { interrogation: { pass: false, survives: false } })), false)
  assert.ok(fullRank(P(10)) > fullRank(P(9000, { hardCodes: ["contradiction"] })))
})
test("new replaces the stored best only when it passes every gate and beats it", () => {
  assert.deepEqual(decideShip(P(200), P(100)).ship, "new")
  assert.equal(decideShip(P(50), P(100)).ship, "previous")
  assert.equal(decideShip(P(500, { detPass: false }), P(100)).ship, "previous")
  assert.equal(decideShip(P(500, { hardCodes: ["technical-incoherence"] }), { ...P(10), detPass: false }).ship, "previous")
})
test("the round audit finds replacements by worse answers", () => {
  assert.deepEqual(replacedByWorse([{ id: "x", replaced: true, fresh: P(10), previous: P(20) }, { id: "y", replaced: true, fresh: P(30), previous: P(20) }]), ["x"])
})
test("with interrogation off, deterministic gates decide", () => {
  assert.equal(decideShip({ detPass: true, rank: 5 }, null, { interrogationRequired: false }).replace, true)
})
