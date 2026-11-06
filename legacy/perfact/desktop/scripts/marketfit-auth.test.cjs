"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { createMarketFitDesktopAuth, SESSION_MS, PROACTIVE_BEFORE_MS } = require("../marketfit-auth.cjs");
const ACCESS = "abc.def.ghi";
const DESKTOP_ACCESS = "desk.access.jwt";
const DESKTOP_REFRESH = "desktop-family-r0";
const ROTATED_ACCESS = "rot.access.jwt";
const ROTATED_REFRESH = "desktop-family-r1";
const SESSION = { access_token: ACCESS, expires_at: 2000000000 };
const ORIGIN = "https://job-dashboard-fawn.vercel.app";
const T0 = 1793600000000;
function harness({ verified = true, encryption = true } = {}) {
  let clock = T0, requests = [], files = new Map(), refreshCount = 0;
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
      const body = options && options.body ? JSON.parse(options.body) : null;
      requests.push({ url, options, body });
      if (!String(url).endsWith("/api/auth/desktop-session")) {
        throw Error("Native client called " + url);
      }
      refreshCount++;
      if (!verified || status !== 200) {
        const code = !verified ? 401 : status;
        return { ok: false, status: code, json: async () => ({ ok: false, error: code === 401 ? "already_used" : "invalid_grant", error_description: "no" }) };
      }
      const rotating = body && typeof body.refresh_token === "string" && body.refresh_token.length > 0;
      return {
        ok: true,
        status: 200,
        json: async () => ({
          ok: true,
          access_token: rotating ? ROTATED_ACCESS : DESKTOP_ACCESS,
          refresh_token: rotating ? ROTATED_REFRESH : DESKTOP_REFRESH,
          expires_at: Math.floor(clock / 1000) + 5 * 24 * 60 * 60,
          session: "desktop",
          user_id: "owner-A",
        }),
      };
    }
  };
  const factory = () => createMarketFitDesktopAuth({ net, safeStorage, fs, profileDir: () => "/fake-user", origin: ORIGIN, now: () => clock });
  return { auth: factory(), factory, requests, files, setClock: n => clock = n, setStatus: n => status = n, getRefreshes: () => refreshCount };
}
function stored(h) {
  const raw = [...h.files.values()][0].toString();
  assert.equal(raw.startsWith("enc:"), true);
  return JSON.parse(raw.slice(4));
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
  h.setClock(T0 + 600001);
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
  assert.equal(h.auth.hasSession(), false);
  assert.equal(h.files.size, 0);
});
test("verified browser handoff opens a desktop family and stores that refresh encrypted", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  assert.equal(h.auth.token(), DESKTOP_ACCESS);
  assert.equal(h.requests[0].url.endsWith("/api/auth/desktop-session"), true);
  assert.equal(h.requests[0].body.refresh_token, "");
  assert.equal(h.requests[0].options.headers.authorization, "Bearer " + ACCESS);
  assert.equal(h.files.size, 1);
  const saved = stored(h);
  assert.equal(saved.refresh_token, DESKTOP_REFRESH);
  assert.equal(saved.ownerId, "owner-A");
  assert.equal(saved.family_expires_at, T0 + SESSION_MS);
  assert.equal(h.factory().load(), true);
});
test("native renewal is single-flight and rotates only the desktop refresh", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  const initial = h.getRefreshes();
  const all = await Promise.all([h.auth.renew(true), h.auth.renew(true), h.auth.renew(true)]);
  assert.deepEqual(all, [true, true, true]);
  assert.equal(h.getRefreshes(), initial + 1);
  assert.equal(h.auth.token(), ROTATED_ACCESS);
  assert.equal(h.requests.at(-1).body.refresh_token, DESKTOP_REFRESH);
  assert.equal(h.requests.every(r => r.url.endsWith("/api/auth/desktop-session")), true);
  assert.equal(stored(h).refresh_token, ROTATED_REFRESH);
  assert.equal(h.auth.familyExpiresAt(), T0 + SESSION_MS);
});
test("transient API validation failure preserves the native desktop session", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setStatus(402);
  assert.equal(await h.auth.renew(true), false);
  assert.equal(h.auth.token(), DESKTOP_ACCESS);
  assert.equal(h.auth.hasSession(), true);
  assert.equal(h.files.size, 1);
});
test("a rejected desktop refresh does not clear the stored session or open the website family", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setStatus(401);
  assert.equal(await h.auth.renew("rejected"), false);
  assert.equal(h.auth.hasSession(), true);
  assert.equal(h.files.size, 1);
  assert.equal(stored(h).refresh_token, DESKTOP_REFRESH);
  assert.equal(h.requests.every(r => !r.url.endsWith("/api/auth/refresh")), true);
});
test("after access expiry the desktop refresh renews without a Chrome handoff", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setClock(2000000000000 + 10000);
  assert.equal(h.auth.token(), "");
  assert.equal(h.auth.hasSession(), true);
  assert.equal(await h.auth.renew(false), true);
  assert.equal(h.auth.hasSession(), true);
  assert.equal(h.requests.at(-2).body.refresh_token, DESKTOP_REFRESH);
  assert.equal(h.requests.at(-1).body.refresh_token, "");
  assert.equal(h.requests.every(r => r.url.endsWith("/api/auth/desktop-session")), true);
});
test("encrypted native storage keeps the desktop refresh and never Chrome's", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state, { ...SESSION, refresh_token: "browser-only-secret" })])), true);
  const storage = [...h.files.values()][0].toString();
  assert.equal(storage.includes("browser-only-secret"), false);
  assert.equal(h.requests[0].body.refresh_token, "");
  assert.equal(stored(h).refresh_token, DESKTOP_REFRESH);
});
test("if OS encryption is unavailable, native credentials stay memory only", async () => {
  const h = harness({ encryption: false });
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  assert.equal(h.auth.token(), DESKTOP_ACCESS);
  assert.equal(h.files.size, 0);
});
test("oversized or invalid callback text never becomes a desktop session", () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(h.auth.callback(["marketfit-kompas://auth?state=" + state + "&d=" + "a".repeat(24001)]), null);
  assert.equal(h.auth.callback([link(state, { ...SESSION, access_token: "not a jwt" })]), null);
  assert.equal(h.auth.token(), "");
});

test("verified native identity is bound to the same account that minted the interview ticket", async () => {
  const h = harness();
  const state = h.auth.issueState();
  const payload = h.auth.callback([link(state)]);
  assert.equal(await h.auth.acceptCallback(payload, "owner-B"), false);
  assert.equal(h.auth.token(), "");
  assert.equal(h.auth.ownerId(), "");
  assert.equal(await h.auth.acceptCallback(payload, "owner-A"), true);
  assert.equal(h.auth.ownerId(), "owner-A");
});
test("OS-encrypted native profile restores the desktop family without a browser refresh", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  const restored = h.factory();
  assert.equal(restored.load(), true);
  assert.equal(restored.ownerId(), "owner-A");
  assert.equal(restored.token(), DESKTOP_ACCESS);
  assert.equal(restored.familyExpiresAt(), T0 + SESSION_MS);
});
test("a quiet renew inside the 24 hour window mints a fresh 3-day family", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  const before = h.getRefreshes();
  h.setClock(T0 + SESSION_MS - PROACTIVE_BEFORE_MS);
  assert.equal(await h.auth.renew(false), true);
  assert.equal(h.getRefreshes(), before + 1);
  assert.equal(h.requests.at(-1).body.refresh_token, "");
  assert.equal(h.requests.at(-1).options.headers.authorization, "Bearer " + DESKTOP_ACCESS);
  assert.equal(h.auth.familyExpiresAt(), T0 + SESSION_MS - PROACTIVE_BEFORE_MS + SESSION_MS);
});
test("a quiet renew with more than 24 hours left does not call the network", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  const before = h.getRefreshes();
  h.setClock(T0 + SESSION_MS - PROACTIVE_BEFORE_MS - 60_000);
  assert.equal(await h.auth.renew(false), true);
  assert.equal(h.getRefreshes(), before);
  assert.equal(h.auth.token(), DESKTOP_ACCESS);
});
test("inside the last 10 hours a failed reauth keeps the session and does not wipe it", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setClock(T0 + SESSION_MS - (10 * 60 * 60 * 1000) + 60_000);
  h.setStatus(503);
  assert.equal(await h.auth.renew(false), true);
  assert.equal(h.auth.hasSession(), true);
  assert.equal(stored(h).refresh_token, DESKTOP_REFRESH);
});
test("expired native access resumes from the desktop refresh for the same account", async () => {
  const h = harness();
  const state = h.auth.issueState();
  assert.equal(await h.auth.acceptCallback(h.auth.callback([link(state)])), true);
  h.setClock(2000000000000 + 10000);
  assert.equal(h.auth.token(), "");
  assert.equal(h.auth.ownerId(), "owner-A");
  assert.equal(await h.auth.renew(false), true);
  assert.equal(h.auth.ownerId(), "owner-A");
  assert.equal(h.auth.token(), DESKTOP_ACCESS);
  assert.equal(h.requests.at(-2).body.refresh_token, DESKTOP_REFRESH);
  assert.equal(h.requests.at(-1).body.refresh_token, "");
});
test("canonical Windows handoff retains the account-scoped session until validated", () => {
  const main = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "main.js"), "utf8");
  assert.match(main, /pendingSession\.ownerId/);
  assert.match(main, /desktopAuth\.ownerId\(\) !== pendingSession\.ownerId/);
  assert.match(main, /deliverSession\(\)/);
  assert.match(main, /server-attested/);
  assert.match(main, /for \(const key of \["token", "refreshToken", "tokenExp", "access_token", "refresh_token", "ownerId"\]\) delete verified\[key\]/);
  assert.match(main, /if \(desktopAuth\.hasSession\(\)\) return hideHandoff\(\);/);
  assert.equal(main.includes("desktopAuth.clear("), false);
});

test("native take-session IPC and webContents delivery share the same owner gate", () => {
  const main = require("node:fs").readFileSync(require("node:path").join(__dirname, "..", "main.js"), "utf8");
  assert.match(main, /function takeVerifiedSession\(\)/);
  assert.match(main, /desktopAuth\.ownerId\(\) !== pendingSession\.ownerId/);
  assert.match(main, /ipcMain\.handle\("kompas:take-session", \(event\) => \{/);
  assert.match(main, /const verified = takeVerifiedSession\(\)/);
  assert.match(main, /function deliverSession\(\) \{[\s\S]{0,180}takeVerifiedSession\(\)/);
  assert.match(main, /if \(u\.protocol === "marketfit-kompas:"\) return null/);
});
