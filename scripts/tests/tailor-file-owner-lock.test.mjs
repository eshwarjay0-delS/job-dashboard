import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"

// Owner lock (Nov 1): tokens minted with a dashboard caller id carry an owner
// record next to the docx; the fetch route refuses a mismatched caller with
// 404 before the docx read, and tokens without a record keep the previous
// signed-in-caller behavior (grandfathered). Source-marker suite: the route
// and tailor lib are text-checked, matching tailor-file-auth.test.mjs.
const fileRoute = readFileSync("src/app/api/tailor/file/route.ts", "utf8")
const tailorLib = readFileSync("src/lib/tailor.ts", "utf8")
const tailorRoute = readFileSync("src/app/api/tailor/route.ts", "utf8")

test("owner check precedes the docx blob read", () => {
  const ownerGet = fileRoute.indexOf("tailored/${token}.owner.json")
  const docxGet = fileRoute.indexOf("tailored/${token}.docx")
  assert.ok(ownerGet !== -1, "owner record read present")
  assert.ok(docxGet !== -1, "docx read present")
  assert.ok(ownerGet < docxGet, "owner check runs before the docx read")
})

test("mismatched owner reads as a missing file (404, no oracle)", () => {
  assert.match(fileRoute, /ownerId !== userId[\s\S]{0,200}status: 404/)
  assert.match(fileRoute, /Tailored file expired — tailor again/)
})

test("absent owner record still serves (grandfathered tokens)", () => {
  // The check is conditional on a record existing; no record means no deny.
  assert.ok(fileRoute.includes("if (ownerRaw)"), "owner check guarded on record presence")
})

test("tailor writes the owner record next to the docx when a caller id is passed", () => {
  const docxPut = tailorLib.indexOf("tailored/${token}.docx`, buffer)")
  const ownerPut = tailorLib.indexOf("tailored/${token}.owner.json")
  assert.ok(docxPut !== -1, "docx put present")
  assert.ok(ownerPut !== -1, "owner record put present")
  assert.ok(ownerPut > docxPut, "owner record written at the docx put site")
  assert.ok(tailorLib.includes("if (opts.ownerId)"), "owner write guarded on caller id")
  assert.ok(tailorLib.includes("ownerId?: string"), "ownerId option declared")
})

test("dashboard tailor route passes its caller id into runTailor", () => {
  assert.ok(tailorRoute.includes("ownerId: userId"), "runTailor call carries ownerId: userId")
})
