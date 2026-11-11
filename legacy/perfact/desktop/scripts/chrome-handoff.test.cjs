"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const handoff = require("../chrome-handoff.cjs");

const STATE = "Zm9yIGEgdGVzdCBvbmx5IC0gbm90IGEgcmVhbCBzdGF0ZQ";
const TOKEN = "v2b2ADLX5N83WOWGuKSAxFlUoXwa";

test("a stored desktop session does not show the Chrome handoff", () => {
  assert.deepEqual(handoff.handoffAction({ hasSession: true, interactive: false, alreadyAttempted: false }), {
    show: false, openChrome: false, silent: true,
  });
  assert.deepEqual(handoff.handoffAction({ hasSession: true, interactive: true, alreadyAttempted: true }), {
    show: false, openChrome: false, silent: true,
  });
});

test("the first missing session opens Chrome once, and a later automatic call does not", () => {
  assert.deepEqual(handoff.handoffAction({ hasSession: false, interactive: false, alreadyAttempted: false }), {
    show: true, openChrome: true, silent: false,
  });
  assert.deepEqual(handoff.handoffAction({ hasSession: false, interactive: false, alreadyAttempted: true }), {
    show: true, openChrome: false, silent: false,
  });
});

test("Open Chrome again is an explicit retry", () => {
  assert.deepEqual(handoff.handoffAction({ hasSession: false, interactive: true, alreadyAttempted: true }), {
    show: true, openChrome: true, silent: false,
  });
});

test("the handoff card uses the full sentences and does not leave Openir", () => {
  const html = handoff.handoffPanelInnerHtml();
  const text = handoff.visibleHandoffText(html);
  assert.match(text, /^Sign in with Chrome /);
  assert.match(text, /Chrome is opening MarketFit\. The Google sign-in already in that browser is used, and this window continues from there\./);
  assert.match(text, /Open Chrome again$/);
  assert.equal(/\bOpenir\b|\bOpenit\b|\bOpening\b/.test(text), false);
  assert.equal(html.includes(TOKEN), false);
  assert.equal(html.includes(STATE), false);
  assert.equal(html.includes("Opening Kompas"), false);
  const script = handoff.handoffPaintScript("show");
  assert.match(script, /retryChromeSignIn/);
  assert.equal(script.includes("openSignIn"), false);
  assert.equal(/\bOpenir\b|\bOpenit\b/.test(script), false);
  assert.equal(handoff.handoffPaintScript("hide").includes("kompas-chrome-handoff"), true);
  assert.equal(handoff.LOOPBACK_PAGE.includes(TOKEN), false);
  assert.equal(/\bOpenir\b|\bOpening\b/.test(handoff.LOOPBACK_PAGE), false);
});

test("the Chrome URL carries state, loopback, and the first-run marker", () => {
  const loop = "http://127.0.0.1:17321/cb";
  const url = new URL(handoff.chromeHandoffUrl("https://job-dashboard-fawn.vercel.app", STATE, loop));
  assert.equal(url.origin + url.pathname, "https://job-dashboard-fawn.vercel.app/auth/desktop");
  assert.equal(url.searchParams.get("state"), STATE);
  assert.equal(url.searchParams.get("loopback"), loop);
  assert.equal(url.searchParams.get("handoff"), "start");
  assert.throws(() => handoff.chromeHandoffUrl("http://job-dashboard-fawn.vercel.app", STATE, loop));
  assert.throws(() => handoff.chromeHandoffUrl("https://job-dashboard-fawn.vercel.app", "short", loop));
  assert.throws(() => handoff.chromeHandoffUrl("https://job-dashboard-fawn.vercel.app", STATE, "http://localhost:17321/cb"));
  assert.throws(() => handoff.chromeHandoffUrl("https://job-dashboard-fawn.vercel.app", STATE, "http://127.0.0.1:80/cb"));
});

test("a loopback query becomes the same one-time protocol argument", () => {
  const d = "eyJhY2Nlc3NfdG9rZW4iOiJhYWEuYmJiLmNjYyJ9";
  assert.equal(handoff.protocolArgFromLoopback({ state: STATE, d }), "marketfit-kompas://auth?state=" + STATE + "&d=" + d);
  assert.equal(handoff.protocolArgFromLoopback({ state: "short", d }), "");
  assert.equal(handoff.protocolArgFromLoopback({ state: STATE, d: "bad token" }), "");
  assert.equal(handoff.protocolArgFromLoopback({ state: STATE, d: "" }), "");
  assert.equal(handoff.protocolArgFromLoopback(null), "");
});

test("the loopback server returns the sign-in to this computer and does not echo the state", async () => {
  const seen = [];
  const listener = await handoff.startChromeLoopback({ onCallback: handed => seen.push(handed) });
  try {
    const good = await get(listener.url + "?state=" + STATE + "&d=abcDEF_123");
    assert.equal(good.status, 200);
    assert.equal(good.body.includes(STATE), false);
    assert.equal(/\bOpenir\b|\bOpening\b/.test(good.body), false);
    assert.match(good.body, /Return to Kompas/);
    assert.equal(/authenticated/i.test(good.body), false);
    assert.deepEqual(seen, [{ state: STATE, d: "abcDEF_123" }]);
    const missing = await get(listener.url.replace(/\/cb$/, "/nope"));
    assert.equal(missing.status, 404);
    assert.equal(seen.length, 1);
  } finally {
    await listener.close();
  }
});

test("the shell shows the card only when no session exists and does not clear a session on failure", () => {
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  const preload = fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8");
  assert.match(main, /if \(desktopAuth\.hasSession\(\)\)/);
  assert.match(main, /handoffAction\(/);
  assert.match(main, /chromeHandoffUrl\(/);
  assert.match(main, /startChromeLoopback\(/);
  assert.match(main, /protocolArgFromLoopback\(/);
  assert.match(main, /handoffPaintScript\(/);
  assert.match(main, /kompas:retry-chrome/);
  assert.match(preload, /retryChromeSignIn:/);
  assert.equal(main.includes("desktopAuth.clear("), false);
  assert.doesNotMatch(main, /loadURL\([^)]*\/auth\/desktop/);
  assert.equal(main.includes("Opening Kompas"), false);
  assert.equal(main.includes("Openir"), false);
});

function get(url) {
  return new Promise((resolve, reject) => {
    http.get(url, res => {
      const chunks = [];
      res.on("data", chunk => chunks.push(chunk));
      res.on("end", () => resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString("utf8") }));
    }).on("error", reject);
  });
}


test("auth-disabled mode never paints a Skip login control or a sign-in card hook for skip", () => {
  const html = handoff.handoffPanelInnerHtml();
  assert.equal(html.includes("kompas-chrome-handoff-skip"), false);
  assert.equal(handoff.visibleHandoffText(html).includes("Skip login"), false);
  const script = handoff.handoffPaintScript("show");
  assert.equal(script.includes("kompas-chrome-handoff-skip"), false);
  assert.equal(script.includes("skipLogin"), false);
  const main = fs.readFileSync(path.join(__dirname, "..", "main.js"), "utf8");
  assert.match(main, /serverSaidAuthDisabled/);
  assert.match(main, /if \(serverSaidAuthDisabled\) return hideHandoff\(\)/);
  assert.match(main, /if \(serverSaidAuthDisabled\) return;/);
  assert.doesNotMatch(main, /kompas:skip-login/);
  const preload = fs.readFileSync(path.join(__dirname, "..", "preload.js"), "utf8");
  assert.doesNotMatch(preload, /skipLogin/);
});
