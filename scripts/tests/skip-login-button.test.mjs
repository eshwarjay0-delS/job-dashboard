// Skip login is a visible fallback on /login only while the server flag is on.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { safeAuthNext, safeDisabledAuthNext } from "../../src/lib/authRedirect.ts"
import { disabledOwnerUser, LOGIN_OFF_OWNER_EMAIL } from "../../src/lib/authDisabled.ts"

const login = readFileSync(new URL("../../src/app/login/page.tsx", import.meta.url), "utf8")
const home = readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8")
const layout = readFileSync(new URL("../../src/app/login/layout.tsx", import.meta.url), "utf8")
  const gate = readFileSync(new URL("../../src/lib/authGate.ts", import.meta.url), "utf8")
  const session = readFileSync(new URL("../../src/lib/supabase/update-session.ts", import.meta.url), "utf8")
const admin = readFileSync(new URL("../../src/app/api/admin/owner/route.ts", import.meta.url), "utf8")

test("the Skip login button sits under Google and stays hidden until the server flag is on", () => {
  const google = login.indexOf("Continue with Google")
  const skip = login.indexOf("Skip login")
  assert.ok(google > 0 && skip > google)
  assert.match(login, /\{skipLogin &&/)
  assert.match(login, /useState\(false\)/)
  assert.match(login, /serverReportsAuthDisabled\(\)/)
  assert.match(login, /setSkipLogin\(true\)/)
  assert.match(login, /window\.location\.assign\("\/dashboard"\)/)
  assert.doesNotMatch(login, /signInWithOAuth\(\{[^}]*skip/s)
  assert.equal(disabledOwnerUser({ AUTH_DISABLED_USER_EMAIL: "eshwarjay05@gmail.com" }).email, LOGIN_OFF_OWNER_EMAIL)
})

test("AUTH_DISABLED redirects / and /login to /dashboard on the server, and admin stays 401", () => {
  assert.match(home, /enterAppIfAuthDisabled\(\)/)
  assert.match(layout, /enterAppIfAuthDisabled\(\)/)
  assert.match(session, /if \(isAuthDisabled\(\)\)/)
  assert.match(session, /safeDisabledAuthNext/)
  assert.match(gate, /pathname === "\/" && hasUser\) return "\/dashboard"/)
  assert.match(gate, /pathname === "\/login" && hasUser\) return safeAuthNext\(nextParam\)/)
  assert.equal(safeAuthNext(safeDisabledAuthNext(null)), "/dashboard")
  assert.equal(safeAuthNext(safeDisabledAuthNext("/dashboard/admin")), "/dashboard")
  assert.equal(safeAuthNext(safeDisabledAuthNext("/dashboard/admin/vision")), "/dashboard")
  assert.match(admin, /if \(!user \|\| user\.synthetic\) return NextResponse\.json\(\{ authenticated: false, owner: false \}, \{ status: 401 \}\)/)
})
