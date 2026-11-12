import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
function load(rel) {
  const source = readFileSync(resolve(root, rel), "utf8")
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports } }, { filename: rel })
  return exports
}

const { hasProfilePartContent, resolvePendingDraftPart } = load("src/lib/tailor-gap-fill.ts")
const tailor = readFileSync(resolve(root, "src/lib/tailor.ts"), "utf8")
const allSections = { skills: true, summary: true, headline: true }
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value))

test("summary-only profile repair is accepted and clears a pending profile part", () => {
  assert.equal(hasProfilePartContent({ summary: "A concise, source-backed summary." }, allSections), true)
  assert.equal(resolvePendingDraftPart({
    failed: 1, total: 6, pendingRoles: [], pendingProfile: true,
  }, -1), undefined)
})

test("headline-only profile repair is accepted when headline is requested", () => {
  assert.equal(hasProfilePartContent({ headline: { title: "Security Engineer" } }, allSections), true)
})

test("skills-only profile repair remains accepted when skills are requested", () => {
  assert.equal(hasProfilePartContent({ skills: [{ idx: 4, text: "IAM, SIEM" }] }, allSections), true)
})

test("empty or disabled profile output is not accepted", () => {
  assert.equal(hasProfilePartContent({ summary: "   ", skills: [] }, allSections), false)
  assert.equal(hasProfilePartContent({ summary: "Summary" }, {
    skills: false, summary: false, headline: false,
  }), false)
})

test("profile repair preserves still-pending employer roles", () => {
  assert.deepEqual(plain(resolvePendingDraftPart({
    failed: 2, total: 6, pendingRoles: [2], pendingProfile: true,
  }, -1)), {
    failed: 1, total: 6, pendingRoles: [2], pendingProfile: false,
  })
})

test("experience repair does not clear the pending profile part", () => {
  assert.deepEqual(plain(resolvePendingDraftPart({
    failed: 2, total: 6, pendingRoles: [2], pendingProfile: true,
  }, 2)), {
    failed: 1, total: 6, pendingRoles: [], pendingProfile: true,
  })
})

test("the last pending experience role clears the incomplete state", () => {
  assert.equal(resolvePendingDraftPart({
    failed: 1, total: 6, pendingRoles: [2], pendingProfile: false,
  }, 2), undefined)
})

test("all three profile acceptance paths share the same predicate and both repair paths resolve partial state", () => {
  assert.equal((tailor.match(/hasProfilePartContent\(e, profileSections\)/g) || []).length, 3)
  assert.equal((tailor.match(/resolvePendingDraftPart\(current\.partial, w\.part\.role\)/g) || []).length, 2)
})
