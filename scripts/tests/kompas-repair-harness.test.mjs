// Recorded-output harness for the round-6 repair-loop checks (29 Oct 2026). OFFLINE, recorded model outputs: proves the
// loop's rules, NOT live answer quality. Each rule also has a "without the fix" proof: a naive loop that breaks the rule
// is run through the same judge and must FAIL, so a passing test here is not a test that cannot fail.
import { test } from "node:test"
import assert from "node:assert/strict"
import { CASES, runCase, runAll, judge, recorded, checksFor } from "../kompas-repair-harness.mjs"
import { runRepairLoop, MAX_REPAIR_ATTEMPTS } from "../../src/lib/kompasRepair.ts"

const byId = (id) => CASES.find((c) => c.id === id)

for (const c of CASES) {
  test(`recorded case ${c.id} [${c.check}] passes`, async () => {
    const r = await runCase(c)
    assert.deepEqual(judge(c, r), [], JSON.stringify(r.repair))
  })
}

test("the recorded set covers every failure shape asked for", () => {
  const checks = new Set(CASES.map((c) => c.check))
  for (const k of ["echo", "voice", "echo+voice", "voice+provider", "none"]) assert.ok(checks.has(k), k)
  assert.ok(CASES.some((c) => c.draft.startsWith("I track") && /Jordan/.test(c.draft)), "mixed person")
  assert.ok(CASES.some((c) => c.rewrites.includes("THROW")), "network failure")
})

test("at most 2 model calls, even when the model keeps failing", async () => {
  assert.equal(MAX_REPAIR_ATTEMPTS, 2)
  const r = await runCase(byId("never-a-third-call"))
  assert.equal(r.calls.length, 2)
  // The third recorded output would have fixed it; the loop must not reach it.
  assert.equal(r.repair.status, "discarded")
})

test("the second attempt rewrites the best answer so far and names only what it still misses", async () => {
  const c = byId("echo-fixed-on-second-try")
  const r = await runCase(c)
  assert.equal(r.calls.length, 2)
  assert.deepEqual(r.calls[1].missing, r.calls[0].missing)
})

test("the original is kept when no rewrite is better (never a worse answer, never blank)", async () => {
  for (const id of ["echo-copied-twice-original-kept", "echo-rewrite-swaps-to-third-person-rejected", "provider-error-both-tries-original-kept", "third-person-still-third-person-kept-original", "network-failure-first-call"]) {
    const c = byId(id)
    const r = await runCase(c)
    assert.equal(r.text, c.draft, id)
    assert.equal(r.repaired, 0, id)
  }
})

test("pass/fail is shown clearly: every case gets PASS or a plain reason", async () => {
  const rows = await runAll()
  assert.equal(rows.length, CASES.length)
  assert.ok(rows.every((r) => Array.isArray(r.fails) && r.fails.length === 0), JSON.stringify(rows.filter((r) => r.fails.length)))
  const broken = await runAll(() => async () => "Jordan says it depends.")
  assert.ok(broken.some((r) => r.fails.some((f) => /^status .*, expected /.test(f))))
})

// ---- without-the-fix proofs: naive loops the judge must reject
async function naiveLoop(c, { maxCalls = 3, keepAny = false, skipProviderCheck = false } = {}) {
  const calls = []
  let text = c.draft
  const checks = checksFor(c.question)
  if (!checks(text).all.length) return { text, repaired: 0, repair: { status: "not-needed", attempts: 0, missing: [], stillMissing: [] }, calls }
  for (let i = 0; i < maxCalls && checks(text).all.length; i++) {
    calls.push({ attempt: i, missing: checks(text).all })
    let out
    try { out = await recorded(c)(text, [], i) } catch { break }
    if (!out?.trim()) continue
    if (keepAny || skipProviderCheck || checks(out).all.length < checks(text).all.length) text = out
  }
  return { text, repaired: text === c.draft ? 0 : 1, repair: { status: text === c.draft ? "discarded" : "landed", attempts: calls.length, missing: [], stillMissing: [] }, calls }
}
test("without the fix: a loop allowed a third call is caught", async () => {
  const c = byId("never-a-third-call")
  assert.notDeepEqual(judge(c, await naiveLoop(c, { maxCalls: 3 })), [])
})
test("without the fix: a loop that keeps any rewrite is caught", async () => {
  const c = byId("echo-rewrite-swaps-to-third-person-rejected")
  assert.notDeepEqual(judge(c, await naiveLoop(c, { maxCalls: 2, keepAny: true })), [])
})
test("without the fix: a loop that keeps provider-error text is caught", async () => {
  const c = byId("provider-error-both-tries-original-kept")
  assert.notDeepEqual(judge(c, await naiveLoop(c, { maxCalls: 2, skipProviderCheck: true })), [])
})
test("without the fix: with no echo/voice checks, the copied and third-person drafts are never repaired", async () => {
  for (const id of ["echo-new-opener-fixed-first-try", "third-person-draft-fixed", "mixed-person-fixed"]) {
    const c = byId(id)
    const r = await runRepairLoop(c.draft, { checks: () => ({ core: [], all: [] }), rewrite: recorded(c), hasKey: true })
    const r2 = { ...r, calls: [] }
    assert.notDeepEqual(judge(c, r2), [], id)
  }
})
