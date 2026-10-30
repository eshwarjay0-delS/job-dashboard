import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import vm from "node:vm"

const app = fs.readFileSync(path.resolve("public/kompas/app.js"), "utf8")
const issue = fs.readFileSync(path.resolve("src/app/api/kompas/desktop-handoff/route.ts"), "utf8")
const redeem = fs.readFileSync(path.resolve("src/app/api/kompas/desktop-handoff/redeem/route.ts"), "utf8")

test("loaded resume and JD are never placed in the Windows launcher URL", () => {
  const code = app.slice(app.indexOf("function packSession(s) {"), app.indexOf("function launchInstalled(s) {"))
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
  assert.match(issue, /Date\.now\(\) \+ 120_000/)
  assert.match(issue, /session\.site !== "marketfit"/)
  assert.ok(!issue.includes("console.log"))
})

test("ticket redeem is atomic, single-use and not client-readable", () => {
  assert.match(redeem, /claim_kompas_desktop_handoff/)
  assert.match(redeem, /serviceClient/)
  assert.match(redeem, /status: 410/)
  assert.match(redeem, /Cache-Control.*no-store/)
})
