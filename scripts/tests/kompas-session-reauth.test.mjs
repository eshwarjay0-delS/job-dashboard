import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import reauth from "../../public/kompas/session-reauth.js"
const { decideSessionStart, AUTH_EGRESS_BLOCKED, AUTH_SIGNED_OUT, AUTH_UNAVAILABLE } = reauth
import { AUTH_EGRESS_BLOCKED as SERVER_EGRESS, AUTH_SIGNED_OUT as SERVER_SIGNED_OUT, isAuthEgressBlocked, isTerminalSignOut, userFromAuthClient } from "../../src/lib/kompasAuthSession.ts"
import { safeAuthNext } from "../../src/lib/authRedirect.ts"

const app = readFileSync(new URL("../../public/kompas/app.js", import.meta.url), "utf8")
const html = readFileSync(new URL("../../public/kompas/index.html", import.meta.url), "utf8")
const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")
const preload = readFileSync(new URL("../../legacy/perfact/desktop/preload.js", import.meta.url), "utf8")

test("client and server use the same egress and signed-out sentences", () => {
  assert.equal(AUTH_EGRESS_BLOCKED, SERVER_EGRESS)
  assert.equal(AUTH_SIGNED_OUT, SERVER_SIGNED_OUT)
  assert.match(AUTH_EGRESS_BLOCKED, /HTTP 402/)
  assert.match(AUTH_EGRESS_BLOCKED, /spend cap/)
  assert.match(AUTH_SIGNED_OUT, /Sign in again/)
})

test("logout everywhere asks for a new sign-in and does not ask during an interview", () => {
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
  const open = decideSessionStart(dead)
  assert.equal(open.action, "sign_in")
  assert.equal(open.autoSignIn, true)
  assert.equal(open.message, AUTH_SIGNED_OUT)
  const live = decideSessionStart({ ...dead, interviewLive: true })
  assert.equal(live.action, "wait")
  assert.equal(live.autoSignIn, false)
  assert.equal(live.message, "")
})

test("a dead token and a 401 followed by a failed refresh both ask for sign-in", () => {
  const deadToken = decideSessionStart({
    httpStatus: 401,
    code: "signed_out",
    refreshAttempted: true,
    refreshOk: false,
    refreshStatus: 401,
    noticeCode: "signed_out",
    hasSession: false,
    interviewLive: false,
  })
  assert.equal(deadToken.action, "sign_in")
  const failedRefresh = decideSessionStart({
    httpStatus: 401,
    code: "signed_out",
    message: "Sign in again to use this.",
    refreshAttempted: true,
    refreshOk: false,
    refreshStatus: 401,
    refreshCode: "signed_out",
    interviewLive: false,
  })
  assert.equal(failedRefresh.action, "sign_in")
  assert.equal(failedRefresh.autoSignIn, true)
})

test("HTTP 402 egress is explained and is not a logout or a Chrome prompt", () => {
  const blocked = decideSessionStart({
    httpStatus: 402,
    code: "exceed_egress_quota",
    message: AUTH_EGRESS_BLOCKED,
    refreshAttempted: false,
    interviewLive: false,
    hasSession: true,
  })
  assert.equal(blocked.action, "explain")
  assert.equal(blocked.egress, true)
  assert.equal(blocked.autoSignIn, false)
  assert.equal(blocked.message, AUTH_EGRESS_BLOCKED)
  const during = decideSessionStart({
    httpStatus: 401,
    code: "exceed_egress_quota",
    message: AUTH_EGRESS_BLOCKED,
    refreshAttempted: true,
    refreshOk: false,
    refreshStatus: 402,
    refreshCode: "exceed_egress_quota",
    noticeCode: "egress_quota",
    interviewLive: true,
    hasSession: true,
  })
  assert.equal(during.action, "explain")
  assert.equal(during.egress, true)
  assert.equal(during.autoSignIn, false)
})

test("a valid desktop session and an unreachable refresh stay put", () => {
  const kept = decideSessionStart({
    httpStatus: 401,
    code: "signed_out",
    refreshAttempted: true,
    refreshOk: false,
    refreshStatus: 401,
    refreshCode: "already_used",
    hasSession: true,
    interviewLive: false,
  })
  assert.equal(kept.action, "explain")
  assert.equal(kept.autoSignIn, false)
  assert.equal(kept.egress, false)
  const down = decideSessionStart({
    httpStatus: 401,
    refreshAttempted: true,
    refreshOk: false,
    refreshStatus: 0,
    interviewLive: false,
  })
  assert.equal(down.action, "explain")
  assert.equal(down.message, AUTH_UNAVAILABLE)
  assert.equal(down.autoSignIn, false)
  const ready = decideSessionStart({ httpStatus: 200, ready: true })
  assert.equal(ready.action, "proceed")
})

test("402 with a still-valid access token stays signed in, and an expired one is an egress block", async () => {
  const now = 1_800_000_000
  const kept = await userFromAuthClient({
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "exceed_egress_quota", status: 402, code: "exceed_egress_quota" } }),
      getClaims: async () => ({ data: { claims: { sub: "user-1", exp: now + 600, email: "a@example.com", email_verified: true } }, error: null }),
    },
  }, now)
  assert.equal(kept.id, "user-1")
  assert.equal(kept.unreachable, false)
  const blocked = await userFromAuthClient({
    auth: {
      getUser: async () => ({ data: { user: null }, error: { message: "exceed_egress_quota", status: 402, code: "exceed_egress_quota" } }),
      getClaims: async () => ({ data: { claims: { sub: "user-1", exp: now - 10, email_verified: true } }, error: null }),
    },
  }, now)
  assert.equal(blocked.unreachable, true)
  assert.equal(blocked.blocked, "egress")
  assert.equal(blocked.id, "")
  assert.equal(isAuthEgressBlocked({ status: 402, message: "exceed_egress_quota" }), true)
  assert.equal(isTerminalSignOut({ message: "Invalid Refresh Token: Refresh Token Not Found", code: "refresh_token_not_found" }), true)
  assert.equal(isTerminalSignOut({ message: "Invalid Refresh Token: Already Used", code: "refresh_token_already_used" }), false)
  assert.equal(isTerminalSignOut({ message: "exceed_egress_quota", status: 402, code: "exceed_egress_quota" }), false)
})

test("the Kompas page offers sign-in only outside a live interview and returns to Kompas after Google", () => {
  assert.ok(html.indexOf('src="session-reauth.js') < html.indexOf('src="app.js'))
  assert.match(app, /KompasSessionReauth\.decideSessionStart/)
  assert.match(app, /setInterview\?\.\(true\)/)
  assert.match(app, /setInterview\?\.\(false\)/)
  assert.match(app, /function offerFreshSignIn\(auto\)/)
  assert.match(app, /if \(running\) return/)
  assert.match(app, /\/login\?next=/)
  assert.match(app, /reason=egress/)
  assert.equal(safeAuthNext("/kompas/index.html"), "/kompas/index.html")
  assert.equal(safeAuthNext("/kompas/index.html?next=https://evil.example"), "/kompas/index.html")
  assert.equal(safeAuthNext("/kompas/../../login"), "/dashboard")
  assert.match(main, /if \(interviewLive\) \{ signInDeferred = true; return; \}/)
  assert.match(main, /notice\.code === "egress_quota"/)
  assert.match(preload, /setInterview:/)
  assert.match(preload, /authState:/)
})
