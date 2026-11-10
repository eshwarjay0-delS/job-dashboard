# Gmail per-account sync health — 9 November 2026

## Request and scope

Continue the approved Poke-inspired multi-account Gmail and mobile-update work. The implementation boundary is account visibility and reliable status reporting; it does not copy Poke internals or enable automatic sends. The current task does not send Gmail or WhatsApp messages.

## Source finding

The Gmail thread API already received both classified threads and per-account issues from fetchClassifiedThreads. The shared data hook retained those issues, but the inbox page only displayed the global LiveIndicator and showed the error banner only when no messages were returned. If one inbox failed while another returned mail, the healthy inbox remained usable but the failing account was not visible.

The existing mfit_gmail_sync table already records last_sync_at and days_synced by authenticated user and connected account. The source audit found no need for a new table or account merge.

## Change

- Add a small status model that distinguishes synced, partial, failed, and a successful direct check without a persisted sync row (checked).
- Return each connected account's status and last successful timestamp from the authenticated Gmail thread route.
- Keep the status in the existing user-keyed local Gmail snapshot, preserving the existing account boundary.
- Show status on each inbox chip and surface partial failures even when another account has mail.
- Use safe recovery language for throttling and reconnect conditions without echoing raw provider response bodies.
- Keep the existing two-minute mail refresh, inbox-update consent, WhatsApp receipt handling and background scheduler configuration unchanged.

## Validation

A focused Node test and workflow cover status classification, retained last-success timestamps, safe recovery copy, API wiring, user-scoped snapshot persistence and visible partial failures. Full CI and production deployment are separate gates. No live Gmail API calls, email sends, WhatsApp sends, or connected-account acceptance are claimed.

## Acceptance still required

Use two authorized test inboxes: one successful and one partial or failed. Confirm each status and last-success timestamp remains attached to the correct inbox; reconnect the failed account and verify recovery without changing the selected From identity. Verify on a narrow mobile viewport. Mobile provider delivery remains separately dependent on the approved WhatsApp template, scheduler configuration, signed Meta callback setup and a controlled opted-in device test.


## 10 November restack — PR #271

The implementation was restacked onto current master `51cb716393efb1f54cdc6173c8e6b7ee6f034241` as source commit `11582106771e4f9c94f9325bd5da0108b6171f5f`. PR #271 is intentionally DRAFT. The old PR #268 exact head passed full CI `42738187227`, Kompas baseline `42738186923` and the Gmail-specific regression `42738186930`; those results do not validate the restacked head. Exact-head checks must be rerun.

The separate acceptance gate remains open: two authorized connected inboxes (one healthy, one partial/failed), status and last-success timestamp isolation, recovery without changing the selected From identity, and a narrow mobile viewport. No Gmail API call, email send or WhatsApp send was performed.


## 10 November exact-head validation update

Gmail account-sync-health regression 42752094672, Kompas baseline 42752095031, and full CI 42752095028 all completed SUCCESS on exact head d4d3ac7d270f7b1d7d281a70cd558b2d424c90cd. Preview dpl_G2sX9yZEUis54yvaeoFStS6UXVnf is READY at that exact SHA. Production alias job-dashboard-fawn.vercel.app remains READY at master 51cb716393efb1f54cdc6173c8e6b7ee6f034241 on dpl_G92eEx6vGFhgfstAocq9jkGKm6i9; PR #271 is not deployed. Read-only production aggregate: 3 Gmail sync rows, 1 user, 3 connected account IDs; all 3 have a last_sync_at within 24 hours, none within the last hour. This proves persisted sync activity only, not the new status UI or a controlled partial/failure/reconnect scenario.

The exact-head code gates are now complete, superseding the earlier restack note that said to rerun them. PR #271 remains DRAFT because the required authenticated test is not available here: two authorized inboxes with one healthy and one partial/failed, recovery without changing the selected From identity, and a narrow mobile viewport. No Gmail API calls, emails or WhatsApp messages were sent. Do not merge or deploy from CI alone.
