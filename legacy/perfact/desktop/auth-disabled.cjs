"use strict";

// Same reversible switch as the website (src/lib/authDisabled.ts). Unset means
// no login, so a new exe ships without a config change. Set AUTH_DISABLED,
// NEXT_PUBLIC_AUTH_DISABLED, or KOMPAS_AUTH_DISABLED to "false" to restore
// today's Chrome sign-in and token mint/refresh.
function isAuthDisabled(env = process.env) {
  const raw = env.AUTH_DISABLED ?? env.NEXT_PUBLIC_AUTH_DISABLED ?? env.KOMPAS_AUTH_DISABLED;
  if (raw == null || String(raw).trim() === "") return true;
  const value = String(raw).trim().toLowerCase();
  return value !== "false" && value !== "0" && value !== "off" && value !== "no";
}

module.exports = { isAuthDisabled };
