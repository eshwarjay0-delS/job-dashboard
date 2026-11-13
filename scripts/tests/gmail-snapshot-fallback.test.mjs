import test from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import {
  MAX_SNAPSHOT_BODY_BYTES,
  MAX_THREADS_PER_PART,
  acceptSnapshotPart,
  authorizeSnapshotImport,
  createMemorySnapshotBackend,
  isGmailQuotaError,
  resetGmailSnapshotForTests,
  resolveGmailAccounts,
  savedMailNotice,
  setGmailSnapshotBackendForTests,
  setGmailSnapshotClockForTests,
  snapshotBodyTooLarge,
  snapshotThreads,
} from "../../src/lib/gmailSnapshot.ts"

const USER = "67f02d95-f7fe-4058-9b0d-9363221e7c61"
const OTHER = "11111111-1111-4111-8111-111111111111"

function thread(id, email, ts) {
  return {
    user_id: USER,
    account_id: email.startsWith("a") ? "acct-a" : "acct-b",
    thread_id: id,
    account_email: email,
    latest_ts: ts,
    updated_at: "2026-11-10T00:00:00.000Z",
    data: { threadId: id, accountEmail: email, messages: [{ id: `${id}-m`, subject: id, snippet: id, from: "Ada <ada@example.com>", internalDate: String(ts) }] },
  }
}

function liveAccount(email) {
  return {
    id: "live-id",
    google_email: email,
    granted_scopes: ["gmail"],
    gmail_enabled: true,
    calendar_enabled: true,
    is_primary: true,
    last_gmail_sync_at: "2026-11-13T00:00:00.000Z",
    last_calendar_sync_at: null,
    connected_at: "2026-11-01T00:00:00.000Z",
    updated_at: "2026-11-13T00:00:00.000Z",
  }
}

test.afterEach(() => {
  resetGmailSnapshotForTests()
})

test("import secret is unset, wrong, or exact", () => {
  assert.equal(authorizeSnapshotImport(null, {}).status, 503)
  assert.equal(authorizeSnapshotImport("secret", {}).status, 503)
  const env = { GMAIL_SNAPSHOT_IMPORT_SECRET: "correct-horse" }
  assert.equal(authorizeSnapshotImport(null, env).status, 401)
  assert.equal(authorizeSnapshotImport("", env).status, 401)
  assert.equal(authorizeSnapshotImport("wrong", env).status, 401)
  assert.equal(authorizeSnapshotImport("correct-horse-extra", env).status, 401)
  assert.equal(authorizeSnapshotImport("correct-horse", env).ok, true)
  assert.equal(snapshotBodyTooLarge(MAX_SNAPSHOT_BODY_BYTES), false)
  assert.equal(snapshotBodyTooLarge(MAX_SNAPSHOT_BODY_BYTES + 1), true)
})

test("a restricted database read serves the saved rows, and a working read does not", async () => {
  const gets = []
  const files = new Map()
  setGmailSnapshotClockForTests(() => "2026-11-13T18:05:00.000Z")
  setGmailSnapshotBackendForTests({
    async put(path, body) { files.set(path, body) },
    async get(path) { gets.push(path); return files.has(path) ? files.get(path) : null },
  })
  const saved = await acceptSnapshotPart({
    user_id: USER,
    part: 0,
    total: 1,
    sync: [{ user_id: USER, account_id: "acct-a", last_sync_at: "2026-11-10T14:44:44.000Z", days_synced: 90 }],
    threads: [
      thread("t-new", "a@example.com", Date.now()),
      thread("t-mid", "b@example.com", Date.now() - 1000),
      thread("t-old", "a@example.com", Date.now() - 1000 * 60),
    ],
  })
  assert.equal(saved.status, 200)
  assert.equal(saved.body.threads, 3)
  const manifest = JSON.parse(files.get(`gmail-snapshot/${USER}/manifest.json`))
  assert.equal(manifest.total, 1)
  assert.equal(manifest.snapshotAt, "2026-11-13T18:05:00.000Z")
  assert.equal(manifest.counts["a@example.com"], 2)
  assert.equal(manifest.counts["b@example.com"], 1)
  assert.equal(manifest.parts["0"].access, "private")

  gets.length = 0
  const restricted = await resolveGmailAccounts(USER, async () => {
    throw Object.assign(new Error("Service for this project is restricted"), { status: 402, code: "exceed_egress_quota" })
  })
  assert.equal(restricted.source, "snapshot")
  assert.equal(restricted.notice, savedMailNotice("2026-11-13T18:05:00.000Z"))
  assert.match(restricted.notice, /Showing your saved mail from 2026-11-13 18:05 UTC/)
  assert.match(restricted.notice, /Live sync resumes when the database is back/)
  assert.deepEqual(restricted.accounts.map(a => a.google_email), ["a@example.com", "b@example.com"])
  assert.equal(restricted.accounts.find(a => a.google_email === "a@example.com").is_primary, true)
  assert.equal(restricted.accounts.find(a => a.google_email === "a@example.com").last_gmail_sync_at, "2026-11-10T14:44:44.000Z")
  assert.ok(gets.every(path => path.endsWith("/manifest.json")))

  const page = await snapshotThreads(USER, { days: 30, limit: 1, offset: 1 })
  assert.equal(page.total, 3)
  assert.equal(page.threads.length, 1)
  assert.equal(page.threads[0].threadId, "t-mid")
  assert.equal(page.threads[0].accountEmail, "b@example.com")

  const partGets = gets.filter(path => path.includes("/part-")).length
  await snapshotThreads(USER, { days: 30, limit: 1, offset: 0 })
  assert.equal(gets.filter(path => path.includes("/part-")).length, partGets)

  const live = await resolveGmailAccounts(USER, async () => [liveAccount("live@example.com")])
  assert.equal(live.source, "supabase")
  assert.equal(live.notice, null)
  assert.equal(live.accounts[0].google_email, "live@example.com")
})

test("import rejects an oversized part, a foreign user, and sync after part 0", async () => {
  setGmailSnapshotBackendForTests(createMemorySnapshotBackend())
  const tooMany = await acceptSnapshotPart({
    user_id: USER,
    part: 0,
    total: 1,
    threads: Array.from({ length: MAX_THREADS_PER_PART + 1 }, (_, i) => thread(`t${i}`, "a@example.com", i + 1)),
  })
  assert.equal(tooMany.status, 400)
  const foreign = await acceptSnapshotPart({
    user_id: USER,
    part: 0,
    total: 1,
    threads: [{ ...thread("t1", "a@example.com", 10), user_id: OTHER }],
  })
  assert.equal(foreign.status, 400)
  const syncLate = await acceptSnapshotPart({
    user_id: USER,
    part: 1,
    total: 2,
    sync: [{ user_id: USER, account_id: "acct-a", last_sync_at: null, days_synced: 1 }],
    threads: [],
  })
  assert.equal(syncLate.status, 400)
  const other = await resolveGmailAccounts(OTHER, async () => {
    const error = new Error("exceed_egress_quota")
    error.status = 402
    throw error
  })
  assert.equal(other.accounts.length, 0)
  assert.match(other.notice, /Live sync resumes when the database is back/)
  assert.equal(isGmailQuotaError({ message: "row not found", code: "PGRST116" }), false)
  assert.equal(isGmailQuotaError({ code: "restricted", message: "egress is restricted" }), true)
})

test("the jobs inbox and the accounts list call the snapshot switch", () => {
  const lib = readFileSync(new URL("../../src/app/api/gmail/_lib.ts", import.meta.url), "utf8")
  const sync = readFileSync(new URL("../../src/app/api/gmail-sync/route.ts", import.meta.url), "utf8")
  const accounts = readFileSync(new URL("../../src/app/api/connections/status/route.ts", import.meta.url), "utf8")
  const route = readFileSync(new URL("../../src/app/api/gmail/snapshot-import/route.ts", import.meta.url), "utf8")
  assert.match(lib, /loadWorkspaceAccounts/)
  assert.match(lib, /loaded\.source === "snapshot"/)
  assert.match(sync, /loadWorkspaceAccounts/)
  assert.match(sync, /loaded\.source === "snapshot"/)
  assert.match(accounts, /loadWorkspaceAccounts/)
  assert.match(route, /x-import-secret/)
  assert.match(route, /authorizeSnapshotImport/)
  assert.match(route, /MAX_SNAPSHOT_BODY_BYTES|snapshotBodyTooLarge/)
})
