"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createMarketFitDesktopAuth } = require("../marketfit-auth.cjs");
const ACCESS = "abc.def.ghi";
const NEXT = "xyz.def.ghi";
const SESSION = { access_token: ACCESS, expires_at: 2000000000 };
const ORIGIN = "https://job-dashboard-fawn.vercel.app";
function harness({ verified = true, encryption = true } = {}) {
  let clock = 1793600000000, requests = [], files = new Map(), refreshCount = 0;
  let status = 200;
  const safeStorage = {
    isEncryptionAvailable: () => encryption,
    encryptString: s => Buffer.from("enc:" + s),
    decryptString: b => {
      const value = b.toString();
      if (!value.startsWith("enc:")) throw Error("plaintext credential");
      return value.slice(4);
    }
  };
  const fs = {
    mkdirSync() {},
    writeFileSync(p, bytes) { files.set(p, Buffer.from(bytes)); },
    readFileSync(p) { if (!files.has(p)) throw Error("not found"); return files.get(p); },
    rmSync(p) { files.delete(p); }
  };
  const net = {
    fetch: async (url, options) => {
      requests.push({ url, options });
      if (url.endsWith("/api/auth/refresh")) {
        refreshCount++;
        const code = verified ? status : 401;
        return { ok: code === 200, status: code, json: async () => ({ ok: code === 200 }) };
      }
      throw Error("Native client attempted to rotate a browser refresh token");
    }
  };
  const factory = () => createMarketFitDesktopAuth({ net, safeStorage, fs, profileDir: () => "/fake-user", origin: ORIGIN, now: () => clock });
  return { auth: factory(), factory, requests, files, setClock: n => clock = n, setStatus: n => status = n, getRefreshes: () => refreshCount };
}
function link(state, payload = SESSION, scheme = "marketfit-kompas") {
  return scheme + "://auth?state=" + encodeURIComponent(state) + "&d=" + Buffer.from(JSON.stringify(payload)).toString("base64url");
}
test("native callback with forged or absent nonce is rejected", () => {
  const h = harness();
  assert.equal(h.auth.callback([link("fake")]), null);
  assert.equal(h.auth.token(), "");
});
test("nonce is bound to one initiated Chrome sign-in and expires after ten minutes", () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(h.auth.callback([link(state)]).access_token, ACCESS);
  assert.equal(h.auth.callback([link(state)]), null);
  const stale = h.auth.issueState();
  h.setClock(1793600000000 + 600001);
  assert.equal(h.auth.callback([link(stale)]), null);
});
test("callback admits only authentic protocols and the auth host", () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(h.auth.callback([link(state, SESSION, "file")]), null);
  assert.equal(h.auth.callback(["marketfit-kompas://evil?state=" + state]), null);
  assert.equal(h.auth.callback([link(state, SESSION, "kompas")]).access_token, ACCESS);
});
test("browser's unverified account is never taken over by desktop", async () => {
  const h = harness({ verified: false });
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), false);
  assert.equal(h.auth.token(), "");
  assert.equal(h.files.size, 0);
});
test("verified browser handoff is available only to MarketFit API and stored encrypted", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  assert.equal(h.auth.token(), ACCESS);
  assert.match(h.requests[0].url, /\/api\/auth\/refresh$/);
  assert.equal(h.requests[0].options.headers.authorization, "Bearer " + ACCESS);
  assert.equal(h.files.size, 1);
  assert.equal([...h.files.values()][0].toString().startsWith("enc:"), true);
  assert.equal(h.factory().load(), true);
});
test("native bearer verification is single-flight, never rotates the Chrome token family", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  const initial = h.getRefreshes();
  const all = await Promise.all([h.auth.renew(true), h.auth.renew(true), h.auth.renew(true)]);
  assert.deepEqual(all, [true, true, true]);
  assert.equal(h.getRefreshes(), initial + 1);
  assert.equal(h.auth.token(), ACCESS);
  assert.equal(h.requests.every(r => !r.url.endsWith("/api/auth/refresh-token")), true);
});
test("transient API validation failure preserves the native bearer", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setStatus(402);
  assert.equal(await h.auth.renew(true), false);
  assert.equal(h.auth.token(), ACCESS);
  assert.equal(h.files.size, 1);
});
test("verified revoked bearer fails closed without adopting browser cookies", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setStatus(401);
  assert.equal(await h.auth.renew(true), false);
  assert.equal(h.auth.token(), "");
  assert.equal(h.files.size, 0);
});
test("after expiry the native shell requires a fresh Chrome handoff instead of rotating the refresh family", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setClock(2000000000000 + 10000);
  assert.equal(await h.auth.renew(true), false);
  assert.equal(h.auth.token(), "");
  assert.equal(h.requests.every(r => !r.url.endsWith("/api/auth/refresh-token")), true);
});
test("encrypted native storage never contains a browser refresh token", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state, { ...SESSION, refresh_token: "browser-only-secret" })])), true);
  const storage = [...h.files.values()][0].toString();
  assert.equal(storage.includes("browser-only-secret"), false);
  assert.equal(storage.includes("refresh_token"), false);
});
test("if OS encryption is unavailable, native credentials stay memory only", async () => {
  const h = harness({ encryption: false });
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  assert.equal(h.auth.token(), ACCESS);
  assert.equal(h.files.size, 0);
});
test("oversized or invalid callback text never becomes a desktop session", () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(h.auth.callback(["marketfit-kompas://auth?state=" + state + "&d=" + "a".repeat(24001)]), null);
  assert.equal(h.auth.callback([link(state, { ...SESSION, access_token: "not a jwt" })]), null);
  assert.equal(h.auth.token(), "");
});
