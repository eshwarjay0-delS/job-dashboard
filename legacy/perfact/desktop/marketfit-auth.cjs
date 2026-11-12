"use strict";

// MarketFit desktop auth. Chrome and this process do not share a refresh
// family. The browser hands over a short-lived bearer only. This process
// opens its own session at POST /api/auth/desktop-session, stores that
// refresh token, and renews only that token. A website tab rotating the
// cookie family never presents it. A failed renewal does not delete the
// stored session and does not ask the shell to show a login window.
const { randomBytes, createCipheriv, createDecipheriv } = require("node:crypto");
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
  let access = "", refresh = "", owner = "", expiresAt = 0, familyExpiresAt = 0, flight = null, notice = null;
  const EGRESS_MESSAGE = "Supabase Auth is blocked because this project exceeded its egress quota (HTTP 402). Sign-in will work again once Auth is reachable. This app cannot raise the spend cap.";
  const SIGNED_OUT_MESSAGE = "Your session ended. Sign in again to start a session.";
  const states = new Map();
  const file = () => path.join(profileDir(), "marketfit-auth.bin");
  const encrypted = () => !!safeStorage?.isEncryptionAvailable?.();
  const validAccess = (s) => !!s && typeof s === "object" &&
    typeof s.access_token === "string" && s.access_token.length <= 16384 &&
    JWT.test(s.access_token) &&
    Number.isFinite(Number(s.expires_at)) && Number(s.expires_at) > 0;
  const liveAccess = () => !!(access && expiresAt > now() + 1000);

  const keyFile = () => path.join(profileDir(), "marketfit-auth.key");
  function persist() {
    if (!access && !refresh) return false;
    const json = JSON.stringify({
      access_token: access,
      refresh_token: refresh,
      expires_at: expiresAt > 0 ? Math.floor(expiresAt / 1000) : 0,
      family_expires_at: familyExpiresAt,
      ownerId: owner,
    });
    try {
      fs.mkdirSync(profileDir(), { recursive: true });
      if (encrypted()) {
        fs.writeFileSync(file(), safeStorage.encryptString(json), { mode: 0o600 });
        return true;
      }
      // OS keychain unavailable: AES-256-GCM file in userData. The key stays
      // beside it, mode 0600. This is what survives a restart when safeStorage
      // reports that encryption is off. It is not localStorage.
      let key = null;
      try { key = fs.readFileSync(keyFile()); } catch { key = null; }
      if (!key || key.length !== 32) {
        key = randomBytes(32);
        fs.writeFileSync(keyFile(), key, { mode: 0o600 });
      }
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const body = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
      const packed = Buffer.concat([Buffer.from("AE1"), iv, cipher.getAuthTag(), body]);
      fs.writeFileSync(file(), packed, { mode: 0o600 });
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
  function readStored() {
    const bytes = fs.readFileSync(file());
    if (Buffer.isBuffer(bytes) && bytes.slice(0, 3).toString() === "AE1") {
      const key = fs.readFileSync(keyFile());
      const iv = bytes.subarray(3, 15);
      const tag = bytes.subarray(15, 31);
      const body = bytes.subarray(31);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);
      return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString("utf8"));
    }
    if (!encrypted()) return null;
    return JSON.parse(safeStorage.decryptString(bytes));
  }
  function load() {
    try {
      const s = readStored();
      if (!s || !validOwner(s.ownerId)) return false;
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
          [...u.searchParams.keys()].some(k => !["state", "d", "code"].includes(k))) continue;
      const code = u.searchParams.get("code");
      const stateForCode = u.searchParams.get("state");
      if (code && /^[A-Za-z0-9_-]{43}$/.test(code) && stateForCode && /^[A-Za-z0-9_-]{20,128}$/.test(stateForCode)) {
        if (states.size && (!states.has(stateForCode) || states.get(stateForCode) <= now())) continue;
        return { kind: "code", code, state: stateForCode };
      }
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
  function setNotice(code, message) {
    notice = code ? { code, message } : null;
  }
  function renewalOutcome(result) {
    const body = result && result.json || {};
    const hay = [body.error, body.error_description, body.message, body.code].filter(Boolean).join(" ").toLowerCase();
    const status = Number(result && result.status);
    if (result && result.ok && body.ok === true) return "ok";
    if (status === 402 || body.error === "egress_quota" || /exceed_egress|egress quota|exceeded egress/.test(hay)) return "egress";
    if (!result || status === 0 || status >= 500 || body.error === "issuer_unavailable" || /issuer_unavailable|fetch failed|network|timeout|econnrefused|enotfound/.test(hay)) return "unavailable";
    if (status === 401 && /already used|already_used/.test(hay)) return "already_used";
    if (status === 401 && (body.error === "revoked" || body.error === "signed_out" || /revok|not found|invalid refresh token|signed_out|refresh_token_not_found|session_not_found/.test(hay))) return "signed_out";
    return "rejected";
  }
  function applyOutcome(result) {
    const outcome = renewalOutcome(result);
    if (outcome === "ok") { setNotice(null); return outcome; }
    if (outcome === "signed_out") { clear(); setNotice("signed_out", SIGNED_OUT_MESSAGE); return outcome; }
    if (outcome === "egress") { setNotice("egress_quota", EGRESS_MESSAGE); return outcome; }
    return outcome;
  }
  async function exchangeCode(code, nonce) {
    if (typeof code !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(code)) return false;
    if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(nonce)) return false;
    try {
      const response = await net.fetch(origin + "/api/auth/desktop-code/exchange", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, nonce }),
        redirect: "error",
        cache: "no-store",
      });
      let json = null;
      try { json = await response.json(); } catch { json = null; }
      if (!response.ok || !json) return false;
      return adopt(json, true);
    } catch { return false; }
  }
  async function pollCode(nonce) {
    if (typeof nonce !== "string" || !/^[A-Za-z0-9_-]{20,128}$/.test(nonce)) return "";
    try {
      const response = await net.fetch(origin + "/api/auth/desktop-code?nonce=" + encodeURIComponent(nonce), {
        method: "GET",
        cache: "no-store",
        redirect: "error",
      });
      let json = null;
      try { json = await response.json(); } catch { json = null; }
      if (!response.ok || !json || json.status !== "ready" || typeof json.code !== "string") return "";
      return json.code;
    } catch { return ""; }
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
        const outcome = applyOutcome(rotated);
        if (outcome !== "ok" || !adopt(rotated.json, false)) return false;
      }
      if (!hasSession()) return false;
      const due = proactiveReauthDue(now(), familyExpiresAt) || (!familyExpiresAt && liveAccess());
      if (due && liveAccess()) {
        const minted = await postSession("", access);
        const outcome = applyOutcome(minted);
        if (outcome === "ok" && adopt(minted.json, true)) return true;
        if (outcome === "signed_out") return false;
        return liveAccess();
      }
      const lead = liveAccess() && expiresAt - now() <= ACCESS_LEAD_MS;
      if ((forced || lead) && refresh) {
        const rotated = await postSession(refresh, liveAccess() ? access : "");
        const outcome = applyOutcome(rotated);
        if (outcome === "ok" && adopt(rotated.json, false)) return true;
        return false;
      }
      if (liveAccess()) setNotice(null);
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
  function millisecondsUntilRefresh() {
    if (!hasSession()) return null;
    const t = now();
    const waits = [];
    if (expiresAt > 0) waits.push(expiresAt - ACCESS_LEAD_MS - t);
    if (familyExpiresAt > 0) waits.push(familyExpiresAt - PROACTIVE_BEFORE_MS - t);
    if (!waits.length) return null;
    const delay = Math.min.apply(null, waits);
    if (delay <= 0) return 0;
    return Math.min(delay, 2147483647);
  }
  return {
    token, ownerId: () => owner, hasSession, load, clear, issueState, callback, acceptCallback, renew,
    exchangeCode, pollCode, millisecondsUntilRefresh, authNotice: () => notice,
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
