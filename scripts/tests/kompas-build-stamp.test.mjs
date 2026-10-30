// Build stamp (30 Oct 2026, OFFLINE): /version.json, /kompas/version.json and the Kompas sidebar label must name the
// exact commit and build time, generated at build time, never a hand-edited label. Fails if any part regresses.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, writeFileSync, mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { pathToFileURL } from "node:url"
import { resolveCommit, stampJson, stampVersion, STAMP_FILES } from "../stamp-version.mjs"

const read = (p) => readFileSync(new URL("../../" + p, import.meta.url), "utf8")
const SHA = "3afa2101234567890abcdef1234567890abcdef0"

test("the build stamps both version files the site serves", () => {
  const names = STAMP_FILES.map((u) => u.pathname.replace(/^.*\/public\//, "public/")).sort()
  assert.deepEqual(names, ["public/kompas/version.json", "public/version.json"])
  assert.match(JSON.parse(read("package.json")).scripts.build, /^node scripts\/stamp-version\.mjs && next build$/)
})

test("commit comes from Vercel; local git only when asked; junk is refused", () => {
  assert.equal(resolveCommit({ VERCEL_GIT_COMMIT_SHA: SHA }, () => "ffffffff"), SHA)
  assert.equal(resolveCommit({}, () => SHA), "")
  assert.equal(resolveCommit({ KOMPAS_STAMP_LOCAL: "1" }, () => SHA), SHA)
  assert.equal(resolveCommit({ VERCEL_GIT_COMMIT_SHA: "not a sha; rm -rf" }, () => ""), "")
})

test("stamp keeps the build key and the smoke-script keys: build, commit (7 chars), builtAt", () => {
  const out = JSON.parse(stampJson('{"build": "kompas-20261030-screen"}', SHA, "2026-10-30T14:00:00.000Z"))
  assert.deepEqual(out, { build: "kompas-20261030-screen", commit: "3afa210", builtAt: "2026-10-30T14:00:00.000Z" })
  const again = JSON.parse(stampJson(JSON.stringify(out), "8c8175c000", "2026-10-31T01:02:03.000Z"))
  assert.equal(again.commit, "8c8175c"); assert.equal(again.build, "kompas-20261030-screen")
})

test("stampVersion writes every file with the same commit and time, and leaves files alone without a sha", () => {
  const dir = mkdtempSync(join(tmpdir(), "stamp-"))
  const files = ["a.json", "b.json"].map((f) => { const p = join(dir, f); writeFileSync(p, '{"build":"x"}\n'); return pathToFileURL(p) })
  assert.equal(stampVersion({ env: {}, files, log: () => {} }), null)
  for (const f of files) assert.equal(readFileSync(f, "utf8"), '{"build":"x"}\n')
  const r = stampVersion({ env: { VERCEL_GIT_COMMIT_SHA: SHA }, now: new Date("2026-10-30T14:00:00Z"), files, log: () => {} })
  assert.deepEqual(r, { commit: "3afa210", builtAt: "2026-10-30T14:00:00.000Z" })
  for (const f of files) assert.deepEqual(JSON.parse(readFileSync(f, "utf8")), { build: "x", commit: "3afa210", builtAt: "2026-10-30T14:00:00.000Z" })
})

test("the capabilities label is the deployed commit, not a hand-edited date", () => {
  const src = read("src/app/api/kompas/capabilities/route.ts")
  assert.match(src, /process\.env\.VERCEL_GIT_COMMIT_SHA/)
  assert.match(src, /version: COMMIT \|\| "local"/)
  assert.doesNotMatch(src, /version: "\d{4}-\d{2}-\d{2}/)
})

test("the sidebar label reads the commit and build time from the page's own version.json", () => {
  const app = read("public/kompas/app.js")
  const fn = app.slice(app.indexOf("async function showReleaseStamp()"), app.indexOf("showReleaseStamp();"))
  assert.ok(fn.length > 0, "showReleaseStamp exists and is called")
  assert.match(fn, /fetch\("version\.json\?t=" \+ Date\.now\(\), \{ cache: "no-store" \}\)/)
  assert.match(fn, /"Release " \+ v\.commit/)
  assert.match(fn, /v\.builtAt/)
})

test("the update check still compares only the build key, so a new commit alone never shows the reload pill", () => {
  const app = read("public/kompas/app.js")
  assert.match(app, /if \(!v \|\| !v\.build \|\| v\.build === BUILD\) return;/)
  const html = read("public/kompas/index.html")
  assert.equal(JSON.parse(read("public/kompas/version.json")).build, html.match(/window\.PERFACT_BUILD = "([^"]+)"/)[1])
})
