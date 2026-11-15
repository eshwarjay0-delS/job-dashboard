import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { runInNewContext } from "node:vm"
import ts from "typescript"

const require = createRequire(import.meta.url)
const source = readFileSync(new URL("../../src/lib/storage.ts", import.meta.url), "utf8")

function loadStorage(status) {
  const calls = []
  class PutObjectCommand { constructor(input) { this.input = input } }
  class GetObjectCommand { constructor(input) { this.input = input } }
  class HeadObjectCommand { constructor(input) { this.input = input } }
  class DeleteObjectCommand { constructor(input) { this.input = input } }
  class DeleteObjectsCommand { constructor(input) { this.input = input } }
  class ListObjectsV2Command { constructor(input) { this.input = input } }
  class S3Client {
    constructor(config) { this.config = config }
    async send(command) {
      calls.push(command)
      if (command instanceof PutObjectCommand && status) {
        throw Object.assign(new Error("mock S3 conditional write rejected"), {
          $metadata: { httpStatusCode: status },
        })
      }
      return {}
    }
  }
  const mocks = {
    "@aws-sdk/client-s3": {
      S3Client, PutObjectCommand, GetObjectCommand, HeadObjectCommand,
      DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command,
    },
    "@/lib/paths": { DATA_DIR: "/tmp/mfit-storage-r2-test" },
    "@/lib/storagePolicy": {
      storageSegments: key => String(key).split("/").filter(Boolean),
      storageListPrefix: prefix => prefix,
      storageMode: () => "r2",
    },
  }
  const fakeRequire = id => Object.prototype.hasOwnProperty.call(mocks, id) ? mocks[id] : require(id)
  const compiled = ts.transpileModule(source, {
    compilerOptions: { esModuleInterop: true, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText
  const testModule = { exports: {} }
  runInNewContext(compiled, {
    module: testModule,
    exports: testModule.exports,
    require: fakeRequire,
    process: { env: {
      VERCEL: "1",
      R2_BUCKET: "mock-bucket",
      R2_ACCOUNT_ID: "mock-account",
      R2_ACCESS_KEY_ID: "mock-access-key",
      R2_SECRET_ACCESS_KEY: "mock-secret-key",
    } },
    Buffer,
    console,
  })
  return { blob: testModule.exports.blob, calls }
}

test("R2 If-Match treats 412, 409 and 404 as a lost compare-and-swap, never an overwrite", async () => {
  for (const status of [412, 409, 404]) {
    const { blob, calls } = loadStorage(status)
    const result = await blob.putIfMatch("user-resumes/account/resume.docx", '"etag-1"', Buffer.from("new bytes"))
    assert.equal(result, false, "HTTP " + status + " must be a conflict/missing-object result")
    assert.equal(calls.length, 1, "a failed conditional write must not retry as an unconditional put")
    assert.equal(calls[0].input.IfMatch, '"etag-1"', "the exact ETag must reach PutObjectCommand")
    assert.equal(calls[0].input.Key, "user-resumes/account/resume.docx")
    assert.equal(calls[0].input.Body.toString(), "new bytes")
  }
})

test("R2 If-Match propagates unexpected service failures instead of treating them as conflicts", async () => {
  const { blob, calls } = loadStorage(503)
  await assert.rejects(
    blob.putIfMatch("user-resumes/account/resume.docx", '"etag-1"', Buffer.from("new bytes")),
    /mock S3 conditional write rejected/,
  )
  assert.equal(calls.length, 1)
})

test("R2 If-Match reports success only when the conditional write is accepted", async () => {
  const { blob, calls } = loadStorage(null)
  assert.equal(await blob.putIfMatch("user-resumes/account/resume.docx", '"etag-1"', Buffer.from("new bytes")), true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].input.IfMatch, '"etag-1"')
})
