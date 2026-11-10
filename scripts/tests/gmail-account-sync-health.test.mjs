import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import {
  buildGmailAccountSyncStatus,
  formatGmailAccountSyncStatus,
  gmailAccountSyncIssueMessage,
  gmailAccountSyncStatusTone,
} from "../../src/lib/gmail-account-sync-status.ts"

const read = path => readFileSync(new URL(path, import.meta.url), "utf8")

test("successful account sync exposes its own last-success timestamp", () => {
  const status = buildGmailAccountSyncStatus("first@example.com", {
    last_sync_at: "2026-11-09T10:00:00.000Z",
    days_synced: 30,
  }, null)

  assert.equal(status.account, "first@example.com")
  assert.equal(status.status, "synced")
  assert.equal(status.daysSynced, 30)
  assert.equal(formatGmailAccountSyncStatus(status, Date.parse("2026-11-09T12:00:00.000Z")), "Synced 2h ago")
  assert.equal(gmailAccountSyncStatusTone(status.status), "success")
})

test("partial and failed accounts retain the last successful sync instead of hiding it", () => {
  const stored = { last_sync_at: "2026-11-09T10:00:00.000Z", days_synced: 30 }
  const partial = buildGmailAccountSyncStatus("partial@example.com", stored, {
    account: "partial@example.com",
    reason: "History scan is partial. Counts are not a complete inbox inventory.",
  })
  const failed = buildGmailAccountSyncStatus("failed@example.com", stored, {
    account: "failed@example.com",
    reason: "Google access failed: invalid_grant",
  })
  const now = Date.parse("2026-11-09T12:00:00.000Z")

  assert.equal(partial.status, "partial")
  assert.equal(formatGmailAccountSyncStatus(partial, now), "Partial · last success 2h ago")
  assert.equal(gmailAccountSyncStatusTone(partial.status), "warning")
  assert.equal(failed.status, "failed")
  assert.equal(formatGmailAccountSyncStatus(failed, now), "Sync failed · last success 2h ago")
  assert.equal(gmailAccountSyncStatusTone(failed.status), "danger")
})

test("a successful direct check is not falsely called a persisted sync", () => {
  const checked = buildGmailAccountSyncStatus("direct@example.com", null, null)
  assert.equal(checked.status, "checked")
  assert.equal(checked.lastSyncAt, null)
  assert.equal(formatGmailAccountSyncStatus(checked), "Checked just now")
})

test("safe account recovery messages classify throttling and reauthorization without echoing provider bodies", () => {
  const throttle = gmailAccountSyncIssueMessage("RATE_LIMIT: Gmail API 429 — private provider detail")
  const reconnect = gmailAccountSyncIssueMessage("Google access failed: invalid_grant")
  const partial = gmailAccountSyncIssueMessage("History scan is partial. Counts are not a complete inbox inventory.")
  const generic = gmailAccountSyncIssueMessage("unexpected provider response with private detail")

  assert.match(throttle, /temporarily limiting requests/)
  assert.match(reconnect, /Reconnect this inbox/)
  assert.match(partial, /only partly checked/)
  assert.match(generic, /could not be checked/)
  for (const message of [throttle, reconnect, partial, generic]) {
    assert.doesNotMatch(message, /private provider detail|invalid_grant|unexpected provider response/)
  }
})

test("Gmail API, user-scoped snapshot and inbox UI carry partial account health end to end", () => {
  const api = read("../../src/app/api/gmail/threads/route.ts")
  const shared = read("../../src/app/api/gmail/_lib.ts")
  const hook = read("../../src/lib/use-gmail-data.ts")
  const page = read("../../src/app/dashboard/mail/page.tsx")

  assert.match(shared, /readAccountSyncStatuses\(sb, userId, enabled, issues\)/)
  assert.match(api, /const \{ threads, issues, accountSync \} = await fetchClassifiedThreads/)
  assert.match(api, /mails, issues, accountSync/)
  assert.match(hook, /accountSync: threadsRes\.data\?\.accountSync \|\| \[\]/)
  assert.match(hook, /accountSync: data\.accountSync/)
  assert.match(hook, /accountSync: snap\.accountSync \|\| \[\]/)
  assert.match(page, /accountSync\.find\(status => status\.account\.toLowerCase\(\) === a\.email\.toLowerCase\(\)\)/)
  assert.match(page, /Some inboxes need attention/)
  assert.match(page, /Retry inbox sync/)
})
