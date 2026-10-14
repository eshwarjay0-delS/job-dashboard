import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const dir = path.join(root, "public", "kompas")
const read = (relative) => readFileSync(path.join(dir, relative), "utf8")

test("self-hosted Kompas includes every local JavaScript asset referenced by the app", () => {
  const html = read("index.html")
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)]
    .map(match => match[1])
    .filter(src => !/^(https?:)?\/\//i.test(src))
  assert.ok(scripts.length >= 12, "check the complete canonical script graph, not just app.js")
  for (const script of scripts) {
    const local = script.replace(/^\/kompas\//, "").replace(/^\.\//, "")
    assert.ok(!local.startsWith("/") && !local.includes(".."), "script must remain inside Kompas")
    assert.ok(existsSync(path.join(dir, local)), `Missing Kompas asset: ${local}`)
  }
})

test("the migration page has executable export/import controllers on MarketFit", () => {
  const html = read("move.html")
  const assets = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["']/gi)].map(m => m[1])
  assert.ok(assets.includes("move-core.js"))
  assert.ok(assets.includes("move.js"))
  assert.ok(assets.indexOf("move-core.js") < assets.indexOf("move.js"))
  for (const asset of assets) assert.ok(existsSync(path.join(dir, asset)), `Missing move controller: ${asset}`)
  const mover = read("move.js")
  assert.match(mover, /async function exportAll\(/)
  assert.match(mover, /async function importAll\(/)
  assert.match(mover, /readDatabases\(/)
  assert.match(mover, /kompas-here-before-/)
  assert.doesNotMatch(mover, /fetch\(|XMLHttpRequest|sendBeacon|WebSocket/, "Raw browser transfer must not silently transmit records")
})

test("full browser migration preserves IndexedDB evidence and does not clobber local sessions", async () => {
  await import(path.join(dir, "move-core.js"))
  const M = globalThis.KompasMove
  assert.ok(M)
  assert.deepEqual(Object.keys(M.SCHEMA).sort(), ["perfact-dossier", "perfact-files"])
  assert.deepEqual(M.SCHEMA["perfact-dossier"].stores, ["d", "levels"])
  const previous = JSON.stringify([{ id: "current", qa: [{ q: "hello", a: "kept" }] }])
  const incoming = JSON.stringify([{ id: "current", qa: [{ q: "hello", a: "older" }] }, { id: "older", qa: [] }])
  const plan = M.plan({ localStorage: { "perfact.sessions": incoming } }, { "perfact.sessions": previous })
  assert.equal(plan.merged, 1)
  const merged = JSON.parse(plan.write[0].value)
  assert.equal(merged[0].qa[0].a, "kept")
  assert.equal(merged[1].id, "older")
  assert.equal(M.wanted("perfact.connectApp"), false, "Do not import stale desktop/browser selection")
})

test("raw migration and blended knowledge migration remain separate and discoverable", () => {
  const available = new Set(readdirSync(dir))
  assert.ok(available.has("move.js"))
  assert.ok(available.has("move-core.js"))
  const route = readFileSync(path.join(root, "src", "app", "dashboard", "kompas", "move", "page.tsx"), "utf8")
  assert.match(route, /\/api\/kompas\/blend\/export/)
  assert.match(route, /\/api\/kompas\/blend\/import/)
  const source = readFileSync(path.join(root, "src", "lib", "kompas-shell.ts"), "utf8")
  assert.match(source, /\/api\/kompas\/answer/)
  assert.match(source, /\/api\/kompas\/speech/)
})
