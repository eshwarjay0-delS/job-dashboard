# Kompas account-sync production read-only evidence — 21 November 2026

## Method and safety

Read-only SQL was run against the production-linked Supabase project `ruajlrzmxzprmmngluxy` (project status `ACTIVE_HEALTHY`). Only aggregate counts, JSON key names/types and privilege booleans were queried. No session payloads, user IDs, resume/JD text, transcripts, credentials or secrets were selected. No database writes, imports, deletions, handoff claims or device actions occurred.

Canonical production alias at the time of inspection: `job-dashboard-fawn.vercel.app` → READY deployment `dpl_EZce7dEERrv1eVUFf64YoAzwoicb`, production SHA `3a1b0bb718874f8fca5adc5f78362d3009a11281`. Current master is `13542c5e1127ed7c1ccf59e4faa034d0af021fc1`; its latest change is documentation-only PR #484, so the deployed runtime SHA is unchanged by this evidence note.

## Persisted catalog counts

| Table | Rows | Active / unexpired | Tombstones / expired | Distinct owners |
|---|---:|---:|---:|---:|
| `kompas_account_sessions` | 22 | 15 active | 7 deleted | 1 |
| `kompas_account_session_artifacts` | 28 | 28 linked to active sessions | 0 linked to tombstones | 1 |
| `kompas_desktop_handoffs` | 0 | 0 | 0 | 0 |

Of the 15 active sessions:
- 13 have at least one artifact; 28 artifact rows are associated with those active sessions.
- 0 artifacts are orphaned from both active and tombstoned session rows.
- 15 have non-empty JD and resume fields.
- 5 have non-empty user instructions; all 5 exceed 20,000 characters. Maximum observed instruction length is 47,105 characters.
- 6 have non-empty serialized document fields; maximum observed length is 16,000 characters.
- 13 have non-empty transcript arrays.
- 9 artifact payload rows contain a transcript field.
- The 7 tombstoned session rows have no associated artifacts in this snapshot.

These are database persistence observations, not proof that a particular second browser, phone or installed Windows executable retrieved the records.

## Security boundary

All three account-sync/handoff tables have RLS enabled. Direct table SELECT and INSERT privileges are false for both `anon` and `authenticated`; they are true for `service_role`. The `claim_kompas_desktop_handoff(text)` function is executable by `service_role` only; `anon` and `authenticated` execute privileges are false.

This supports the intended service-mediated, account-scoped API boundary. It does not by itself prove every API filter, ticket lifecycle or native client behavior.

## Remaining acceptance gaps

- The catalog currently contains rows for one distinct owner only. This does not demonstrate cross-account isolation through two real accounts.
- No desktop handoff tickets exist in the table, so no actual Chrome-to-Windows ticket claim is evidenced by this snapshot.
- The database cannot identify which devices retrieved each session; real signed-in two-device acceptance remains unverified.
- Installed Windows login, 72-hour continuity, mobile browser, WhatsApp discovery and real caption/audio capture remain separate device acceptance gates.
- No live browser, Windows PC or phone was available to this read-only check.

## Next

Continue: use an owner-consented same-account browser/Windows test to verify retrieval of an existing active session, its long instructions and transcript; then verify a second account cannot see it. Require a real single-use desktop handoff claim before marking native launch accepted. Do not fabricate device evidence from row counts or CI.
