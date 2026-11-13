import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const login = readFileSync(new URL("../../src/app/login/page.tsx", import.meta.url), "utf8")
const adminAccess = readFileSync(new URL("../../src/lib/adminAccess.ts", import.meta.url), "utf8")

test("MarketFit login exposes Google OAuth only", () => {
  assert.match(login, /signInWithOAuth/)
  assert.match(login, /provider:"google"/)
  assert.match(login, /Continue with Google/)
  for (const forbidden of [
    /Skip login/i,
    /skipLogin/,
    /signInWithPassword/,
    /resetPasswordForEmail/,
    /email and password/i,
    /mf-email/,
    /mf-password/,
    /serverReportsAuthDisabled/,
  ]) assert.doesNotMatch(login, forbidden)
})

test("admin access remains a server-side membership decision", () => {
  assert.match(adminAccess, /admin_memberships/)
  assert.doesNotMatch(login, /admin_memberships|eshwarjay0@gmail\.com/i)
})
