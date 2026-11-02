import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

const issue = readFileSync(new URL("../../src/app/api/auth/desktop-session/issue/route.ts", import.meta.url), "utf8")
const redeem = readFileSync(new URL("../../src/app/api/auth/desktop-session/redeem/route.ts", import.meta.url), "utf8")
const refresh = readFileSync(new URL("../../src/app/api/auth/refresh-token/route.ts", import.meta.url), "utf8")
const desktop = readFileSync(new URL("../../legacy/perfact/desktop/marketfit-auth.cjs", import.meta.url), "utf8")
const main = readFileSync(new URL("../../legacy/perfact/desktop/main.js", import.meta.url), "utf8")

test("device grant requires authenticated email and binds a one-time proof to verified identity", () => {
  assert.match(issue, /authenticatedUser\(request\)/)
  assert.match(issue, /user\?\.email/)
  assert.match(issue, /checkRateLimit/)
  assert.match(issue, /auth\.admin\.generateLink\(\{ type: "magiclink", email: user\.email \}\)/)
  assert.match(issue, /data\?\.user\?\.id !== user\.id/)
  assert.match(issue, /hashed_token/)
  assert.match(issue, /Cache-Control.*no-store/)
  assert.doesNotMatch(issue, /service_role.*NextResponse\.json/)
})
test("device redeems one-time OTP to create a separate native refresh family", () => {
  assert.match(redeem, /auth\.verifyOtp\(\{ type: "magiclink", token_hash \}\)/)
  assert.match(redeem, /persistSession: false, autoRefreshToken: false/)
  assert.match(redeem, /refresh_token: s\.refresh_token/)
  assert.match(redeem, /userId: s\.user\.id/)
  assert.match(redeem, /checkRateLimit/)
})
test("native account-bound rotation reuses existing refresh endpoint but never browser cookie identity", () => {
  assert.match(refresh, /userId: s\.user\.id/)
  assert.match(desktop, /response\.status === 401\) \{ clear\(\)/)
  assert.match(desktop, /next\.userId !== owner/)
  assert.match(desktop, /safeStorage\.encryptString/)
  assert.match(desktop, /refresh_token: refresh/)
  assert.match(desktop, /desktop-session\/redeem/)
  assert.match(desktop, /states\.clear\(\)/) // native callback nonce is single-use
  assert.match(main, /hadSavedNativeAuth/)
  assert.match(main, /await desktopAuth\.renew\(true\)/)
})
