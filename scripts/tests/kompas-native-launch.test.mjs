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
  assert.match(shell, /window\.kompasDesktop/);
  assert.match(shell, /\/kompas\/api\/transcribe/);
  assert.match(shell, /mountKompasHtml/);
});

test("the dynamic MarketFit Kompas route mounts the canonical perfACT release", () => {
  const route = read("src/app/api/kompas/shell/route.ts");
  const next = read("next.config.js");
  assert.match(route, /mountKompasHtml/);
  assert.match(next, /source: "\/kompas"/);
  assert.match(next, /destination: "\/api\/kompas\/shell"/);
  assert.match(next, /source: "\/kompas\/:path\+"/);
});
