import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"

const app = fs.readFileSync(path.resolve("public/kompas/app.js"), "utf8")
const issue = fs.readFileSync(path.resolve("src/app/api/kompas/desktop-handoff/route.ts"), "utf8")
const redeem = fs.readFileSync(path.resolve("src/app/api/kompas/desktop-handoff/redeem/route.ts"), "utf8")

test("loaded resume and JD are never placed in the Windows launcher URL", () => {
  const code = app.slice(app.indexOf("function packSession(s) {"), app.indexOf("function openHandedSession(s) {"))
  assert.ok(code.includes("function prepareDesktopSession(s)"), "ticket issue route must exist")
  assert.ok(code.includes('fetch("/api/kompas/desktop-handoff"'), "full session must go to same-origin HTTPS route")
  assert.ok(code.includes('window.location.assign(url)'), "short protocol link must use browser navigation")
  assert.ok(code.includes('"marketfit-kompas://open?ticket=" + ticket'), "short protocol ticket only")
  assert.ok(!code.includes('window.location.assign(packSession(s))'), "never launch the old oversized URL")
  const globals = {
    location: { pathname: "/kompas" },
    supabaseAccessToken: () => "a".repeat(600),
    supabaseSession: () => ({ refresh_token: "b".repeat(600), expires_at: 100 }),
    btoa: s => Buffer.from(s, "binary").toString("base64"), unescape, encodeURIComponent,
    Date, fetch() { throw Error("not called") }, window: {}, atob: s => Buffer.from(s, "base64").toString("binary"),
  }
  vm.runInNewContext(code + "\nthis.getPack = packSession;", globals)
  const big = globals.getPack({ id: "saved", role: "Security Engineer", resume: "R".repeat(8000), jd: "J".repeat(6000) })
  assert.ok(big.length > 2046, "reproduce Windows protocol length bug")
  assert.ok(("marketfit-kompas://open?ticket=" + "A".repeat(43)).length < 200)
})

test("only a signed-in user can issue a short-lived ticket", () => {
  assert.match(issue, /authenticatedUser\(request\)/)
  assert.match(issue, /randomBytes\(32\)/)
  assert.match(issue, /createHash\("sha256"\)/)
  assert.match(issue, /Date\.now\(\) \+ 300_000/)
  assert.match(issue, /session\.site !== "marketfit"/)
  assert.ok(!issue.includes("console.log"))
})

test("ticket redeem is atomic, single-use and not client-readable", () => {
  assert.match(redeem, /claim_kompas_desktop_handoff/)
  assert.match(redeem, /createServiceClient/)
  assert.match(redeem, /status: 410/)
  assert.match(redeem, /Cache-Control.*no-store/)
})


test("legacy structured interview instructions survive the desktop handoff without truncation", () => {
  const start = issue.indexOf("function instructionText(value: unknown): string | null {")
  const end = issue.indexOf("// Browser-local session details", start)
  assert.ok(start >= 0 && end > start, "the issue route must normalize saved instruction variants")
  const src = issue.slice(start, end).replace(
    "function instructionText(value: unknown): string | null {",
    "function instructionText(value) {",
  )
  const ctx = vm.createContext({ JSON, String, Number, Object, Array })
  vm.runInContext(src + "\\nthis.normalize = instructionText;", ctx)
  const norm = input => vm.runInContext("normalize(input)", Object.assign(ctx, { input }))
  const cases = [
    ["plain instructions", "plain instructions"],
    [null, ""],
    [undefined, ""],
    [false, "false"],
    [0, "0"],
    [["answer naturally", "cite the resume"], '["answer naturally","cite the resume"]'],
    [{ voice: "natural", audience: "director" }, '{"voice":"natural","audience":"director"}'],
    [{ rules: ["do not invent metrics", "cover technical depth"] }, '{"rules":["do not invent metrics","cover technical depth"]}'],
    [{ nested: { paragraphs: ["a", "b"] } }, '{"nested":{"paragraphs":["a","b"]}}'],
    ["x".repeat(45000), "x".repeat(45000)],
  ]
  for (const [input, expected] of cases) assert.equal(norm(input), expected)
  assert.equal(norm(Infinity), null, "non-finite numeric input is not accepted")
  assert.match(issue, /instructions: 120000/, "large saved prompt is preserved within bounded request size")
  assert.match(issue, /field === "instructions" \\? instructionText\\(session\\[field\\]\\) : session\\[field\\]/)
  assert.match(issue, /Buffer\\.byteLength\\(raw, "utf8"\\) > MAX_BYTES/, "request byte cap is still enforced")
})
