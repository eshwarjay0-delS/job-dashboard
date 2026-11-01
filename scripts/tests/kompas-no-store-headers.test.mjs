// Kompas pages must never be cached (owner, 1 Nov 2026): a restored desktop
// window showed days-old bytes while the server was READY, because /kompas
// headers carried no no-store. The page and its scripts refetch every load.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const cfg = readFileSync(new URL("../../next.config.js", import.meta.url), "utf8");
const start = cfg.indexOf("const kompasHeaders = [");
const block = cfg.slice(start, cfg.indexOf("\n    ];", start));

test("kompas headers send no-store", () => {
  assert.match(block, /key:\s*"Cache-Control",\s*value:\s*"no-store"/);
});

test("the kompas path uses those headers", () => {
  assert.match(cfg, /source:\s*"\/kompas\/:path\*",\s*headers:\s*kompasHeaders/);
});
