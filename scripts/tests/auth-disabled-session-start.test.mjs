import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import reauth from "../../public/kompas/session-reauth.js"

const { decideSessionStart, AUTH_UNAVAILABLE } = reauth
const sidebar = readFileSync(new URL("../../src/app/dashboard/sidebar-nav.tsx", import.meta.url), "utf8")

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

test("a signed-out Kompas user is sent to real sign-in, not a synthetic owner", () => {
  const decision = decideSessionStart(dead)
  assert.equal(decision.action, "sign_in")
  assert.equal(decision.autoSignIn, true)
  assert.doesNotMatch(sidebar, /LOGIN_OFF_OWNER_EMAIL|setAuthOff\(true\)|signedIn \|\| authOff/)
  assert.doesNotMatch(sidebar, /setSignedIn\(true\)/)
  assert.match(sidebar, /const supabase = createClient\(\)/)
  assert.match(sidebar, /router\.push\("\/login\?next=\/dashboard"\)/)
  assert.match(sidebar, /href=\{signedIn \? "\/dashboard\/connections" : "\/login\?next=\/dashboard"\}/)
})

test("a local auth-disabled session remains explicit, while production sign-in behavior is the default", () => {
  const local = decideSessionStart({ ...dead, authDisabled: true })
  assert.equal(local.action, "proceed")
  assert.equal(local.autoSignIn, false)
  assert.equal(local.egress, false)

  const signedOut = decideSessionStart({ ...dead, authDisabled: false })
  assert.equal(signedOut.action, "sign_in")
  assert.equal(signedOut.autoSignIn, true)
})

test("a real answer outage is explained and does not become an auth bypass", () => {
  const down = decideSessionStart({
    httpStatus: 503,
    code: "OPENROUTER_NOT_CONFIGURED",
    authDisabled: false,
    interviewLive: false,
  })
  assert.equal(down.action, "explain")
  assert.equal(down.autoSignIn, false)
  assert.equal(down.message, AUTH_UNAVAILABLE)
})
