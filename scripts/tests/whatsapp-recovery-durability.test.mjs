import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import { dirname, resolve } from "node:path"
import vm from "node:vm"

const require = createRequire(import.meta.url)
const ts = require("typescript")
const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/lib/whatsapp-resume-recovery.ts"), "utf8")
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const id = n => n.toString(16).padStart(64, "0")
function harness(options = {}) {
  const data = new Map()
  const etagOf = value => createHash("sha256").update(String(value)).digest("hex")
  const blob = {
    put: async (k, v) => { data.set(k, String(v)) },
    putIfAbsent: async (k, v) => { if (data.has(k)) return false; data.set(k, String(v)); return true },
    getText: async k => data.get(k) ?? null,
    getWithEtag: async k => {
      const value = data.get(k)
      return value === undefined ? null : { data: Buffer.from(value), etag: etagOf(value) }
    },
    putIfMatch: async (k, etag, v) => {
      await options.beforePutIfMatch?.(k, etag, v)
      const current = data.get(k)
      if (current === undefined || etagOf(current) !== etag) return false
      data.set(k, String(v))
      return true
    },
    list: async prefix => [...data.keys()].filter(k => k.startsWith(prefix)),
  }
  const exports = {}
  const localRequire = name => name === "./storage" ? { blob }
    : name === "./whatsapp-retry-policy" ? { retryDelayMs: n => n * 1000 }
    : require(name)
  vm.runInNewContext(compiled, { exports, module: { exports }, require: localRequire,
    console: { info() {} } }, { filename: "whatsapp-resume-recovery.ts" })
  exports.__expireClaim = async jobId => {
    const key = exports.recoveryKey(jobId)
    const raw = JSON.parse(data.get(key))
    raw.claimUntil = Date.now() - 1
    data.set(key, JSON.stringify(raw))
  }
  return exports
}
const input = n => ({ id: id(n), from: "sender", userId: "user",
  jd: "Original JD", jdId: "job", resumePath: "/original.docx" })

test("recovery persists the original JD and source", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  assert.equal((await api.readResumeRecovery(id(1))).resumePath, "/original.docx")
  assert.equal((await api.dueResumeRecoveries()).length, 1)
})
test("duplicate enqueue never overwrites candidate evidence", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.enqueueResumeRecovery({ ...input(1), jd: "Different JD" })
  await api.patchResumeRecovery(id(1), { jd: "Wrong", from: "other", userId: "other" })
  const job = await api.readResumeRecovery(id(1))
  assert.equal(job.jd, "Original JD")
  assert.equal(job.from, "sender")
})
test("failed quality run is retried after backoff without resubmission", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.deferResumeRecovery(id(1), "quality_rejected")
  assert.equal((await api.dueResumeRecoveries()).length, 0)
  await api.patchResumeRecovery(id(1), { retryAt: Date.now() - 1 })
  assert.equal((await api.dueResumeRecoveries()).length, 1)
})
test("best candidate is retained across weaker retry", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.deferResumeRecovery(id(1), "quality_rejected", { token: "a", coverage: 84.3, supportedCoverage: 100 })
  await api.deferResumeRecovery(id(1), "quality_rejected", { token: "b", coverage: 50, supportedCoverage: 90 })
  assert.equal((await api.readResumeRecovery(id(1))).best.token, "a")
})
test("Meta acceptance is not mistaken for handset delivery", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  assert.equal(await api.markResumeDocumentAccepted(id(1), "wamid-a"), true)
  assert.equal((await api.readResumeRecovery(id(1))).deliveryState, "accepted")
  assert.equal((await api.readResumeRecovery(id(1))).status, "uncertain")
  assert.equal((await api.dueResumeRecoveries()).length, 0)
  await api.recordResumeDeliveryStatus("wamid-a", "sent")
  assert.equal((await api.readResumeRecovery(id(1))).status, "uncertain")
  await api.recordResumeDeliveryStatus("wamid-a", "delivered")
  assert.equal((await api.readResumeRecovery(id(1))).deliveryState, "delivered")
  assert.equal((await api.readResumeRecovery(id(1))).status, "delivered")
})
test("Meta failure retains tombstone and cannot be resurrected by late HTTP", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.markResumeDocumentAccepted(id(1), "wamid-a")
  await api.recordResumeDeliveryStatus("wamid-a", "failed")
  assert.equal((await api.readResumeRecovery(id(1))).deliveredMessageId, "wamid-a")
  assert.equal(await api.markResumeDocumentAccepted(id(1), "wamid-a"), false)
  assert.equal((await api.readResumeRecovery(id(1))).status, "pending")
})
test("late genuine Meta delivered callback rescues a failed message", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.markResumeDocumentAccepted(id(1), "wamid-a")
  await api.recordResumeDeliveryStatus("wamid-a", "failed")
  await api.recordResumeDeliveryStatus("wamid-a", "delivered")
  assert.equal((await api.readResumeRecovery(id(1))).status, "delivered")
})
test("old callback cannot alter new retry message", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.markResumeDocumentAccepted(id(1), "wamid-a")
  await api.recordResumeDeliveryStatus("wamid-a", "failed")
  await api.markResumeDocumentAccepted(id(1), "wamid-b")
  await api.recordResumeDeliveryStatus("wamid-a", "delivered")
  assert.equal((await api.readResumeRecovery(id(1))).deliveredMessageId, "wamid-b")
})
test("opaque callback reconciles timed-out document", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.patchResumeRecovery(id(1), { status: "uncertain" })
  await api.recordResumeDeliveryStatus("wamid-late", "delivered", id(1))
  assert.equal((await api.readResumeRecovery(id(1))).deliveryState, "delivered")
})
test("unknown callbacks and uncertain jobs are not sent again", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.patchResumeRecovery(id(1), { status: "uncertain" })
  await api.recordResumeDeliveryStatus("unknown", "delivered")
  assert.equal((await api.dueResumeRecoveries()).length, 0)
})
test("queue ordering and limit preserve fairness", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.enqueueResumeRecovery(input(2))
  await api.patchResumeRecovery(id(1), { retryAt: Date.now() - 2000 })
  await api.patchResumeRecovery(id(2), { retryAt: Date.now() - 1000 })
  assert.equal((await api.dueResumeRecoveries(1))[0].id, id(1))
})
test("delivered job is immutable to stale retry", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(1))
  await api.markResumeDocumentAccepted(id(1), "wamid-a")
  await api.recordResumeDeliveryStatus("wamid-a", "delivered")
  await api.deferResumeRecovery(id(1), "quality_rejected")
  await api.patchResumeRecovery(id(1), { status: "pending" })
  assert.equal((await api.readResumeRecovery(id(1))).status, "delivered")
})


test("opaque sent callback after timeout is not falsely marked handset-delivered", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(3))
  await api.patchResumeRecovery(id(3), { status: "uncertain" })
  await api.recordResumeDeliveryStatus("wamid-timeout", "sent", id(3))
  const afterSent = await api.readResumeRecovery(id(3))
  assert.equal(afterSent.deliveryState, "sent")
  assert.equal(afterSent.status, "uncertain")
  assert.equal((await api.dueResumeRecoveries()).length, 0)
  await api.recordResumeDeliveryStatus("wamid-timeout", "delivered")
  assert.equal((await api.readResumeRecovery(id(3))).status, "delivered")
})

test("accepted without signed handset callback cannot be counted as delivery or retried", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(4))
  await api.markResumeDocumentAccepted(id(4), "wamid-api-only")
  const job = await api.readResumeRecovery(id(4))
  assert.equal(job.deliveryState, "accepted")
  assert.notEqual(job.status, "delivered")
  assert.equal((await api.dueResumeRecoveries()).length, 0)
  await api.deferResumeRecovery(id(4), "retry_error")
  assert.equal((await api.readResumeRecovery(id(4))).attempts, 0)
})

test("late Meta HTTP acceptance cannot downgrade signed handset confirmation", async () => {
  const api = harness()
  await api.enqueueResumeRecovery(input(5))
  await api.patchResumeRecovery(id(5), { status: "sending" })
  await api.recordResumeDeliveryStatus("wamid-early", "delivered", id(5))
  assert.equal((await api.readResumeRecovery(id(5))).status, "delivered")
  assert.equal(await api.markResumeDocumentAccepted(id(5), "wamid-early"), true)
  assert.equal((await api.readResumeRecovery(id(5))).deliveryState, "delivered")
})

test("legacy bootstrap sees an existing JD in pending, sending, accepted, sent and delivered states", async () => {
  const api = harness()
  for (let i = 20; i < 25; i++) {
    await api.enqueueResumeRecovery({ ...input(i), from: "sender-" + i, jd: "JD-" + i })
    if (i === 21) await api.patchResumeRecovery(id(i), { status: "sending" })
    if (i === 22 || i === 23 || i === 24) {
      await api.markResumeDocumentAccepted(id(i), "wamid-" + i)
      if (i === 23) await api.recordResumeDeliveryStatus("wamid-" + i, "sent")
      if (i === 24) await api.recordResumeDeliveryStatus("wamid-" + i, "delivered")
    }
    assert.equal(await api.hasResumeRecoveryForJD("sender-" + i, "user", "JD-" + i), true)
    assert.equal(await api.hasResumeRecoveryForJD("other", "user", "JD-" + i), false)
    assert.equal(await api.hasResumeRecoveryForJD("sender-" + i, "other", "JD-" + i), false)
    assert.equal(await api.hasResumeRecoveryForJD("sender-" + i, "user", "different JD"), false)
  }
})

test("legacy lookup does not confuse identical job text from separate senders", async () => {
  const api = harness()
  await api.enqueueResumeRecovery({ ...input(30), from: "a", jd: "Cloud Security Consultant" })
  await api.enqueueResumeRecovery({ ...input(31), from: "b", jd: "Cloud Security Consultant" })
  assert.equal(await api.hasResumeRecoveryForJD("a", "user", "Cloud Security Consultant"), true)
  assert.equal(await api.hasResumeRecoveryForJD("b", "user", "Cloud Security Consultant"), true)
  assert.equal(await api.hasResumeRecoveryForJD("c", "user", "Cloud Security Consultant"), false)
})

// Route-budget regression: a slow legacy bootstrap must not consume the time
// reserved for a signed-delivery-safe send, state writes, and final cron counts.
const budgetSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/lib/whatsapp-recovery-budget.ts"), "utf8")
const budgetCompiled = ts.transpileModule(budgetSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText
const budgetModule = { exports: {} }
vm.runInNewContext(budgetCompiled, { module: budgetModule, exports: budgetModule.exports, Date, Math, Number })
const budget = budgetModule.exports.recoveryTailorBudget

test("recovery route reserves a finish window across ten bootstrap durations", () => {
  const now = 1_800_000_000_000
  const cases = [
    [0, 240_000], [1_000, 240_000], [15_000, 240_000],
    [30_000, 225_000], [60_000, 195_000], [100_000, 155_000],
    [150_000, 105_000], [210_000, 45_000], [220_000, 35_000],
    [250_000, 5_000],
  ]
  for (const [elapsed, expected] of cases) {
    const actual = budget(now - elapsed, now)
    assert.equal(actual, expected, "elapsed " + elapsed)
    assert.ok(actual + elapsed + 45_000 <= 300_000)
  }
})

test("recovery budget rejects invalid and exhausted runtime", () => {
  const now = 1_800_000_000_000
  assert.equal(budget(now - 300_000, now), 0)
  assert.equal(budget(NaN, now), 0)
  assert.equal(budget(now, Infinity), 0)
  assert.equal(budget(now, now, NaN), 0)
  assert.equal(budget(now, now, 20_000), 20_000)
  assert.equal(budget(now + 1000, now), 240_000)
})

test("authenticated recovery route checkpoints progress before long work and uses remaining budget", () => {
  const route = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/app/api/whatsapp/webhook/route.ts"), "utf8")
  const start = route.indexOf("async function recoverResumeJobsInner(")
  const end = route.indexOf("async function emailSlots(", start)
  assert.ok(start > 0 && end > start)
  const worker = route.slice(start, end)
  const auth = worker.indexOf('return NextResponse.json({ error: "Unauthorized" }')
  const checkpoint = worker.indexOf('stage: "authenticated"')
  const bootstrap = worker.indexOf("await bootstrapLegacyResumeFailures()")
  assert.ok(auth >= 0 && checkpoint > auth && bootstrap > checkpoint)
  assert.ok(worker.includes("recoveryTailorBudget(startedAt)"))
  assert.ok(worker.includes("budget < RECOVERY_MIN_TAILOR_MS"))
  assert.ok(worker.includes("job.userId, budget, job.files, true"))
  assert.ok(worker.includes('stage: "attempt_started"'))
  assert.ok(worker.includes('stage: "attempt_finished"'))
})


test("two workers cannot claim one pending job; an expired lease fences its stale worker", async () => {
  const api = harness()
  const jobId = id(40)
  await api.enqueueResumeRecovery(input(40))
  const claims = await Promise.all([api.claimResumeRecoveryWorker(jobId), api.claimResumeRecoveryWorker(jobId)])
  assert.equal(claims.filter(Boolean).length, 1)
  const oldToken = claims.find(Boolean)
  await api.__expireClaim(jobId)
  const newToken = await api.claimResumeRecoveryWorker(jobId)
  assert.ok(newToken && newToken !== oldToken)
  assert.equal(await api.patchResumeRecovery(jobId, { status: "sending" }, oldToken), false)
  assert.equal(await api.patchResumeRecovery(jobId, { status: "sending" }, newToken), true)
  assert.equal(await api.releaseResumeRecoveryWorker(jobId, oldToken), false)
  assert.equal(await api.releaseResumeRecoveryWorker(jobId, newToken), true)
})

test("a delivered callback wins a deterministic stale retry write", async () => {
  let armed = false
  let enteredResolve
  let releaseResolve
  const entered = new Promise(resolve => { enteredResolve = resolve })
  const gate = new Promise(resolve => { releaseResolve = resolve })
  const jobId = id(41)
  let api
  api = harness({ beforePutIfMatch: async key => {
    if (armed && key === api.recoveryKey(jobId)) {
      armed = false
      enteredResolve()
      await gate
    }
  } })
  await api.enqueueResumeRecovery(input(41))
  const token = await api.claimResumeRecoveryWorker(jobId)
  assert.ok(token)
  assert.equal(await api.patchResumeRecovery(jobId, { status: "sending" }, token), true)
  armed = true
  const staleRetry = api.patchResumeRecovery(jobId, { status: "pending", errorCode: "stale_retry" }, token)
  await entered
  await api.recordResumeDeliveryStatus("wamid-race", "delivered", jobId + ":" + token)
  releaseResolve()
  assert.equal(await staleRetry, false)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "delivered")
  assert.equal(current.deliveryState, "delivered")
  assert.equal(current.deliveredMessageId, "wamid-race")
})

test("a signed failure callback cannot be overwritten by a late HTTP acceptance", async () => {
  const api = harness()
  const jobId = id(42)
  await api.enqueueResumeRecovery(input(42))
  const token = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)
  await api.recordResumeDeliveryStatus("wamid-failed", "failed", jobId + ":" + token)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-failed", token), false)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "pending")
  assert.equal(current.deliveryState, "failed")
  assert.equal(current.deliveredMessageId, "wamid-failed")
})

test("an old callback cannot change the newer retry message id", async () => {
  const api = harness()
  const jobId = id(43)
  await api.enqueueResumeRecovery(input(43))
  const first = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, first)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-old", first), true)
  await api.recordResumeDeliveryStatus("wamid-old", "failed", jobId + ":" + first)
  await api.releaseResumeRecoveryWorker(jobId, first)
  const second = await api.claimResumeRecoveryWorker(jobId)
  assert.ok(second && second !== first)
  await api.patchResumeRecovery(jobId, { status: "sending" }, second)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-new", second), true)
  await api.recordResumeDeliveryStatus("wamid-old", "delivered", jobId + ":" + first)
  let current = await api.readResumeRecovery(jobId)
  assert.equal(current.deliveredMessageId, "wamid-new")
  assert.equal(current.deliveryState, "accepted")
  assert.equal(current.status, "uncertain")
  await api.recordResumeDeliveryStatus("wamid-new", "delivered", jobId + ":" + second)
  current = await api.readResumeRecovery(jobId)
  assert.equal(current.deliveredMessageId, "wamid-new")
  assert.equal(current.deliveryState, "delivered")
  assert.equal(current.status, "delivered")
})

test("a callback arriving before the HTTP response is correlated to the active attempt token", async () => {
  const api = harness()
  const jobId = id(44)
  await api.enqueueResumeRecovery(input(44))
  const token = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)
  await api.recordResumeDeliveryStatus("wamid-early", "delivered", jobId + ":" + token)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-early", token), true)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "delivered")
  assert.equal(current.deliveryState, "delivered")
  assert.equal(current.deliveredMessageId, "wamid-early")
})

const storageSource = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), "../../src/lib/storage.ts"), "utf8")
const storageCompiled = ts.transpileModule(storageSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText
function loadR2Storage(send) {
  class Command { constructor(input) { this.input = input } }
  class S3Client { constructor(config) { this.config = config } async send(command) { return send(command) } }
  const sdk = {
    S3Client,
    PutObjectCommand: class PutObjectCommand extends Command {},
    GetObjectCommand: class GetObjectCommand extends Command {},
    HeadObjectCommand: class HeadObjectCommand extends Command {},
    DeleteObjectCommand: class DeleteObjectCommand extends Command {},
    DeleteObjectsCommand: class DeleteObjectsCommand extends Command {},
    ListObjectsV2Command: class ListObjectsV2Command extends Command {},
  }
  const localRequire = name => {
    if (name === "@aws-sdk/client-s3") return sdk
    if (name === "@/lib/paths") return { DATA_DIR: "/tmp/mfit-storage-cas-test" }
    if (name === "@/lib/storagePolicy") return {
      storageSegments: key => String(key).split("/").filter(Boolean),
      storageListPrefix: key => String(key).replace(/^\/+|\/+$/g, ""),
      storageMode: () => "r2",
    }
    return require(name)
  }
  const module = { exports: {} }
  vm.runInNewContext(storageCompiled, {
    module, exports: module.exports, require: localRequire,
    process: { env: { R2_BUCKET: "bucket", R2_ACCOUNT_ID: "account", R2_ACCESS_KEY_ID: "access", R2_SECRET_ACCESS_KEY: "secret" } },
    Buffer, console,
  }, { filename: "storage.ts" })
  return module.exports.blob
}

test("R2 CAS preserves the opaque ETag and sends it unchanged as PutObject If-Match", async () => {
  const calls = []
  const store = loadR2Storage(async command => {
    calls.push(command)
    if (command.constructor.name === "GetObjectCommand")
      return { ETag: '"opaque-etag"', Body: { transformToByteArray: async () => Buffer.from("before") } }
    return {}
  })
  const snapshot = await store.getWithEtag("whatsapp/resume-recovery/job.json")
  assert.equal(snapshot.data.toString("utf8"), "before")
  assert.equal(snapshot.etag, '"opaque-etag"')
  assert.equal(await store.putIfMatch("whatsapp/resume-recovery/job.json", snapshot.etag, "after"), true)
  const put = calls.find(command => command.constructor.name === "PutObjectCommand")
  assert.equal(put.input.IfMatch, '"opaque-etag"')
  assert.equal(put.input.Body.toString("utf8"), "after")
})

test("R2 If-Match 412 retries as a version conflict but other errors remain visible", async () => {
  const conflict = loadR2Storage(async () => { throw Object.assign(new Error("Precondition"), { $metadata: { httpStatusCode: 412 } }) })
  assert.equal(await conflict.putIfMatch("whatsapp/resume-recovery/job.json", '"old"', "new"), false)
  for (const status of [409, 404, 403]) {
    const failed = loadR2Storage(async () => { throw Object.assign(new Error("R2 failure"), { $metadata: { httpStatusCode: status } }) })
    await assert.rejects(failed.putIfMatch("whatsapp/resume-recovery/job.json", '"old"', "new"))
  }
})

test("R2 recovery CAS fails closed if GetObject omits its ETag", async () => {
  const store = loadR2Storage(async () => ({ Body: { transformToByteArray: async () => Buffer.from("before") } }))
  await assert.rejects(store.getWithEtag("whatsapp/resume-recovery/job.json"), /omitted ETag/)
})


test("a signed callback can reconcile an ambiguous send after its worker lease is released", async () => {
  const api = harness()
  const jobId = id(45)
  await api.enqueueResumeRecovery(input(45))
  const token = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)
  await api.patchResumeRecovery(jobId, { status: "uncertain", errorCode: "delivery_unconfirmed" }, token)
  assert.equal(await api.releaseResumeRecoveryWorker(jobId, token), true)
  const afterRelease = await api.readResumeRecovery(jobId)
  assert.equal(afterRelease.claimToken, undefined)
  assert.equal(afterRelease.attemptToken, token)
  await api.recordResumeDeliveryStatus("wamid-late", "delivered", jobId + ":" + token)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "delivered")
  assert.equal(current.deliveryState, "delivered")
  assert.equal(current.deliveredMessageId, "wamid-late")
})

test("a Meta-sent document cannot be reset to pending by a late retry", async () => {
  const api = harness()
  const jobId = id(46)
  await api.enqueueResumeRecovery(input(46))
  const token = await api.claimResumeRecoveryWorker(jobId)
  assert.ok(token)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-sent", token), true)
  await api.recordResumeDeliveryStatus("wamid-sent", "sent", jobId + ":" + token)
  assert.equal(await api.patchResumeRecovery(jobId, { status: "pending", errorCode: "late_retry" }, token), false)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "uncertain")
  assert.equal(current.deliveryState, "sent")
  assert.equal(current.deliveredMessageId, "wamid-sent")
})

test("tokenless legacy callback cannot update a tokenized active attempt", async () => {
  const api = harness()
  const jobId = id(51)
  await api.enqueueResumeRecovery(input(51))
  const token = await api.claimResumeRecoveryWorker(jobId)
  assert.ok(token)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)

  await api.recordResumeDeliveryStatus("wamid-stale-legacy", "delivered", jobId)
  const afterLegacy = await api.readResumeRecovery(jobId)
  assert.equal(afterLegacy.status, "sending")
  assert.equal(afterLegacy.deliveryState, undefined)
  assert.equal(afterLegacy.deliveredMessageId, undefined)

  await api.recordResumeDeliveryStatus("wamid-current", "delivered", jobId + ":" + token)
  const afterCurrent = await api.readResumeRecovery(jobId)
  assert.equal(afterCurrent.status, "delivered")
  assert.equal(afterCurrent.deliveryState, "delivered")
  assert.equal(afterCurrent.deliveredMessageId, "wamid-current")
})

test("two workers paused on the same recovery ETag produce exactly one atomic claim", async () => {
  let waiters = 0
  let bothReadyResolve
  let releaseResolve
  const bothReady = new Promise(resolve => { bothReadyResolve = resolve })
  const gate = new Promise(resolve => { releaseResolve = resolve })
  const jobId = id(47)
  let api
  api = harness({ beforePutIfMatch: async key => {
    if (key !== api.recoveryKey(jobId) || waiters >= 2) return
    waiters++
    if (waiters === 2) bothReadyResolve()
    await gate
  } })
  await api.enqueueResumeRecovery(input(47))
  const first = api.claimResumeRecoveryWorker(jobId)
  const second = api.claimResumeRecoveryWorker(jobId)
  await bothReady
  releaseResolve()
  const claims = await Promise.all([first, second])
  assert.equal(claims.filter(Boolean).length, 1)
  const winner = claims.find(Boolean)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.claimToken, winner)
  assert.ok(current.claimUntil > Date.now())
})

test("a signed failed callback wins an in-flight stale HTTP acceptance write", async () => {
  let armed = false
  let enteredResolve
  let releaseResolve
  const entered = new Promise(resolve => { enteredResolve = resolve })
  const gate = new Promise(resolve => { releaseResolve = resolve })
  const jobId = id(48)
  let api
  api = harness({ beforePutIfMatch: async key => {
    if (armed && key === api.recoveryKey(jobId)) {
      armed = false
      enteredResolve()
      await gate
    }
  } })
  await api.enqueueResumeRecovery(input(48))
  const token = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)
  armed = true
  const lateAcceptance = api.markResumeDocumentAccepted(jobId, "wamid-failed-race", token)
  await entered
  await api.recordResumeDeliveryStatus("wamid-failed-race", "failed", jobId + ":" + token)
  releaseResolve()
  assert.equal(await lateAcceptance, false)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "pending")
  assert.equal(current.deliveryState, "failed")
  assert.equal(current.deliveredMessageId, "wamid-failed-race")
  assert.equal(current.attempts, 1)
})

test("an old delivered callback beats a newer retry acceptance that has not committed", async () => {
  let armed = false
  let enteredResolve
  let releaseResolve
  const entered = new Promise(resolve => { enteredResolve = resolve })
  const gate = new Promise(resolve => { releaseResolve = resolve })
  const jobId = id(49)
  let api
  api = harness({ beforePutIfMatch: async key => {
    if (armed && key === api.recoveryKey(jobId)) {
      armed = false
      enteredResolve()
      await gate
    }
  } })
  await api.enqueueResumeRecovery(input(49))
  const first = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, first)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-old-race", first), true)
  await api.recordResumeDeliveryStatus("wamid-old-race", "failed", jobId + ":" + first)
  assert.equal(await api.releaseResumeRecoveryWorker(jobId, first), true)
  const second = await api.claimResumeRecoveryWorker(jobId)
  assert.ok(second && second !== first)
  await api.patchResumeRecovery(jobId, { status: "sending" }, second)
  armed = true
  const newAcceptance = api.markResumeDocumentAccepted(jobId, "wamid-new-race", second)
  await entered
  await api.recordResumeDeliveryStatus("wamid-old-race", "delivered", jobId + ":" + first)
  releaseResolve()
  assert.equal(await newAcceptance, false)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "delivered")
  assert.equal(current.deliveryState, "delivered")
  assert.equal(current.deliveredMessageId, "wamid-old-race")
})

test("a delivered callback wins an in-flight defer retry after a prior Meta failure", async () => {
  let armed = false
  let enteredResolve
  let releaseResolve
  const entered = new Promise(resolve => { enteredResolve = resolve })
  const gate = new Promise(resolve => { releaseResolve = resolve })
  const jobId = id(50)
  let api
  api = harness({ beforePutIfMatch: async key => {
    if (armed && key === api.recoveryKey(jobId)) {
      armed = false
      enteredResolve()
      await gate
    }
  } })
  await api.enqueueResumeRecovery(input(50))
  const token = await api.claimResumeRecoveryWorker(jobId)
  await api.patchResumeRecovery(jobId, { status: "sending" }, token)
  assert.equal(await api.markResumeDocumentAccepted(jobId, "wamid-defer-race", token), true)
  await api.recordResumeDeliveryStatus("wamid-defer-race", "failed", jobId + ":" + token)
  const before = await api.readResumeRecovery(jobId)
  assert.equal(before.status, "pending")
  assert.equal(before.deliveryState, "failed")
  assert.equal(before.attempts, 1)
  armed = true
  const staleDefer = api.deferResumeRecovery(jobId, "late_defer", undefined, token)
  await entered
  await api.recordResumeDeliveryStatus("wamid-defer-race", "delivered", jobId + ":" + token)
  releaseResolve()
  assert.equal(await staleDefer, false)
  const current = await api.readResumeRecovery(jobId)
  assert.equal(current.status, "delivered")
  assert.equal(current.deliveryState, "delivered")
  assert.equal(current.deliveredMessageId, "wamid-defer-race")
  assert.equal(current.attempts, 1)
})
