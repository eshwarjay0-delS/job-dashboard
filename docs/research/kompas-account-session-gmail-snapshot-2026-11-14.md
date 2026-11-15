# Production account-session and Gmail catalog snapshot

**Observed:** 2026-11-14T22:56:06.624Z  
**Scope:** Read-only verification of the canonical MFit production Supabase project. This note records aggregate counts and privilege checks only; it does not contain user IDs, session IDs, email addresses, message bodies, or session payloads.

## Kompas account-session catalog

| Measure | Result |
|---|---:|
| Account-session rows | 22 |
| Non-tombstoned rows | 15 |
| Tombstones (deleted_at set) | 7 |
| Non-tombstoned rows without endedAt | 9 |
| Non-tombstoned rows with endedAt | 6 |
| Session-artifact rows | 28 |
| Artifacts without a matching session parent | 0 |
| Distinct session owners | 1 |
| Latest session-row update | 2026-11-09 21:47:34 UTC |

The 9 rows without endedAt are the current non-ended count. The 15 non-tombstoned rows should not be described as 15 active sessions: six already carry an endedAt value.

## Access boundary

The read-only privilege check returned:

- anon: no SELECT on either account-session table; no EXECUTE on claim_kompas_desktop_handoff(text).
- authenticated: no direct SELECT on either account-session table; no EXECUTE on the handoff-claim function.
- service_role: SELECT on both account-session tables and EXECUTE on the handoff-claim function.

This is consistent with the service-mediated API design. It does not replace a review of the deployed API's user authentication, account binding, or row-level behavior.

## Gmail catalog snapshot

| Measure | Result |
|---|---:|
| Gmail sync rows | 3 |
| Distinct synced account IDs | 3 |
| Cached Gmail thread rows | 2,002 |
| Distinct thread account IDs | 3 |
| Latest recorded sync | 2026-11-10 14:44:44 UTC |
| Latest thread update | 2026-11-10 14:46:49 UTC |

These counts do not establish two-inbox collision handling, selected-From preservation, reconnect behavior, or narrow-mobile acceptance. No Gmail API call or email send was performed for this snapshot.

## Interpretation and remaining acceptance

Persisted account-scoped Kompas records and Gmail account partitions exist in production. The database snapshot does not prove that the same account can see the same live session on a second browser, the owner's installed Windows application, a phone, or WhatsApp. WhatsApp still has a separate R2 session catalog.

The latest session update predates this observation by several days, and the latest recorded Gmail sync is 10 November. This audit did not trigger a sync, create a session, or mutate production data.

Remaining acceptance:

1. Owner-consented same-account browser A to browser B verification.
2. Installed Windows verification of session discovery, source revisions, transcript artifacts, and lifecycle updates.
3. Deletion/tombstone propagation and sign-out/account-isolation checks.
4. Separate decision and acceptance for WhatsApp R2 catalog convergence.
5. Two-inbox Gmail collision, selected-From, reconnect, and narrow-phone acceptance.

Status: evidence refreshed; cross-device and mobile end-to-end acceptance remain open. No deployment is required because this change is documentation-only.
