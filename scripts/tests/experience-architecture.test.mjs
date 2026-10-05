import { readFile } from "node:fs/promises"
import assert from "node:assert/strict"
import { test } from "node:test"

const provider = await readFile(
  new URL("../../src/experience/experience-provider.tsx", import.meta.url),
  "utf8",
)
const progressive = await readFile(
  new URL("../../src/experience/progressive-visual.tsx", import.meta.url),
  "utf8",
)
const globals = await readFile(
  new URL("../../src/app/globals.css", import.meta.url),
  "utf8",
)

test("experience runtime respects user and device constraints", () => {
  assert.match(provider, /prefers-reduced-motion/)
  assert.match(provider, /saveData/)
  assert.match(provider, /deviceMemory/)
  assert.match(provider, /hardwareConcurrency/)
  assert.match(provider, /visibilitychange/)
  assert.match(provider, /webgl2/i)
})

test("heavy visuals are progressive rather than critical-path", () => {
  assert.match(progressive, /IntersectionObserver/)
  assert.match(progressive, /requestIdleCallback/)
  assert.match(progressive, /fallback/)
  assert.match(progressive, /canRenderRichMedia/)
})

test("global CSS contains a reduced-motion fallback", () => {
  assert.match(globals, /prefers-reduced-motion:\s*reduce/)
})
