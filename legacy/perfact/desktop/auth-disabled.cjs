"use strict";

// Desktop follows the website's /api/kompas/capabilities.authDisabled flag.
// Eshwar requires skip-login. Do not change without his confirmation in Grok Bot chat.
// AUTH_DISABLED / NEXT_PUBLIC_AUTH_DISABLED / KOMPAS_AUTH_DISABLED force the
// Chrome sign-in only when the value is exactly "off-confirmed-by-eshwar".
// "false", empty, and unset do not. Skip when the server returns authDisabled === true.
// One request at startup; no polling.
const CAPABILITIES_TIMEOUT_MS = 4000;

function envForcesSignIn(env = process.env) {
  const raw = env.AUTH_DISABLED ?? env.NEXT_PUBLIC_AUTH_DISABLED ?? env.KOMPAS_AUTH_DISABLED;
  return raw === "off-confirmed-by-eshwar";
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

function shouldRecoverSignInFrom401({ skipActive, alreadyRecovered, serverSaidAuthDisabled } = {}) {
  // When the server said auth is disabled, never show the Chrome sign-in card.
  if (serverSaidAuthDisabled) return false;
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
