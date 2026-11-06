"use strict";

// MarketFit desktop auth. Chrome and this process do not share a refresh
// family. The browser hands over a short-lived bearer only. This process
// opens its own session at POST /api/auth/desktop-session, stores that
// refresh token, and renews only that token. A website tab rotating the
// cookie family never presents it. A failed renewal does not delete the
// stored session and does not ask the shell to show a login window.
const { randomBytes } = require("node:crypto");
const path = require("node:path");
const JWT = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;
const STATE_TTL = 10 * 60_000;
const SESSION_MS = 3 * 24 * 60 * 60 * 1000;
const PROACTIVE_BEFORE_MS = 24 * 60 * 60 * 1000;
const PROACTIVE_DEADLINE_MS = 10 * 60 * 60 * 1000;
const ACCESS_LEAD_MS = 15 * 60 * 1000;
const validOwner = s => typeof s === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(s);

function proactiveReauthDue(now, familyExpiresAt) {
  if (!Number.isFinite(familyExpiresAt) || familyExpiresAt <= 0) return false;
  return familyExpiresAt - now <= PROACTIVE_BEFORE_MS;
}

function proactiveReauthInWindow(now, familyExpiresAt) {
  if (!Number.isFinite(familyExpiresAt) || familyExpiresAt <= 0) return false;
  const remain = familyExpiresAt - now;
  return remain <= PROACTIVE_BEFORE_MS && remain >= PROACTIVE_DEADLINE_MS;
}

function createMarketFitDesktopAuth({ net, safeStorage, fs, profileDir, origin, now = Date.now }) {
  if (new URL(origin).protocol !== "https:") throw Error("MarketFit auth requires HTTPS");
  let access = "", refresh = "", owner = "", expiresAt = 0, familyExpiresAt = 0, flight = null;
  const states = new Map();
  const file = () => path.join(profileDir(), "marketfit-auth.bin");
  const encrypted = () => !!safeStorage?.isEncryptionAvailable?.();
  const validAccess = (s) => !!s && typeof s === "object" &&
    typeof s.access_token === "string" && s.access_token.length <= 16384 &&
    JWT.test(s.access_token) &&
    Number.isFinite(Number(s.expires_at)) && Number(s.expires_at) > 0;
  const liveAccess = () => !!(access && expiresAt > now() + 1000);

  function persist() {
    if (!encrypted() || (!access && !refresh)) return false;
    try {
      const bytes = safeStorage.encryptString(JSON.stringify({
        access_token: access,
        refresh_token: refresh,
        expires_at: expiresAt > 0 ? Math.floor(expiresAt / 1000) : 0,
        family_expires_at: familyExpiresAt,
        ownerId: owner,
      }));
      fs.mkdirSync(profileDir(), { recursive: true });
      fs.writeFileSync(file(), bytes, { mode: 0o600 });
      return true;
    } catch { return false; }
  }
  function clear() {
    access = ""; refresh = ""; owner = ""; expiresAt = 0; familyExpiresAt = 0;
    try { fs.rmSync(file(), { force: true }); } catch {}
  }
  function hasSession() {
    return validOwner(owner) && (!!refresh || liveAccess());
  }
  function adopt(body, resetFamily) {
    if (!body || body.ok !== true || body.session !== "desktop" || !validAccess(body)) return false;
    if (typeof body.refresh_token !== "string" || !body.refresh_token || body.refresh_token.length > 4096) return false;
    const userId = typeof body.user_id === "string" && validOwner(body.user_id) ? body.user_id : owner;
    if (!validOwner(userId)) return false;
    access = body.access_token;
    refresh = body.refresh_token;
    owner = userId;
    expiresAt = Number(body.expires_at) * 1000;
    if (resetFamily || !familyExpiresAt) familyExpiresAt = now() + SESSION_MS;
    persist();
    return true;
  }
  function load() {
    if (!encrypted()) return false;
    try {
      const s = JSON.parse(safeStorage.decryptString(fs.readFileSync(file())));
      if (!validOwner(s.ownerId)) return false;
      owner = s.ownerId;
      refresh = typeof s.refresh_token === "string" && s.refresh_token.length <= 4096 ? s.refresh_token : "";
      familyExpiresAt = Number.isFinite(Number(s.family_expires_at)) ? Number(s.family_expires_at) : 0;
      if (validAccess(s)) {
        access = s.access_token;
        expiresAt = Number(s.expires_at) * 1000;
      } else {
        access = "";
        expiresAt = 0;
      }
      return hasSession();
    } catch { return false; }
  }
  function token() {
    return liveAccess() ? access : "";
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
      states.clear();
      try {
        const payload = JSON.parse(Buffer.from(d, "base64url").toString("utf8"));
        return validAccess(payload) ? payload : null;
      } catch { return null; }
    }
    return null;
  }
  async function postSession(refreshToken, bearer) {
    const headers = { "content-type": "application/json" };
    if (bearer) headers.authorization = "Bearer " + bearer;
    const response = await net.fetch(origin + "/api/auth/desktop-session", {
      method: "POST",
      headers,
      body: JSON.stringify({ refresh_token: refreshToken }),
      redirect: "error",
      cache: "no-store",
    });
    let json = null;
    try { json = await response.json(); } catch { json = null; }
    return { ok: response.ok, status: response.status, json };
  }
  async function acceptCallback(payload, expectedOwner = "") {
    if (!validAccess(payload)) return false;
    // payload.refresh_token belongs to Chrome. It is never sent or stored.
    try {
      const result = await postSession("", payload.access_token);
      if (!result.ok || !result.json) return false;
      const userId = result.json.user_id;
      if (!validOwner(userId) || (expectedOwner && userId !== expectedOwner)) return false;
      return adopt(result.json, true);
    } catch { return false; }
  }
  async function runRenew(forced) {
    try {
      if (!liveAccess() && refresh) {
        const rotated = await postSession(refresh, "");
        if (!rotated.ok || !adopt(rotated.json, false)) return false;
      }
      const due = proactiveReauthDue(now(), familyExpiresAt) || (!familyExpiresAt && liveAccess());
      if (due && liveAccess()) {
        const minted = await postSession("", access);
        if (minted.ok && adopt(minted.json, true)) return true;
        return liveAccess();
      }
      const lead = liveAccess() && expiresAt - now() <= ACCESS_LEAD_MS;
      if ((forced || lead) && refresh) {
        const rotated = await postSession(refresh, liveAccess() ? access : "");
        if (rotated.ok && adopt(rotated.json, false)) return true;
        return false;
      }
      return liveAccess();
    } catch { return false; }
  }
  async function renew(force = false) {
    const forced = force === true || force === "rejected";
    if (!hasSession()) return false;
    const due = proactiveReauthDue(now(), familyExpiresAt) || (!familyExpiresAt && liveAccess());
    const lead = liveAccess() && expiresAt - now() <= ACCESS_LEAD_MS;
    if (!forced && liveAccess() && !due && !lead) return true;
    if (flight) return flight;
    flight = runRenew(forced);
    try { return await flight; } finally { flight = null; }
  }
  return {
    token, ownerId: () => owner, hasSession, load, clear, issueState, callback, acceptCallback, renew,
    familyExpiresAt: () => familyExpiresAt,
  };
}

module.exports = {
  createMarketFitDesktopAuth,
  SESSION_MS,
  PROACTIVE_BEFORE_MS,
  PROACTIVE_DEADLINE_MS,
  ACCESS_LEAD_MS,
  proactiveReauthDue,
  proactiveReauthInWindow,
};
