"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { isAuthDisabled } = require("../auth-disabled.cjs");

test("AUTH_DISABLED defaults to no login when unset", () => {
  assert.equal(isAuthDisabled({}), true);
  assert.equal(isAuthDisabled({ AUTH_DISABLED: "" }), true);
  assert.equal(isAuthDisabled({ AUTH_DISABLED: "true" }), true);
  assert.equal(isAuthDisabled({ KOMPAS_AUTH_DISABLED: "1" }), true);
});

test("setting the flag to false restores today's desktop login", () => {
  assert.equal(isAuthDisabled({ AUTH_DISABLED: "false" }), false);
  assert.equal(isAuthDisabled({ AUTH_DISABLED: "FALSE" }), false);
  assert.equal(isAuthDisabled({ AUTH_DISABLED: "0" }), false);
  assert.equal(isAuthDisabled({ NEXT_PUBLIC_AUTH_DISABLED: "off" }), false);
  assert.equal(isAuthDisabled({ KOMPAS_AUTH_DISABLED: "no" }), false);
});

test("the shell skips Chrome sign-in, token refresh, and bearer forwarding when auth is off", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  const pack = fs.readFileSync(path.join(__dirname, "package.mjs"), "utf8");
  assert.match(main, /require\("\.\/auth-disabled\.cjs"\)/);
  assert.match(main, /function desktopAuthDisabled\(\)/);
  assert.match(main, /if \(typeof desktopAuthDisabled === "function" && desktopAuthDisabled\(\)\) return hideHandoff\(\)/);
  assert.match(main, /if \(typeof desktopAuthDisabled === "function" && desktopAuthDisabled\(\)\) return true/);
  assert.match(main, /if \(typeof desktopAuthDisabled === "function" && desktopAuthDisabled\(\)\) \{\s*hideHandoff\(\);/);
  assert.match(main, /if \(!\(typeof desktopAuthDisabled === "function" && desktopAuthDisabled\(\)\)\) \{\s*await desktopAuth\.renew\(false\)/);
  assert.doesNotMatch(main, /if \(typeof desktopAuthDisabled === "function" && desktopAuthDisabled\(\)\) \{\s*void desktopAuth\.renew/);
  assert.match(pack, /"auth-flag\.js"/);
});
