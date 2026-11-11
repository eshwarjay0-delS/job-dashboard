"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  envForcesSignIn,
  authDisabledFromCapabilities,
  shouldSkipSignIn,
  shouldRecoverSignInFrom401,
  readServerAuthDisabled,
  CAPABILITIES_TIMEOUT_MS,
} = require("../auth-disabled.cjs");

test("a local default does not skip sign-in; only false forces today's login", () => {
  assert.equal(envForcesSignIn({}), false);
  assert.equal(envForcesSignIn({ AUTH_DISABLED: "" }), false);
  assert.equal(envForcesSignIn({ AUTH_DISABLED: "true" }), false);
  assert.equal(shouldSkipSignIn({ env: {}, body: undefined }), false);
  assert.equal(envForcesSignIn({ AUTH_DISABLED: "false" }), true);
  assert.equal(envForcesSignIn({ AUTH_DISABLED: "FALSE" }), true);
  assert.equal(envForcesSignIn({ AUTH_DISABLED: "0" }), true);
  assert.equal(envForcesSignIn({ NEXT_PUBLIC_AUTH_DISABLED: "off" }), true);
  assert.equal(envForcesSignIn({ KOMPAS_AUTH_DISABLED: "no" }), true);
  assert.equal(shouldSkipSignIn({ env: { AUTH_DISABLED: "false" }, body: { authDisabled: true } }), false);
});

test("server says authDisabled true means skip sign-in", () => {
  assert.equal(authDisabledFromCapabilities({ authDisabled: true }), true);
  assert.equal(shouldSkipSignIn({ env: {}, body: { authDisabled: true, version: "local" } }), true);
});

test("field absent, false, or a failed/timed-out call means today's sign-in", () => {
  assert.equal(authDisabledFromCapabilities({}), false);
  assert.equal(authDisabledFromCapabilities({ authDisabled: false }), false);
  assert.equal(authDisabledFromCapabilities({ authDisabled: "true" }), false);
  assert.equal(authDisabledFromCapabilities(null), false);
  assert.equal(shouldSkipSignIn({ env: {}, body: {} }), false);
  assert.equal(shouldSkipSignIn({ env: {}, body: { authDisabled: false } }), false);
  assert.equal(shouldSkipSignIn({ env: {}, error: true, body: { authDisabled: true } }), false);
});

test("readServerAuthDisabled skips only on a 200 body with authDisabled true", async () => {
  const origin = "https://job-dashboard-fawn.vercel.app";
  const trueFetch = async () => ({ ok: true, json: async () => ({ authDisabled: true }) });
  const falseFetch = async () => ({ ok: true, json: async () => ({ authDisabled: false }) });
  const absentFetch = async () => ({ ok: true, json: async () => ({ version: "local", policy: "marketfit/kompas" }) });
  const errorFetch = async () => { throw new Error("offline"); };
  const httpFetch = async () => ({ ok: false, status: 500, json: async () => ({}) });
  const hangFetch = () => new Promise(() => {});
  assert.equal(await readServerAuthDisabled({ origin, fetch: trueFetch }), true);
  assert.equal(await readServerAuthDisabled({ origin, fetch: falseFetch }), false);
  assert.equal(await readServerAuthDisabled({ origin, fetch: absentFetch }), false);
  assert.equal(await readServerAuthDisabled({ origin, fetch: errorFetch }), false);
  assert.equal(await readServerAuthDisabled({ origin, fetch: httpFetch }), false);
  assert.equal(await readServerAuthDisabled({
    origin, fetch: hangFetch, timeoutMs: 20,
  }), false);
  assert.equal(await readServerAuthDisabled({
    origin, env: { AUTH_DISABLED: "false" }, fetch: trueFetch,
  }), false);
  assert.ok(CAPABILITIES_TIMEOUT_MS <= 5000);
});

test("401 after a server auth-disabled skip never shows the sign-in card", () => {
  assert.equal(shouldRecoverSignInFrom401({ skipActive: true, alreadyRecovered: false, serverSaidAuthDisabled: true }), false);
  assert.equal(shouldRecoverSignInFrom401({ skipActive: true, alreadyRecovered: false }), true);
  assert.equal(shouldRecoverSignInFrom401({ skipActive: true, alreadyRecovered: true }), false);
  assert.equal(shouldRecoverSignInFrom401({ skipActive: false, alreadyRecovered: false }), false);
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  assert.match(main, /function recoverSignInAfter401\(/);
  assert.match(main, /if \(serverSaidAuthDisabled\) return;/);
  assert.match(main, /beginChromeSignIn\(\{ interactive: true \}\)/);
  assert.match(main, /response\.status === 401 && typeof recoverSignInAfter401 === "function"/);
  assert.equal((main.match(/readServerAuthDisabled\(/g) || []).length, 1);
  assert.doesNotMatch(main, /setInterval\([^\n]*capabilities/);
  assert.doesNotMatch(main, /\/api\/kompas\/capabilities[^\n]*resume/);
});
