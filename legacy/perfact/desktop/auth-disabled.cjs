"use strict";

// Desktop follows the website's /api/kompas/capabilities.authDisabled flag.
// A local default never skips sign-in on its own: production today still
// requires login, and origin/master does not send this field.
// AUTH_DISABLED / NEXT_PUBLIC_AUTH_DISABLED / KOMPAS_AUTH_DISABLED='false'
// forces today's Chrome sign-in. Skip only when the server returns
// authDisabled === true. One request at startup; no polling.
const CAPABILITIES_TIMEOUT_MS = 4000;

function envForcesSignIn(env = process.env) {
  const raw = env.AUTH_DISABLED ?? env.NEXT_PUBLIC_AUTH_DISABLED ?? env.KOMPAS_AUTH_DISABLED;
  if (raw == null || String(raw).trim() === "") return false;
  const value = String(raw).trim().toLowerCase();
  return value === "false" || value === "0" || value === "off" || value === "no";
}

// Strict: only the boolean true from the server lifts login. Missing, false,
// or any other value keeps today's sign-in (the production capabilities body
// has no authDisabled field).
function authDisabledFromCapabilities(body) {
  return !!(body && typeof body === "object" && body.authDisabled === true);
}

function shouldSkipSignIn({ env = process.env, body = undefined, error = false } = {}) {
  if (envForcesSignIn(env)) return false;
  if (error) return false;
  return authDisabledFromCapabilities(body);
}

function shouldRecoverSignInFrom401({ skipActive, alreadyRecovered } = {}) {
  return !!skipActive && !alreadyRecovered;
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("capabilities-timeout")), ms);
    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (err) => { clearTimeout(timer); reject(err); },
    );
  });
}

async function readServerAuthDisabled({ origin, fetch, timeoutMs = CAPABILITIES_TIMEOUT_MS, env = process.env } = {}) {
  if (envForcesSignIn(env)) return false;
  if (typeof fetch !== "function" || !origin) return false;
  try {
    const response = await withTimeout(fetch(String(origin).replace(/\/+$/, "") + "/api/kompas/capabilities", {
      method: "GET",
      cache: "no-store",
      redirect: "error",
    }), timeoutMs);
    if (!response || !response.ok) return false;
    let body = null;
    try { body = await response.json(); } catch { return false; }
    return shouldSkipSignIn({ env, body });
  } catch {
    return false;
  }
}

module.exports = {
  CAPABILITIES_TIMEOUT_MS,
  envForcesSignIn,
  authDisabledFromCapabilities,
  shouldSkipSignIn,
  shouldRecoverSignInFrom401,
  readServerAuthDisabled,
};
