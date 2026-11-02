"use strict";

// MarketFit-owned desktop auth. The website and Electron have separate session
// stores; a browser login does NOT authenticate the native protocol's API calls.
// No provider secret is embedded. Only the native main process owns credentials.
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const STATE_TTL = 10 * 60_000;

function createMarketFitDesktopAuth({ net, safeStorage, fs, profileDir, origin, now = Date.now }) {
  if (new URL(origin).protocol !== "https:") throw Error("MarketFit auth requires HTTPS");
  let access = "", refreshToken = "", expiresAt = 0, flight = null;
  const states = new Map();
  const file = () => path.join(profileDir(), "marketfit-auth.bin");
  const encrypted = () => !!safeStorage?.isEncryptionAvailable?.();
  const valid = (s) => !!s && typeof s === "object" &&
    typeof s.access_token === "string" && s.access_token.length <= 16384 &&
    JWT.test(s.access_token) &&
    typeof s.refresh_token === "string" && s.refresh_token.length > 0 &&
    s.refresh_token.length <= 16384 &&
    Number.isFinite(Number(s.expires_at)) && Number(s.expires_at) > 0;

  function persist() {
    if (!encrypted() || !refreshToken) return false;
    try {
      const bytes = safeStorage.encryptString(JSON.stringify({
        access_token: access, refresh_token: refreshToken, expires_at: expiresAt
      }));
      fs.mkdirSync(profileDir(), { recursive: true });
      fs.writeFileSync(file(), bytes, { mode: 0o600 });
      return true;
    } catch { return false; }
  }
  function clear() {
    access = ""; refreshToken = ""; expiresAt = 0;
    try { fs.rmSync(file(), { force: true }); } catch {}
  }
  function setTokens(s) {
    if (!valid(s)) return false;
    access = s.access_token;
    refreshToken = s.refresh_token;
    expiresAt = Number(s.expires_at) * 1000;
    persist();
    return true;
  }
  function load() {
    if (!encrypted()) return false; // Never load plaintext credentials.
    try {
      const s = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
      return setTokens(s);
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
      if (!state || !d || d.length > 24000 || states.get(state) <= now()) continue;
      // One use; callbacks from stale browser tabs cannot rotate identity.
      states.clear();
      try {
        const payload = JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
        return valid(payload) ? payload : null;
      } catch { return null; }
    }
    return null;
  }
  async function acceptCallback(payload) {
    if (!valid(payload)) return false;
    try {
      const result = await net.fetch(origin + "/api/auth/refresh", {
        method: "POST", headers: { authorization: "Bearer " + payload.access_token },
        redirect: "error", cache: "no-store"
      });
      if (!result.ok || (await result.json()).ok !== true) return false;
      return setTokens(payload);
    } catch { return false; }
  }
  async function renew(force = false) {
    if (!force && token() && expiresAt - now() > 10 * 60_000) return true;
    if (!refreshToken) return false;
    if (flight) return flight;
    flight = (async () => {
      try {
        const response = await net.fetch(origin + "/api/auth/refresh-token", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }), redirect: "error",
          cache: "no-store"
        });
        if (response.status === 401) { clear(); return false; }
        // Offline, rate limits, transient billing or provider outages are NOT logout.
        if (!response.ok) return false;
        const payload = await response.json();
        return payload?.ok === true && setTokens(payload);
      } catch { return false; }
    })();
    try { return await flight; } finally { flight = null; }
  }
  return { token, load, clear, issueState, callback, acceptCallback, renew };
}
module.exports = { createMarketFitDesktopAuth };
