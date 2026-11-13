import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const login = readFileSync(new URL("../../src/app/login/page.tsx", import.meta.url), "utf8")
const adminAccess = readFileSync(new URL("../../src/lib/adminAccess.ts", import.meta.url), "utf8")
const owner = readFileSync(new URL("../../src/lib/owner.ts", import.meta.url), "utf8")

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

test("owner admin remains a server-side verified Google identity", () => {
  assert.match(adminAccess, /isAdminEmail\(user\.email\)/)
  assert.match(owner, /PRODUCT_OWNER_EMAIL = "eshwarjay0@gmail\.com"/)
  assert.match(owner, /mine === PRODUCT_OWNER_EMAIL/)
  assert.doesNotMatch(login, /PRODUCT_OWNER_EMAIL|ADMIN_EMAILS|eshwarjay0@gmail\.com/i)
})
