"use strict";

// MarketFit-owned desktop auth. The website and Electron have separate session
// stores; a browser login does NOT authenticate the native protocol's API calls.
// No provider secret is embedded. The main process holds only an access JWT.
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const STATE_TTL = 10 * 60_000;
const validOwner = s => typeof s === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(s);

function createMarketFitDesktopAuth({ net, safeStorage, fs, profileDir, origin, now = Date.now }) {
  if (new URL(origin).protocol !== "https:") throw Error("MarketFit auth requires HTTPS");
  let access = "", refresh = "", owner = "", expiresAt = 0, flight = null;
  const states = new Map();
  const file = () => path.join(profileDir(), "marketfit-auth.bin");
  const encrypted = () => !!safeStorage?.isEncryptionAvailable?.();
  const valid = (s) => !!s && typeof s === "object" &&
    typeof s.access_token === "string" && s.access_token.length <= 16384 &&
    JWT.test(s.access_token) &&
    Number.isFinite(Number(s.expires_at)) && Number(s.expires_at) > 0;

  function persist() {
    if (!encrypted() || !access) return false;
    try {
      const bytes = safeStorage.encryptString(JSON.stringify({
        access_token: access, refresh_token: refresh, expires_at: expiresAt, ownerId: owner
      }));
      fs.mkdirSync(profileDir(), { recursive: true });
      fs.writeFileSync(file(), bytes, { mode: 0o600 });
      return true;
    } catch { return false; }
  }
  const validGrant = (payload) => payload && typeof payload === "object" &&
    typeof payload.token_hash === "string" && /^[a-f0-9]{64}$/.test(payload.token_hash);
  function clear() {
    access = ""; refresh = ""; owner = ""; expiresAt = 0;
    try { fs.rmSync(file(), { force: true }); } catch {}
  }
  function setTokens(s, verifiedOwner) {
    if (!valid(s) || !validOwner(verifiedOwner)) return false;
    access = s.access_token;
    refresh = typeof s.refresh_token === "string" && s.refresh_token.length <= 16384 ? s.refresh_token : "";
    owner = verifiedOwner;
    expiresAt = Number(s.expires_at) * 1000;
    persist();
    return true;
  }
  function load() {
    if (!encrypted()) return false; // Never load plaintext credentials.
    try {
      const s = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
      return setTokens(s, s.ownerId);
    } catch { return false; }
  }
  function token() {
    return access && expiresAt > now() + 1000 ? access : "";
  }
  function issueState() {
    for (const [s, expiry] of states) if (expiry <= now()) states.delete(s);
    while (states.size >= 4) states.delete(states.keys().next().value);
    const state = randomBytes(32).toString("base64url");
    states.set(state, now() + STATE_TTL);
    return state;
  }
  function callback(argv) {
    for (const arg of argv || []) {
      if (typeof arg !== "string" || arg.length > 32768) continue;
      let u;
      try { u = new URL(arg); } catch { continue; }
      if (!["kompas:", "marketfit-kompas:"].includes(u.protocol) ||
          u.hostname !== "auth" || (u.pathname && u.pathname !== "/") ||
          u.username || u.password ||
          [...u.searchParams.keys()].some(k => !["state", "d"].includes(k))) continue;
      const state = u.searchParams.get("state"), d = u.searchParams.get("d");
      if (!state || !states.has(state) || !d || d.length > 24000 || states.get(state) <= now()) continue;
      // One use; callbacks from stale browser tabs cannot rotate identity.
      states.clear();
      try {
        const payload = JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
        return valid(payload) || validGrant(payload) ? payload : null;
      } catch { return null; }
    }
    return null;
  }
  async function acceptCallback(payload, expectedOwner = "") {
    if (validGrant(payload)) {
      // The server issues a one-time Supabase OTP proof from an authenticated
      // Chrome session. Redeeming it creates a separate native refresh family,
      // so the desktop never rotates Chrome's cookie refresh token.
      try {
        const response = await net.fetch(origin + "/api/auth/desktop-session/redeem", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ token_hash: payload.token_hash }),
          cache: "no-store", redirect: "error",
        });
        if (!response.ok) return false;
        const result = await response.json();
        if (result?.ok !== true || !validOwner(result.userId) ||
            (expectedOwner && result.userId !== expectedOwner) ||
            !valid(result) || typeof result.refresh_token !== "string" ||
            result.refresh_token.length < 1 || result.refresh_token.length > 16384) return false;
        return setTokens(result, result.userId);
      } catch { return false; }
    }
    // Legacy bearer-only callback remains accepted for installed older shells,
    // but it is NOT a durable trusted-device session.
    if (!valid(payload)) return false;
    try {
      const result = await net.fetch(origin + "/api/auth/refresh", {
        method: "POST", headers: { authorization: "Bearer " + payload.access_token },
        redirect: "error", cache: "no-store"
      });
      if (!result.ok) return false;
      const verified = await result.json();
      if (verified?.ok !== true || !validOwner(verified.userId) ||
          (expectedOwner && verified.userId !== expectedOwner)) return false;
      // Do not import a browser refresh token, even if a malformed/older
      // callback supplied one.
      return setTokens({ access_token: payload.access_token, expires_at: payload.expires_at }, verified.userId);
    } catch { return false; }
  }

  // OS-trusted device: retain its independently minted refresh family, rotate
  // it before expiry and keep the bearer private to Electron's main process.
  // Network failures do not erase stored credentials or interrupt an interview.
  async function renew(force = false) {
    if (!force && token() && expiresAt > now() + 120000) return true;
    if (flight) return flight;
    flight = (async () => {
      if (refresh) {
        try {
          const response = await net.fetch(origin + "/api/auth/refresh-token", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ refresh_token: refresh }),
            cache: "no-store", redirect: "error",
          });
          if (response.status === 401) { clear(); return false; }
          if (!response.ok) return !!token(); // retain credentials on a transient outage
          const next = await response.json();
          if (next?.ok !== true || next.userId !== owner ||
              !valid(next) || typeof next.refresh_token !== "string" ||
              !next.refresh_token || next.refresh_token.length > 16384) {
            clear(); return false; // account mismatch or invalid renewal
          }
          return setTokens(next, owner);
        } catch { return !!token(); }
      }
      if (!token()) return false;
      if (!force) return true;
      try {
        const response = await net.fetch(origin + "/api/auth/refresh", {
          method: "POST", headers: { authorization: "Bearer " + access },
          cache: "no-store", redirect: "error"
        });
        if (response.status === 401) { clear(); return false; }
        if (!response.ok) return false;
        const verified = await response.json();
        if (verified?.ok === true && verified.userId === owner) return true;
        clear();
        return false;
      } catch { return false; }
    })();
    try { return await flight; } finally { flight = null; }
  }
  return { token, ownerId:()=>owner, load, clear, issueState, callback, acceptCallback, renew };
}
module.exports = { createMarketFitDesktopAuth };
