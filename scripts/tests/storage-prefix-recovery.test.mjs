import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, dirname, resolve } from "node:path"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
const compile = path => ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText

function evaluate(code, dependencies, context = {}) {
  const module = { exports: {} }
  vm.runInNewContext(code, {
    module, exports: module.exports, require: name => dependencies[name] || require(name),
    process: { env: context.env || {} }, Buffer, console,
  }, { filename: "storage-prefix-integration.ts" })
  return module.exports
}
const policy = evaluate(compile("src/lib/storagePolicy.ts"), {})

test("listing accepts exactly one optional trailing slash", () => {
  for (const prefix of ["whatsapp/resume-recovery", "mail/updates", "jobs", "a/b/c", ""]) {
    assert.equal(policy.storageListPrefix(prefix), prefix)
    if (prefix) assert.equal(policy.storageListPrefix(prefix + "/"), prefix)
  }
})
test("unsafe storage keys remain rejected for all writes", () => {
  for (const key of ["/", "/root", "a//b", "a/../b", "a/./b", "a/", "../b", "a//", "a/\u0000b"]) {
    assert.throws(() => policy.storageSegments(key), /Invalid storage key/)
  }
})
test("list-prefix normalization does not permit traversal or repeated separators", () => {
  for (const key of ["/", "/root/", "a//", "a//b/", "a/../b/", "../b/", "a/./b/"]) {
    assert.throws(() => policy.storageListPrefix(key), /Invalid storage key/)
  }
})

function adapter(env, directory) {
  const requests = []
  class S3Client {
    async send(cmd) {
      requests.push(cmd)
      return { Contents: [
        { Key: "whatsapp/resume-recovery/a.json", Size: 10 },
        { Key: "whatsapp/resume-recovery/b.json", Size: 11 },
      ] }
    }
  }
  class ListObjectsV2Command { constructor(args) { Object.assign(this, args) } }
  class Command { constructor(args) { Object.assign(this, args) } }
  const aws = { S3Client, ListObjectsV2Command,
    PutObjectCommand: Command, GetObjectCommand: Command, HeadObjectCommand: Command,
    DeleteObjectCommand: Command, DeleteObjectsCommand: Command }
  const storage = evaluate(compile("src/lib/storage.ts"), {
    "@/lib/paths": { DATA_DIR: directory },
    "@/lib/storagePolicy": policy,
    "@aws-sdk/client-s3": aws,
  }, { env })
  return { blob: storage.blob, requests }
}

test("filesystem adapter lists directory prefixes with or without slash", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mfit-storage-prefix-"))
  try {
    const file = join(directory, "whatsapp", "resume-recovery", "a.json")
    mkdirSync(dirname(file), { recursive: true })
    writeFileSync(file, "{}")
    const { blob } = adapter({}, directory)
    const a = await blob.list("whatsapp/resume-recovery")
    const b = await blob.list("whatsapp/resume-recovery/")
    assert.deepEqual(Array.from(a), ["whatsapp/resume-recovery/a.json"])
    assert.deepEqual(b, a)
    assert.deepEqual(Array.from(await blob.list("whatsapp/resume-recovery/a-nonexistent")), [])
    await assert.rejects(blob.list("whatsapp/resume-recovery//"), /Invalid storage key/)
    await assert.rejects(blob.put("whatsapp/resume-recovery/", "{}"), /Invalid storage key/)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test("R2 adapter uses identical exact directory prefix for both forms", async () => {
  const { blob, requests } = adapter({
    R2_BUCKET: "test", R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "key", R2_SECRET_ACCESS_KEY: "secret",
  }, "/unused")
  const first = await blob.list("whatsapp/resume-recovery")
  const second = await blob.list("whatsapp/resume-recovery/")
  assert.deepEqual(first, second)
  assert.equal(requests[0].Prefix, "whatsapp/resume-recovery/")
  assert.equal(requests[1].Prefix, "whatsapp/resume-recovery/")
  await assert.rejects(blob.list("whatsapp/resume-recovery//"), /Invalid storage key/)
})

test("persisted WhatsApp recovery jobs can be scanned by the actual filesystem adapter", async () => {
  const directory = mkdtempSync(join(tmpdir(), "mfit-recovery-"))
  try {
    const { blob } = adapter({}, directory)
    const recovery = evaluate(compile("src/lib/whatsapp-resume-recovery.ts"), {
      "./storage": { blob },
      "./whatsapp-retry-policy": { retryDelayMs: n => n * 1000 },
    })
    for (let i = 0; i < 10; i++) {
      const id = i.toString(16).padStart(64, "0")
      await recovery.enqueueResumeRecovery({
        id, from: "sender", userId: "user", jd: "JD", jdId: String(i), resumePath: "/source.docx",
      })
      if (i >= 6) await recovery.deferResumeRecovery(id, "quality_rejected")
    }
    const due = await recovery.dueResumeRecoveries(10)
    assert.equal(due.length, 6)
    assert.equal(new Set(due.map(job => job.id)).size, 6)
    assert.equal((await blob.list("whatsapp/resume-recovery/")).length, 10)
  } finally { rmSync(directory, { recursive: true, force: true }) }
})

test("recover endpoint remains routed through authenticated webhook GET", () => {
  const route = readFileSync(resolve(root, "src/app/api/whatsapp/recover/route.ts"), "utf8")
  const webhook = readFileSync(resolve(root, "src/app/api/whatsapp/webhook/route.ts"), "utf8")
  const config = JSON.parse(readFileSync(resolve(root, "vercel.json"), "utf8"))
  assert.match(route, /export\s*\{\s*GET\s*\}\s*from\s*["']\.\.\/webhook\/route["']/)
  assert.match(webhook, /return recoverResumeJobs\(request\)/)
  assert.match(webhook, /request\.headers\.get\("authorization"\)/)
  assert.ok(config.crons.some(cron => cron.path === "/api/whatsapp/recover"))
})
