import test from "node:test"
import assert from "node:assert/strict"
import { appOrigin, configuredAppOrigin, allowedOrigins, isAllowedOrigin, VERCEL_CANONICAL_ORIGIN } from "../../src/lib/appOrigin.ts"

test("NEXT_PUBLIC_APP_URL wins, userinfo is rejected, and the Vercel default is last", () => {
  assert.equal(configuredAppOrigin({}), "")
  assert.equal(appOrigin(undefined, {}), VERCEL_CANONICAL_ORIGIN)
  assert.equal(appOrigin("https://example.trycloudflare.com", {}), "https://example.trycloudflare.com")
  assert.equal(
    appOrigin("https://ignored.example", { NEXT_PUBLIC_APP_URL: "https://oracle.example" }),
    "https://oracle.example",
  )
  assert.equal(configuredAppOrigin({ NEXT_PUBLIC_APP_URL: "https://user:pass@evil.example" }), "")
  assert.equal(configuredAppOrigin({ APP_URL: "https://alt.example/app" }), "https://alt.example")
})

test("ALLOWED_ORIGINS and KOMPAS_ALLOWED_ORIGINS are merged with the configured origin", () => {
  const env = {
    NEXT_PUBLIC_APP_URL: "https://app.example",
    ALLOWED_ORIGINS: "https://tunnel.example, https://desktop.example",
    KOMPAS_ALLOWED_ORIGINS: "https://tunnel.example",
  }
  const list = allowedOrigins(env)
  assert.deepEqual(new Set(list), new Set(["https://app.example", "https://tunnel.example", "https://desktop.example"]))
  assert.equal(isAllowedOrigin("https://tunnel.example", "https://app.example", env), true)
  assert.equal(isAllowedOrigin("https://evil.example", "https://app.example", env), false)
  assert.equal(isAllowedOrigin("https://box.example", "https://box.example/", env), true)
})
