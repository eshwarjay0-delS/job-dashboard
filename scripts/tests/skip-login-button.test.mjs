// Skip sign-in sits under Google on /login and opens /dashboard as the owner.
import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import vm from "node:vm"
import { createRequire } from "node:module"
import { safeAuthNext, safeDisabledAuthNext } from "../../src/lib/authRedirect.ts"
import {
  disabledOwnerUser,
  LOGIN_OFF_OWNER_EMAIL,
  OWNER_SKIP_COOKIE,
  OWNER_SKIP_VALUE,
  ownerSkipLocation,
} from "../../src/lib/authDisabled.ts"

const login = readFileSync(new URL("../../src/app/login/page.tsx", import.meta.url), "utf8")
const home = readFileSync(new URL("../../src/app/page.tsx", import.meta.url), "utf8")
const layout = readFileSync(new URL("../../src/app/login/layout.tsx", import.meta.url), "utf8")
const signup = readFileSync(new URL("../../src/app/signup/layout.tsx", import.meta.url), "utf8")
const authLayout = readFileSync(new URL("../../src/app/auth/layout.tsx", import.meta.url), "utf8")
const gate = readFileSync(new URL("../../src/lib/authGate.ts", import.meta.url), "utf8")
const session = readFileSync(new URL("../../src/lib/supabase/update-session.ts", import.meta.url), "utf8")
const admin = readFileSync(new URL("../../src/app/api/admin/owner/route.ts", import.meta.url), "utf8")
const route = readFileSync(new URL("../../src/app/api/auth/skip-sign-in/route.ts", import.meta.url), "utf8")

test("the Skip sign-in button sits under Google and is not hidden on a narrow screen", () => {
  const google = login.indexOf("Continue with Google")
  const skip = login.indexOf("Skip sign-in")
  assert.ok(google > 0 && skip > google)
  assert.match(login, /<form action="\/api\/auth\/skip-sign-in" method="post"/)
  assert.match(login, /type="submit"/)
  assert.match(login, /className="mt-3"/)
  assert.doesNotMatch(login, /\{skipLogin &&/)
  const button = login.slice(skip - 400, skip + 40)
  assert.doesNotMatch(button, /hidden/)
  assert.equal(disabledOwnerUser({ AUTH_DISABLED_USER_EMAIL: "eshwarjay05@gmail.com" }).email, LOGIN_OFF_OWNER_EMAIL)
  assert.equal(disabledOwnerUser({}).id, "67f02d95-f7fe-4058-9b0d-9363221e7c61")
})

test("the Skip sign-in route sets the owner cookie and lands on /dashboard", async () => {
  const landed = ownerSkipLocation("https://marketfit-app.vercel.app/api/auth/skip-sign-in")
  assert.equal(landed.pathname, "/dashboard")
  assert.match(route, /NextResponse\.redirect\(ownerSkipLocation\(request\.url\), 307\)/)
  assert.match(route, /response\.cookies\.set\(OWNER_SKIP_COOKIE, OWNER_SKIP_VALUE, ownerSkipCookieOptions\(\)\)/)
  const require = createRequire(import.meta.url)
  const ts = require("typescript")
  const auth = await import("../../src/lib/authDisabled.ts")
  const compiled = ts.transpileModule(route, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const mod = { exports: {} }
  class NextRequest extends Request {}
  const NextResponse = {
    redirect(url, status) {
      const headers = new Headers({ location: String(url) })
      const jar = new Map()
      return {
        status,
        headers,
        cookies: {
          set(name, value) {
            jar.set(name, String(value))
            headers.append("set-cookie", name + "=" + value)
          },
          get(name) {
            const value = jar.get(name)
            return value === undefined ? undefined : { name, value }
          },
        },
      }
    },
  }
  vm.runInNewContext(compiled, {
    module: mod,
    exports: mod.exports,
    require(id) {
      if (id === "next/server") return { NextRequest, NextResponse }
      if (id === "@/lib/authDisabled") return auth
      throw new Error(id)
    },
    URL,
  })
  for (const method of ["GET", "POST"]) {
    const response = mod.exports[method](new NextRequest("https://job-dashboard-fawn.vercel.app/api/auth/skip-sign-in", { method }))
    assert.equal(response.status, 307)
    assert.equal(new URL(response.headers.get("location")).pathname, "/dashboard")
    assert.equal(response.cookies.get(OWNER_SKIP_COOKIE).value, OWNER_SKIP_VALUE)
  }
})

test("owner mode redirects /login, /signup and /auth to /dashboard, and admin stays 401", () => {
  assert.match(home, /enterAppIfAuthDisabled\(\)/)
  assert.match(layout, /enterAppIfAuthDisabled\(\)/)
  assert.match(signup, /enterAppIfAuthDisabled\(\)/)
  assert.match(authLayout, /enterAppIfAuthDisabled\(\)/)
  assert.match(session, /if \(isAuthDisabled\(\) \|\| hasOwnerSkipCookie\(request\.cookies\.getAll\(\)\)\)/)
  assert.match(session, /safeDisabledAuthNext/)
  assert.match(gate, /pathname === "\/" && hasUser\) return "\/dashboard"/)
  assert.match(gate, /pathname === "\/login" && hasUser\) return safeAuthNext\(nextParam\)/)
  assert.equal(safeAuthNext(safeDisabledAuthNext(null)), "/dashboard")
  assert.equal(safeAuthNext(safeDisabledAuthNext("/dashboard/admin")), "/dashboard")
  assert.equal(safeAuthNext(safeDisabledAuthNext("/dashboard/admin/vision")), "/dashboard")
  assert.match(admin, /if \(!user \|\| user\.synthetic\) return NextResponse\.json\(\{ authenticated: false, owner: false \}, \{ status: 401 \}\)/)
})
