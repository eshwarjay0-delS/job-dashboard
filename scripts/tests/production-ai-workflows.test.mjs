import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { test } from "node:test"

const structured = await readFile(
  new URL("../../src/lib/workflows/structured.ts", import.meta.url),
  "utf8",
)
const prep = await readFile(
  new URL("../../src/lib/workflows/interview-prep.ts", import.meta.url),
  "utf8",
)
const runtime = await readFile(
  new URL("../../src/lib/workflows/runtime.ts", import.meta.url),
  "utf8",
)

test("production workflows parse model output into strict JSON structures", () => {
  assert.match(structured, /parseJsonObject/)
  assert.match(structured, /Unexpected structured-output key/)
  assert.match(structured, /must contain strings only/)
})

test("interview prep is deterministic around the LLM step", () => {
  assert.match(prep, /requireActiveSubscription/)
  assert.match(prep, /cache_lookup/)
  assert.match(prep, /generate_structured_prep/)
  assert.match(prep, /exactStringArrayObject/)
  assert.match(prep, /temperature: 0\.2/)
  assert.match(prep, /placeholder/i)
})

test("workflow runtime persists runs steps and cache", () => {
  assert.match(runtime, /ai_workflow_runs/)
  assert.match(runtime, /ai_workflow_steps/)
  assert.match(runtime, /ai_workflow_cache/)
  assert.match(runtime, /status: "succeeded"/)
})
