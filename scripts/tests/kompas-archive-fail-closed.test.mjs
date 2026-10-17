import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const source = readFileSync(new URL("../../src/lib/kompasSessionArchive.ts", import.meta.url), "utf8");
test("archive defaults to disabled without server verified consent", () => {
  assert.match(source, /archiveConsentVerified\?: boolean/);
  assert.match(source, /c\.archiveConsentVerified !== true/);
  assert.match(source, /KOMPAS_SESSION_ARCHIVE_ENABLED/);
});
test("consent gate precedes storage client initialization", () => {
  assert.ok(source.indexOf("c.archiveConsentVerified !== true") < source.indexOf("const sb = serviceClient()"));
});
test("storage bucket remains private", () => {
  assert.match(source, /createBucket\(BUCKET, \{ public: false \}\)/);
});
