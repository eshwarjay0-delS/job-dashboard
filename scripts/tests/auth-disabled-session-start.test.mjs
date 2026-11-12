import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import reauth from "../../public/kompas/session-reauth.js"

const { decideSessionStart, NOT_READY } = reauth
const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const refresh = readFileSync(new URL("../../src/app/api/auth/refresh/route.ts", import.meta.url), "utf8")
const server = readFileSync(new URL("../../src/lib/supabase/server.ts", import.meta.url), "utf8")
const browser = readFileSync(new URL("../../src/lib/supabase/client.ts", import.meta.url), "utf8")
const status = readFileSync(new URL("../../src/app/api/onboarding/status/route.ts", import.meta.url), "utf8")
const sidebar = readFileSync(new URL("../../src/app/dashboard/sidebar-nav.tsx", import.meta.url), "utf8")
const setup = readFileSync(new URL("../../src/app/dashboard/setup/page.tsx", import.meta.url), "utf8")
const gate = readFileSync(new URL("../../src/app/dashboard/onboarding-gate.tsx", import.meta.url), "utf8")
const guard = readFileSync(new URL("../../src/app/dashboard/session-lifetime-guard.tsx", import.meta.url), "utf8")

const dead = {
  httpStatus: 401,
  code: "signed_out",
  message: "Invalid Refresh Token: Refresh Token Not Found",
  refreshAttempted: true,
  refreshOk: false,
  refreshStatus: 401,
  refreshCode: "signed_out",
  noticeCode: "signed_out",
  hasSession: false,
  interviewLive: false,
}

test("skip-login starts a session on 401, 402, and a missing refresh token", () => {
  for (const input of [
    dead,
    { httpStatus: 402, code: "exceed_egress_quota", message: "exceed_egress_quota", interviewLive: false },
    { httpStatus: 401, refreshAttempted: true, refreshOk: false, refreshStatus: 402, refreshCode: "exceed_egress_quota", noticeCode: "egress_quota" },
  ]) {
    const decision = decideSessionStart({ ...input, authDisabled: true })
    assert.equal(decision.action, "proceed")
    assert.equal(decision.autoSignIn, false)
    assert.equal(decision.egress, false)
  }
  const stillLoggedIn = decideSessionStart(dead)
  assert.equal(stillLoggedIn.action, "sign_in")
  assert.equal(stillLoggedIn.autoSignIn, true)
})

test("skip-login does not open sign-in during an interview and still explains a real answer outage", () => {
  const live = decideSessionStart({ ...dead, authDisabled: true, interviewLive: true })
  assert.equal(live.action, "wait")
  assert.equal(live.autoSignIn, false)
  const down = decideSessionStart({ httpStatus: 503, code: "OPENROUTER_NOT_CONFIGURED", authDisabled: true, interviewLive: false })
  assert.equal(down.action, "explain")
  assert.equal(down.autoSignIn, false)
  assert.equal(down.message, NOT_READY)
})

test("Kompas does not navigate to login when skip-login is on", () => {
  assert.match(app, /function offerFreshSignIn\(auto\) \{\n  if \(running\) return;\n  if \(typeof isKompasAuthDisabled === "function" && isKompasAuthDisabled\(\)\) return;/)
  assert.match(app, /authDisabled: authOff/)
  assert.match(app, /decision\.action === "proceed"/)
  assert.match(app, /Sign-in is off\. Press Start session\./)
  assert.match(html, /<section class="view view-auth hidden" id="view-login">/)
  assert.ok(html.indexOf('<script src="auth-flag.js">') < html.indexOf('id="view-login"'))
  assert.equal((html.match(/src="auth-flag\.js"/g) || []).length, 1)
})

test("refresh, MarketFit, and the browser client do not call Auth or show login when skip-login is on", () => {
  const refreshAt = refresh.indexOf("if (isAuthDisabled())")
  const refreshCall = refresh.indexOf("await createClientFromRequest")
  assert.ok(refreshAt > 0 && refreshAt < refreshCall)
  assert.match(refresh, /authDisabled: true/)
  assert.match(server, /skipNetwork: isAuthDisabled\(\) \|\| !hasSupabaseAuthMaterial/)
  assert.match(browser, /skipNetwork: isAuthDisabled\(\)/)
  const statusAt = status.indexOf("if (isAuthDisabled() || isSyntheticDisabledAuthUser(user))")
  const profileAt = status.indexOf('.from("profiles")')
  assert.ok(statusAt > 0 && statusAt < profileAt)
  assert.match(status, /onboardingBypassed: true/)
  assert.match(sidebar, /setAuthOff\(true\)/)
  assert.match(sidebar, /signedIn \|\| authOff/)
  assert.match(setup, /serverReportsAuthDisabled\(\)/)
  assert.match(setup, /router\.replace\("\/dashboard"\)/)
  assert.match(gate, /serverReportsAuthDisabled\(\)/)
  assert.match(guard, /serverReportsAuthDisabled\(\)/)
})
