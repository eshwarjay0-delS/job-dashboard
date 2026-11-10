# Poke-style per-account Gmail sync health — 10 November 2026

## Owner-approved scope

The Poke-inspired multi-account direction requires up to four connected inboxes, account+thread identity, no silent merge, per-account reconnect, selected-From preservation, and visible last-success/partial-failure state. This change adds a small inline status to the existing Inbox Updates panel; it does not introduce the separate draft PR #271 card.

## Production evidence (read-only)

- `mfit_gmail_sync`: 3 rows, 1 user, 3 account IDs.
- `mfit_gmail_threads`: 2,002 rows, 1 user, 3 account IDs.
- Latest sync-table write: 2026-11-10 14:44:44 UTC.
- Latest thread-table write: 2026-11-10 14:46:49 UTC.
- Supabase edge logs from 2026-11-09 17:36 UTC through 2026-11-10 17:36 UTC: 22 POSTs to `mfit_gmail_sync` and 49 POSTs to `mfit_gmail_threads`; the latest writes match the timestamps above.

This is aggregate activity only. It does not prove the user was actively using the app, a background worker ran, or that Gmail stopped working.

## Implementation

- Reuse the existing R2 cursor under the authenticated user's `mail/updates/<uid>/cursors/<account-hash>.json` path.
- Return only account email, status and `checkedAt`; never expose Gmail `historyId` or `pageToken`.
- Status values: `never`, `checked`, `partial`, `error`.
- A failed refresh preserves the previous last-success timestamp and marks only the affected account as needing attention.
- GET remains authenticated and `private, no-store`; POST still uses the existing rate limit and cursor durability rules.
- The UI renders the complete account-health snapshot returned by the authenticated POST refresh. Commit 945349e replaces the earlier map-merge after exact-head UI CI showed that the health panel disappeared after refresh; exact-head full CI is still running.
- No background scheduler, WhatsApp delivery policy, external send, Gmail OAuth scope or database schema changes.

## Tests

Mocked tests cover account-specific cursors, partial pages, invalid/unavailable cursor storage, last-success preservation, no history/page-token leakage, UI rendering and the authenticated GET response. They do not call Gmail or WhatsApp.

## Remaining acceptance

- Exact-head full CI, Plan/REA schema and Kompas baseline must pass.
- Test with two authorized inboxes: one healthy and one partial/failed; verify only the affected account is marked and reconnect remains account-scoped.
- Verify the inline status at narrow mobile widths.
- Background refresh remains disabled pending external scheduler, `CRON_SECRET`, approved Meta template and explicit enablement consent.


## 10 November 2026 — refresh snapshot regression follow-up

PR #286 head 9a15cb7 passed the Plan/REA schema and Kompas baseline but failed one full-CI UI assertion: after the mocked POST refresh, event/delivery rows updated while the per-account status panel was missing. The component now uses the complete health array returned by POST as the authoritative account set, preserving the previous snapshot only when the response omits health. Commit 945349e559f336aebf6d91aec282b556578e3cef contains this change. Exact-head Plan/REA 42885821426 and Kompas baseline 42885821421 passed; full CI 42885821430 remains in progress. This is not yet release evidence or real two-inbox/mobile acceptance.
