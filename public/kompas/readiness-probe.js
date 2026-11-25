"use strict";
// Readiness is a short probe. It never decides whether Start may run.
// A timeout, a 4xx, a 5xx, a cross-origin desktop origin, or a slow cold
// start all still start. The answer request uses the existing fallback chain.
(() => {
const NOT_READY = "Session has not started. The answer service is not ready. Check again before starting.";
const DEFAULT_TIMEOUT_MS = 1800;
const DEFAULT_BACKOFF_MS = [250, 700];
const COLD_MS = 1200;

function classifyProbe(input) {
  const src = input || {};
  const status = Number(src.status) || 0;
  const elapsedMs = Number(src.elapsedMs) || 0;
  const origin = String(src.origin || "");
  const desktopOrigin = /^kompas:/i.test(origin) || src.crossOrigin === true;
  const timedOut = src.timedOut === true;
  const readyHttp = status >= 200 && status < 300;
  const ready = readyHttp && src.ready === true && !timedOut;
  let reason = "ok";
  if (timedOut) reason = "timeout";
  else if (status >= 500) reason = "5xx";
  else if (status >= 400) reason = "4xx";
  else if (status === 0 && desktopOrigin) reason = "cross-origin";
  else if (status === 0) reason = "cross-origin";
  else if (src.cold === true || (readyHttp && elapsedMs >= COLD_MS)) reason = "cold";
  const failed = timedOut || status === 0 || status >= 400;
  const recheck = src.recheck === true;
  return {
    start: true,
    ready,
    fallback: !ready,
    banner: recheck || !failed ? "" : NOT_READY,
    reason,
    desktopOrigin,
    elapsedMs,
    status,
  };
}

function sleep(ms, custom) {
  if (typeof custom === "function") return Promise.resolve(custom(ms));
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probeReadiness(fetchImpl, opts) {
  const options = opts || {};
  const timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : DEFAULT_TIMEOUT_MS;
  const backoff = Array.isArray(options.backoff) ? options.backoff : DEFAULT_BACKOFF_MS;
  const attempts = Math.max(1, 1 + backoff.length);
  let last = { status: 0, ready: false, elapsedMs: 0, timedOut: true };
  for (let i = 0; i < attempts; i++) {
    if (i > 0) await sleep(Number(backoff[i - 1]) || 0, options.sleep);
    const started = typeof options.now === "function" ? options.now() : Date.now();
    try {
      const res = await fetchImpl({ timeoutMs, attempt: i });
      const ended = typeof options.now === "function" ? options.now() : Date.now();
      const body = res && res.body && typeof res.body === "object" ? res.body : {};
      const status = Number(res && res.status) || 0;
      last = {
        status,
        ready: res && res.ready === true || body.ready === true,
        elapsedMs: Math.max(0, ended - started),
        timedOut: false,
        cold: !!(res && res.cold),
      };
      if (last.ready && status >= 200 && status < 300) break;
      if (status >= 400 && status < 500 && status !== 408 && status !== 429) break;
    } catch (err) {
      const ended = typeof options.now === "function" ? options.now() : Date.now();
      const name = err && err.name;
      const message = String((err && err.message) || err || "");
      last = {
        status: 0,
        ready: false,
        elapsedMs: Math.max(0, ended - started),
        timedOut: name === "TimeoutError" || name === "AbortError" || /timeout|aborted/i.test(message),
      };
    }
  }
  return classifyProbe({
    ...last,
    origin: options.origin || "",
    crossOrigin: options.crossOrigin === true,
    recheck: options.recheck === true,
  });
}

const api = { NOT_READY, DEFAULT_TIMEOUT_MS, DEFAULT_BACKOFF_MS, COLD_MS, classifyProbe, probeReadiness };
if (typeof module === "object" && module.exports) module.exports = api;
globalThis.KompasReadiness = api;
})();
