# Gmail four-account ceiling regression guard — 17 November 2026

## Owner correction

The latest accessible owner correction at 2026-11-17T18:08:40Z keeps the existing four-account ceiling. Removing it is not approved. This supersedes earlier assistant-authored wording that treated the historical 3–4 account range as permission for a no-cap implementation. PR #440 remains a separate unapproved proposal and is not included.

## Source evidence

Canonical master at the start of this slice was `66291f677cbcc2318229ef9a3164961e6d3cdb6a`. The migration `supabase/migrations/20261004_multi_google_workspace_accounts.sql` defines `public.identity_list_google_workspace_accounts`, orders the primary account first and then by connection time, and applies `LIMIT 4`. PR #435's approved digest/mobile work does not change this migration or the account ceiling.

## Regression added

- `scripts/tests/gmail-account-cap.test.mjs` scans all SQL migrations in lexical order and inspects the latest definition of `public.identity_list_google_workspace_accounts`.
- It asserts the primary-first, stable connection ordering and the exact `LIMIT 4` ceiling, so a later migration cannot silently remove or increase the cap.
- `.github/workflows/ci.yml` runs this test alongside the existing Gmail selected-sender, per-inbox isolation and digest-account tests.
- Test commit: `8093779b282c410e72812d21eaeca213bbf0635f`.
- CI wiring commit: `4b06534e211c1446cb458416a148df66f90890b9`.

This is a source-contract regression only. It does not change runtime behavior, apply a migration, connect or disconnect accounts, or prove live database behavior.

## Release and acceptance state

PR #435 remains DRAFT. Its predecessor head `38fef8745fb0d1370c85fdc6fbe6373748d33e89` passed full CI, Kompas baseline and Plan/REA, but those results are not reused after this test and documentation change. Exact-head full CI, Kompas baseline and Plan/REA must pass on the final branch head.

The protected preview remains unavailable because the Vercel project reports `live:false`, the latest production deployment is CANCELED, and the owner-controlled protected-preview token is not available to this run. Two-inbox collision, selected-From preservation, independent mute/reconnect and narrow-phone acceptance remain outstanding. Keep the Poke worker, proactive notifications and automated sending disabled.

## Limits

No Gmail API/OAuth call, inbox read or write, email send, scheduler activation, production database mutation, deployment, or device acceptance occurred. A static migration test is not a live two-inbox acceptance test.
