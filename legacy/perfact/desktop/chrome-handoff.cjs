"use strict";

// First-run Chrome handoff for a desktop that has no session yet.
// A stored session never reaches this screen. The return address is
// http://127.0.0.1:<port>/cb so the already-open window continues.
// The state nonce is a query parameter only. It is not painted.
const http = require("node:http");

const TITLE = "Sign in with Chrome";
const BODY = "Chrome is opening MarketFit. The Google sign-in already in that browser is used, and this window continues from there.";
const RETRY = "Open Chrome again";
const LOOPBACK_PAGE = "<!doctype html><meta charset=\"utf-8\"><title>MarketFit</title><p>Kompas has the sign-in. You can close this tab.</p>";

function handoffAction({ hasSession, interactive, alreadyAttempted }) {
  if (hasSession) return { show: false, openChrome: false, silent: true };
  if (!interactive && alreadyAttempted) return { show: true, openChrome: false, silent: false };
  return { show: true, openChrome: true, silent: false };
}

function chromeHandoffUrl(origin, state, loopback) {
  let base;
  try { base = new URL(origin); } catch { throw Error("https origin required"); }
  if (base.protocol !== "https:") throw Error("https origin required");
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(state)) throw Error("bad state");
  if (!/^http:\/\/127\.0\.0\.1:(\d+)\/cb$/.test(loopback)) throw Error("bad loopback");
  const port = Number(loopback.slice("http://127.0.0.1:".length, -"/cb".length));
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw Error("bad loopback");
  const url = new URL("/auth/desktop", base.origin);
  url.searchParams.set("state", state);
  url.searchParams.set("loopback", loopback);
  url.searchParams.set("handoff", "start");
  return url.toString();
}

function protocolArgFromLoopback(handed) {
  const state = handed && typeof handed.state === "string" ? handed.state : "";
  const d = handed && typeof handed.d === "string" ? handed.d : "";
  if (!/^[A-Za-z0-9_-]{20,128}$/.test(state)) return "";
  if (!d || d.length > 24000 || !/^[A-Za-z0-9_-]+$/.test(d)) return "";
  return "marketfit-kompas://auth?state=" + state + "&d=" + d;
}

function handoffPanelInnerHtml() {
  return [
    "<div style=\"width:min(440px,100%)\">",
    "<h1 id=\"kompas-chrome-handoff-title\" style=\"font-size:28px;line-height:1.25;margin:0 0 12px;font-weight:700\">",
    TITLE,
    "</h1>",
    "<p style=\"font-size:16px;line-height:1.5;margin:0 0 20px\">",
    BODY,
    "</p>",
    "<button type=\"button\" id=\"kompas-chrome-handoff-retry\" style=\"min-height:44px;padding:10px 16px;border-radius:10px;border:1px solid #1c1b16;background:#fff;color:#16140f;font:600 15px/1.2 system-ui,sans-serif;cursor:pointer\">",
    RETRY,
    "</button>",
    "</div>",
  ].join("");
}

function visibleHandoffText(html) {
  return String(html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function handoffPaintScript(mode) {
  if (mode === "hide") {
    return "(() => { const n = document.getElementById('kompas-chrome-handoff'); if (n) n.remove(); })()";
  }
  const html = JSON.stringify(handoffPanelInnerHtml());
  return "(() => {" +
    "let root = document.getElementById('kompas-chrome-handoff');" +
    "if (!root) {" +
    "root = document.createElement('div');" +
    "root.id = 'kompas-chrome-handoff';" +
    "root.setAttribute('role','dialog');" +
    "root.setAttribute('aria-modal','true');" +
    "root.setAttribute('aria-labelledby','kompas-chrome-handoff-title');" +
    "root.style.cssText = 'position:fixed;inset:0;z-index:400;display:grid;place-items:center;background:#f7f4ee;color:#16140f;font-family:system-ui,sans-serif;padding:32px;box-sizing:border-box;overflow:auto';" +
    "document.body.appendChild(root);" +
    "}" +
    "root.innerHTML = " + html + ";" +
    "const button = document.getElementById('kompas-chrome-handoff-retry');" +
    "if (button) button.addEventListener('click', () => {" +
    "const bridge = window.kompasDesktop;" +
    "if (bridge && typeof bridge.retryChromeSignIn === 'function') bridge.retryChromeSignIn();" +
    "});" +
    "})()";
}

function localCaller(req) {
  const addr = req.socket && req.socket.remoteAddress;
  if (addr !== "127.0.0.1" && addr !== "::ffff:127.0.0.1" && addr !== "::1") return false;
  const host = String(req.headers.host || "");
  return /^127\.0\.0\.1(?::\d+)?$/.test(host);
}

function startChromeLoopback({ onCallback }) {
  const server = http.createServer((req, res) => {
    if (!localCaller(req)) {
      res.writeHead(403, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("forbidden");
      return;
    }
    let url;
    try { url = new URL(req.url || "/", "http://127.0.0.1"); } catch { url = null; }
    if (!url || req.method !== "GET" || url.pathname !== "/cb") {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
      res.end("not found");
      return;
    }
    const handed = { state: url.searchParams.get("state") || "", d: url.searchParams.get("d") || "" };
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "content-security-policy": "default-src 'none'",
    });
    res.end(LOOPBACK_PAGE);
    try { onCallback(handed); } catch { /* a bad callback must not drop a stored session */ }
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const port = server.address().port;
      resolve({
        url: "http://127.0.0.1:" + port + "/cb",
        close: () => new Promise(done => server.close(() => done())),
      });
    });
  });
}

module.exports = {
  TITLE,
  BODY,
  RETRY,
  LOOPBACK_PAGE,
  handoffAction,
  chromeHandoffUrl,
  protocolArgFromLoopback,
  handoffPanelInnerHtml,
  visibleHandoffText,
  handoffPaintScript,
  startChromeLoopback,
};
