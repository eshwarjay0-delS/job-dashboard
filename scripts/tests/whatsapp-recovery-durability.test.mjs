import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
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
function harness() {
  const data = new Map()
  const blob = {
    put: async (k, v) => { data.set(k, String(v)) },
    putIfAbsent: async (k, v) => { if (data.has(k)) return false; data.set(k, String(v)); return true },
    getText: async k => data.get(k) ?? null,
    list: async prefix => [...data.keys()].filter(k => k.startsWith(prefix)),
  }
  const exports = {}
  const localRequire = name => name === "./storage" ? { blob }
    : name === "./whatsapp-retry-policy" ? { retryDelayMs: n => n * 1000 }
    : require(name)
  vm.runInNewContext(compiled, { exports, module: { exports }, require: localRequire,
    console: { info() {} } }, { filename: "whatsapp-resume-recovery.ts" })
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
