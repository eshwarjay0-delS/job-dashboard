// slice 11 (30 Oct 2026): "Are you available next week?" is the candidate's availability (owner list) and was answered.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { personalLogistics } from "../../src/lib/kompasRelevance.ts"
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const a = app.indexOf("// personal-logistics parity: start"), b = app.indexOf("// personal-logistics parity: end")
const ctx = {}; vm.createContext(ctx); vm.runInContext(app.slice(a, b) + "\nthis.p = personalLogistics;", ctx)
const SKIP = ["Are you available next week?", "Are you available to interview Monday?", "Are you available immediately?", "Are you currently available?"]
const KEEP = ["How do you design for high availability?", "How did you keep the Vault available during failover?", "Is the PSM server available in both zones?", "Tell me about yourself."]
test("candidate availability is skipped on server and page", () => {
  for (const q of SKIP) { assert.equal(personalLogistics(q), true, q); assert.equal(ctx.p(q), true, "page: " + q) }
})
test("technical availability still answered", () => {
  for (const q of KEEP) { assert.equal(personalLogistics(q), false, q); assert.equal(ctx.p(q), false, "page: " + q) }
})
