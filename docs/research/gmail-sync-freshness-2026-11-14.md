# Gmail sync freshness audit — 14 November 2026

## Purpose

Continue the owner-approved Poke-inspired multi-account Gmail/mobile work while distinguishing source implementation, durable sync state, background worker approval and actual inbox/device acceptance.

## Production-linked read-only evidence

- `private.google_workspace_accounts`: 3 accounts, all `gmail_enabled`, 1 user; latest account metadata update 11 Oct 2026 20:58 UTC.
- `public.mfit_gmail_sync`: 3 account rows; each last synced on 10 Nov 2026 between 14:44:20 and 14:44:22 UTC; each retains a 90-day sync window.
- `public.mfit_gmail_threads`: 2,002 rows across 3 accounts; latest per-account `updated_at` values are 10 Nov 2026 between 14:44:44 and 14:46:49 UTC.
- All queries were SELECT-only aggregates. No email addresses, account IDs, subjects or message bodies were emitted.

## Cron and worker status

- Canonical `vercel.json` schedules `/api/gmail/crawl` daily at 12:00 UTC.
- Production `CRON_SECRET` exists (value not read).
- `src/app/api/gmail/_lib.ts` uses `CACHE_FRESH_MS = 5 * 60 * 1000`; a successful daily cache warmer should refresh each account after five minutes.
- The 14 Nov 12:00 UTC cron invocation cannot be inspected now: Vercel Hobby individual runtime logs retain only one hour. Vercel's seven-day grouped runtime-error query for `/api/gmail/crawl` and `/api/gmail` returned no grouped errors. Supabase `edge_logs` had no `exceed_egress_quota` events in the preceding 24 hours. Neither result proves the cron succeeded; the durable sync timestamps remain 10 Nov.
- `GMAIL_UPDATES_SCHEDULER_ENABLED` and `WHATSAPP_GMAIL_UPDATE_TEMPLATE` are absent. The separate proactive 10–15-minute Poke-style worker and external notifications remain disabled.
- The production `GMAIL_SNAPSHOT_IMPORT_SECRET` variable is an empty sensitive record. PR #396 removes the default HMAC fallback; without an owner-approved legacy migration/compatibility path, existing sealed snapshots may become unreadable. PR #396 is non-mergeable on an older base and has no exact-head checks.

## Existing product behavior

- Account-scoped Important sender tracking and the combined Important inbox already exist; do not duplicate them.
- PR #401 adds the current-master account-scoped digest/thread identity, receiving-inbox selection, selected-From preservation, affected-inbox reconnect and normal-flow no-cover mobile navigation.
- PR #401 head `ab1ad5017adfe089b47cefc1072679f8426b49f5` passed full CI `43630283482`, Kompas baseline `43630283480` and Plan/REA `43630283444`. It remains DRAFT; protected preview, two authorized inboxes with colliding sender/thread IDs, selected-From/reconnect acceptance and a real narrow-phone check are still required.

## Exact limits and next work

No Gmail API/OAuth call, inbox read or mutation, email send, WhatsApp send, worker enablement, Meta template change or production database write occurred. The daily cron's exact 14 Nov invocation and per-account outcome are unknown because the individual logs have expired.

Continue: verify the next daily cron with retained logs or add a separately reviewed persistent per-account sync-run audit. Keep the proactive worker disabled until its owner-approved scheduler and notification template are configured. Resolve PR #396's legacy snapshot compatibility before merging. Do not claim Poke-style background updates or phone acceptance from the source-level PR and unit tests alone.
