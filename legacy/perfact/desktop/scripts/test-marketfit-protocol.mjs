// Minimal regression test for the shared perfACT / MarketFit desktop entrypoint.
// Executed before every Windows release so one application cannot shadow the other.
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// The standalone perfACT/copilot directory is no longer source of truth.
const page = fs.readFileSync(path.resolve(root, "..", "..", "public", "kompas", "app.js"), "utf8");
const desktop = fs.readFileSync(path.join(root, "desktop", "main.js"), "utf8");
const sfx = fs.readFileSync(path.join(root, "desktop", "scripts", "sfx.cs"), "utf8");

function between(source, begin, end) {
  const first = source.indexOf(begin);
  assert.ok(first >= 0, "Missing " + begin);
  const last = source.indexOf(end, first);
  assert.ok(last > first, "Missing " + end);
  return source.slice(first, last);
}

const packing = between(page, "function packSession(s) {", "function launchInstalled(s) {");
const session = { id: "test-123", role: "Security Engineer", jd: "OWASP", resume: "Python" };
function pack(pathname) {
  const globals = {
    location: { pathname },
    btoa: str => Buffer.from(str, "binary").toString("base64"),
    unescape, encodeURIComponent, Date,
  };
  vm.runInNewContext(packing + "\nthis.packSession = packSession;", globals);
  return globals.packSession(session);
}
function unpack(link) {
  const url = new URL(link);
  return JSON.parse(Buffer.from(url.searchParams.get("d"), "base64url").toString("utf8"));
}

const marketfit = pack("/kompas");
assert.match(marketfit, /^marketfit-kompas:\/\/open\?d=/);
assert.equal(unpack(marketfit).site, "marketfit");
assert.equal(unpack(marketfit).resume, "Python");
assert.equal(unpack(marketfit).jd, "OWASP");
assert.match(pack("/dashboard/kompas"), /^marketfit-kompas:\/\/open\?d=/);
const perfact = pack("/");
assert.match(perfact, /^kompas:\/\/open\?d=/);
assert.equal(unpack(perfact).site, "perfact");

const parseFn = between(desktop, "function sessionFromArgv(argv) {", "function deliverSession() {");
const context = { Buffer, URL };
vm.runInNewContext(parseFn + "\nthis.parse = sessionFromArgv;", context);
assert.equal(context.parse([marketfit]).site, "marketfit");
assert.equal(context.parse([marketfit.replace("://open?d=", "://open/?d=")]).site, "marketfit", "Windows may normalize external-protocol paths with a slash");
assert.equal(context.parse([perfact]).site, "perfact");
assert.equal(context.parse(["kompas://app/index.html"]), null);
assert.equal(context.parse(["https://attacker.invalid"]), null);
assert.ok(desktop.includes('app.setAsDefaultProtocolClient(MARKETFIT_SCHEME'));
assert.ok(desktop.includes('fs.mkdirSync(marketFitProfile, { recursive: true })'), "First installation must create MarketFit profile before setting userData");
assert.ok(desktop.includes('app.setPath("userData", marketFitProfile)'), "Isolate the MarketFit session store");
assert.ok(desktop.includes('activeSite = pendingSession ? siteFor(pendingSession) : (startedForMarketFit ? "marketfit" : "perfact")'), "Opening the desktop without a session must start MarketFit when requested");
assert.match('marketfit-kompas://open', /^marketfit-kompas:\/\/open$/, "Installer page may launch MarketFit with no session");
assert.equal(context.parse(["marketfit-kompas://open"]), null);
assert.ok(desktop.includes('app.setAsDefaultProtocolClient(MARKETFIT_SCHEME'));

assert.ok(page.includes("window.location.assign(packSession(s))"), "Native launch must use direct user gesture, not a hidden iframe");
assert.ok(sfx.includes("marketfit-kompas"), "Outer Windows launcher must forward MarketFit deep links");
console.log("MarketFit native session protocol, isolated desktop profile, and standalone perfACT: verified");
