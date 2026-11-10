export type GmailAccountSyncState = "synced" | "partial" | "failed" | "checked"

export type GmailStoredSyncState = {
  last_sync_at: string | null
  days_synced: number
}

export type GmailAccountSyncStatus = {
  account: string
  status: GmailAccountSyncState
  lastSyncAt: string | null
  daysSynced: number
}

export type GmailAccountSyncIssue = {
  account: string
  reason: string
}

export function buildGmailAccountSyncStatus(
  account: string,
  stored: GmailStoredSyncState | null,
  issue: GmailAccountSyncIssue | null,
): GmailAccountSyncStatus {
  const parsed = stored?.last_sync_at ? Date.parse(stored.last_sync_at) : Number.NaN
  const lastSyncAt = Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
  const reason = issue?.reason.toLowerCase() || ""
  const status: GmailAccountSyncState = issue
    ? /history scan is partial|not a complete inbox inventory|counts are not complete/.test(reason) ? "partial" : "failed"
    : lastSyncAt ? "synced" : "checked"

  return {
    account,
    status,
    lastSyncAt,
    daysSynced: Number.isFinite(stored?.days_synced) ? Math.max(0, stored!.days_synced) : 0,
  }
}

function relativeAge(iso: string | null, now: number): string {
  if (!iso) return "no prior successful sync"
  const stamp = Date.parse(iso)
  if (!Number.isFinite(stamp)) return "previous sync time unavailable"
  const minutes = Math.floor(Math.max(0, now - stamp) / 60_000)
  if (minutes < 1) return "just now"
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatGmailAccountSyncStatus(status: GmailAccountSyncStatus, now = Date.now()): string {
  if (status.status === "failed") return `Sync failed · last success ${relativeAge(status.lastSyncAt, now)}`
  if (status.status === "partial") return `Partial · last success ${relativeAge(status.lastSyncAt, now)}`
  if (status.status === "synced") return `Synced ${relativeAge(status.lastSyncAt, now)}`
  return "Checked just now"
}

/** Display a useful recovery action without echoing raw provider errors or response bodies. */
export function gmailAccountSyncIssueMessage(reason: string): string {
  const value = reason.toLowerCase()
  if (/rate_limit|rate limit|throttl|quota|\b429\b/.test(value)) {
    return "Gmail is temporarily limiting requests. Wait a few minutes, then refresh."
  }
  if (/invalid_grant|unauthorized|permission|scope|reconnect|\b401\b|\b403\b/.test(value)) {
    return "Reconnect this inbox in Connections, then refresh."
  }
  if (/history scan is partial|not a complete inbox inventory|counts are not complete/.test(value)) {
    return "This inbox was only partly checked. Some results may still be missing."
  }
  return "This inbox could not be checked. Retry or reconnect it in Connections."
}

export function gmailAccountSyncStatusTone(status: GmailAccountSyncState): "danger" | "warning" | "success" | "muted" {
  if (status === "failed") return "danger"
  if (status === "partial") return "warning"
  if (status === "synced") return "success"
  return "muted"
}
