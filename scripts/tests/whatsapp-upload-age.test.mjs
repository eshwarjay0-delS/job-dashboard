// 30 Oct 2026 10:40 AM CT: a stale WhatsApp upload was paired with a new job post (resumeAt written, never read).
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, existsSync } from "node:fs"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const src = rel => readFileSync(resolve(root, rel), "utf8").replace(/\r\n/g, "\n")
const MOD = "src/lib/whatsapp-upload-age.ts"
function load(env = {}) {
  const compiled = ts.transpileModule(src(MOD), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, module: { exports }, require, process: { env } }, { filename: MOD })
  return exports
}
const now = 1_793_374_800_000
const min = 60_000

test("bug: an upload hours old is stale; one sent with the job post is not (default 30 min)", () => {
  assert.ok(existsSync(resolve(root, MOD)))
  const m = load()
  assert.equal(m.uploadStale(now - 3 * 60 * min, now, {}), true)
  assert.equal(m.uploadStale(now - 31 * min, now, {}), true)
  assert.equal(m.uploadStale(now - 5_000, now, {}), false)
  assert.equal(m.uploadStale(now - 29 * min, now, {}), false)
  assert.equal(m.uploadStale(undefined, now, {}), false)
})

test("WHATSAPP_UPLOAD_MAX_AGE: 0/off turns it off, a number sets minutes", () => {
  for (const v of ["0", "off", "false", "no"]) assert.equal(load().uploadStale(now - 999 * min, now, { WHATSAPP_UPLOAD_MAX_AGE: v }), false)
  assert.equal(load().uploadStale(now - 11 * min, now, { WHATSAPP_UPLOAD_MAX_AGE: "10" }), true)
  assert.equal(load().uploadStale(now - 9 * min, now, { WHATSAPP_UPLOAD_MAX_AGE: "10" }), false)
  assert.equal(load().uploadStale(now - 31 * min, now, { WHATSAPP_UPLOAD_MAX_AGE: "junk" }), true)
})

test("bug: the route drops a stale upload before pairing, names the file, and logs the run source", () => {
  const r = src("src/app/api/whatsapp/webhook/route.ts")
  const drop = r.indexOf("if (session.resumePath && uploadStale(session.resumeAt))")
  const use = r.indexOf("if (session.resumePath) return generate(from, session, userId)")
  assert.ok(drop > 0 && use > drop, "stale check runs before the upload is used")
  assert.match(r, /Updating \$\{session\.resumeName \? `\*\$\{session\.resumeName\}\*` : "your resume"\}/)
  assert.ok(r.includes('console.info("[whatsapp] run source", { via: files ? "library" : "upload"'))
})
