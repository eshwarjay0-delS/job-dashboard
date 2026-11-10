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
