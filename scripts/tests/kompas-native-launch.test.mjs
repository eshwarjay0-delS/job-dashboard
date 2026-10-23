import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const read = (p) => readFileSync(resolve(root, p), "utf8");

test("installer page uses the MarketFit native protocol from a direct click, not a hidden iframe", () => {
  const page = read("src/app/downloads/kompas/page.tsx");
  assert.match(page, /href="marketfit-kompas:\/\/open"/);
  assert.doesNotMatch(page, /document\.createElement\(['"]iframe['"]\)/);
  assert.doesNotMatch(page, /f\.src\s*=\s*['"]kompas:/);
  assert.match(page, /Desktop app/);
});

test("MarketFit mounted Kompas preserves the existing voice and answer pipeline", () => {
  const shell = read("src/lib/kompas-shell.ts");
  assert.match(shell, /\/api\/kompas\/speech/);
  assert.match(shell, /\/api\/kompas\/humanize/);
  assert.match(shell, /\/api\/kompas\/credits/);
  // Since 14 Oct (67f59869) speech is MarketFit's own: the page's /api/transcribe becomes /api/kompas/speech, and
  // answers go to /api/kompas/answer. The desktop bridge is the native shell's preload, not this mount.
  const heard = shell.indexOf("url.pathname === '/api/transcribe'"), speech = shell.indexOf("url.pathname = '/api/kompas/speech'");
  assert.ok(heard > 0 && speech > heard && shell.indexOf("url.pathname ===", heard + 1) > speech, '/api/transcribe is answered by /api/kompas/speech');
  assert.match(shell, /headers\.set\('x-speech-for', 'transcribe'\)/);
  assert.match(shell, /url\.pathname = '\/api\/kompas\/answer'/);
  assert.match(shell, /mountKompasHtml/);
});

test("the dynamic MarketFit Kompas route mounts the canonical perfACT release", () => {
  const route = read("src/app/api/kompas/shell/route.ts");
  const next = read("next.config.js");
  assert.match(route, /mountKompasHtml/);
  assert.match(next, /source: "\/kompas"/);
  assert.match(next, /destination: "\/api\/kompas\/shell"/);
  // Self-hosted: no Kompas path is forwarded to the old copilot deployment any more.
  assert.doesNotMatch(next, /source: "\/kompas\/:path\+"/);
  assert.doesNotMatch(next, /destination: `?\$\{?[A-Z_]*KOMPAS_API_ORIGIN/);
});
