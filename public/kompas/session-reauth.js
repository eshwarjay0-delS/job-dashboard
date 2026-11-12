"use strict";

// What to do after a session start meets a dead sign-in.
// A live interview never opens Chrome or the login page.
// HTTP 402 from Supabase egress is explained and is not treated as a logout.
// A valid desktop session (hasSession true) is left in place, including the
// 3-day family and an already-used refresh race.
const AUTH_EGRESS_BLOCKED = "Supabase Auth is blocked because this project exceeded its egress quota (HTTP 402). Sign-in will work again once Auth is reachable. This app cannot raise the spend cap.";
const AUTH_SIGNED_OUT = "Your session ended. Sign in again to start a session.";
const AUTH_UNAVAILABLE = "MarketFit could not reach the sign-in service. Nothing was signed out. Return to Kompas and try again.";
const NOT_READY = "Session has not started. The answer service is not ready. Check again before starting.";

function decideSessionStart(input) {
  const src = input || {};
  const httpStatus = Number(src.httpStatus) || 0;
  const refreshStatus = Number(src.refreshStatus) || 0;
  const hay = [src.code, src.message, src.refreshCode, src.noticeCode].map(v => String(v || "")).join(" ").toLowerCase();
  const egress = src.noticeCode === "egress_quota" || src.code === "exceed_egress_quota" || src.refreshCode === "exceed_egress_quota" || /exceed_egress|egress quota|exceeded egress/.test(hay);
  if (egress) return { action: "explain", egress: true, autoSignIn: false, message: AUTH_EGRESS_BLOCKED };
  if (src.interviewLive) return { action: "wait", egress: false, autoSignIn: false, message: "" };
  if (httpStatus === 200 && src.ready === true) return { action: "proceed", egress: false, autoSignIn: false, message: "" };
  const refreshFailed = src.refreshAttempted === true && src.refreshOk !== true;
  const refreshUnreachable = refreshFailed && (refreshStatus === 0 || refreshStatus === 503 || refreshStatus >= 500);
  if (httpStatus === 503 || refreshUnreachable || /sign_in_unavailable|issuer_unavailable/.test(hay)) {
    return { action: "explain", egress: false, autoSignIn: false, message: AUTH_UNAVAILABLE };
  }
  const signedOut = src.noticeCode === "signed_out" || src.noticeCode === "revoked" || src.refreshCode === "signed_out" || src.refreshCode === "revoked" || src.code === "signed_out";
  // The desktop still holds a token it did not classify as logged out. That
  // includes a valid 3-day family and an already-used refresh race.
  if (src.hasSession === true && src.noticeCode !== "signed_out" && src.noticeCode !== "revoked") {
    return { action: "explain", egress: false, autoSignIn: false, message: NOT_READY };
  }
  const failedAuth = httpStatus === 401 && refreshFailed && refreshStatus === 401;
  if (!src.interviewLive && (signedOut || (failedAuth && src.hasSession !== true))) {
    return { action: "sign_in", egress: false, autoSignIn: true, message: AUTH_SIGNED_OUT };
  }
  return { action: "explain", egress: false, autoSignIn: false, message: NOT_READY };
}

const api = { AUTH_EGRESS_BLOCKED, AUTH_SIGNED_OUT, AUTH_UNAVAILABLE, NOT_READY, decideSessionStart };
if (typeof module === "object" && module.exports) module.exports = api;
globalThis.KompasSessionReauth = api;
