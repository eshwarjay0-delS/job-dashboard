import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { asInvokerManifest } from "./execution-level.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("administrator and highestAvailable manifest levels are rewritten to asInvoker", () => {
  for (const level of ["requireAdministrator", "highestAvailable"]) {
    const input = `<assembly><trustInfo><security><requestedPrivileges><requestedExecutionLevel level="${level}" uiAccess="false" /></requestedPrivileges></security></trustInfo></assembly>`;
    const expected = input.replace(`level="${level}"`, 'level="asInvoker"');
    assert.equal(asInvokerManifest(input), expected);
  }
});

test("an existing asInvoker manifest and a manifest without an execution level stay unchanged", () => {
  const alreadySafe = '<requestedExecutionLevel level="asInvoker" uiAccess="false" />';
  const noExecutionLevel = "<assembly></assembly>";
  assert.equal(asInvokerManifest(alreadySafe), alreadySafe);
  assert.equal(asInvokerManifest(noExecutionLevel), noExecutionLevel);
});

test("packaging stamps both Electron and outer SFX executables and rewrites every manifest resource", () => {
  const runtime = fs.readFileSync(path.join(root, "scripts", "runtime.mjs"), "utf8");
  const packager = fs.readFileSync(path.join(root, "scripts", "package.mjs"), "utf8");

  assert.match(runtime, /const RT_MANIFEST = 24/);
  assert.match(runtime, /for \(const e of res\.entries\)/);
  assert.match(runtime, /if \(e\.type !== RT_MANIFEST \|\| !e\.bin\) continue/);
  assert.match(runtime, /asInvokerManifest\(xml\)/);

  assert.match(packager, /afterPack: async \(ctx\) => \{ await stampExe\(path\.join\(ctx\.appOutDir, "Kompas\.exe"\)\); \}/);
  assert.match(packager, /await stampExe\(sfxExe\)/);
});
