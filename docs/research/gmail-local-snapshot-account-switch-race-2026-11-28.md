# Gmail local snapshot publication race — 28 November 2026

## Request and scope

Continue the owner-approved multi-account Gmail/account-isolation work. This is a source-level privacy candidate; no Gmail OAuth, mailbox reads, mutations, sends, or user-device tests are performed.

## Evidence

- Canonical master at review: `bf9a0d41855f35f26d341bc31e88c8033b15dc13`.
- Source: `src/lib/use-gmail-data.ts`, `refreshGmailDataForCurrentAccount()`.
- Existing test: `scripts/tests/mail-digest-account-isolation.test.mjs`.
- Tracking issue: [#623](https://github.com/eshwarjay0-delS/job-dashboard/issues/623).

The refresh path awaits `snapshotKey()`, then reads the captured user-keyed local snapshot and publishes it to listeners without a generation/current-user check. The existing account-A in-flight test exercises the later shared network load; it does not call this refresh/local-snapshot path. A delayed A identity lookup can therefore potentially publish A mail after a reset to B.

## Candidate fix

Draft [PR #626](https://github.com/eshwarjay0-delS/job-dashboard/pull/626) captures the account-switch generation, checks it after the first identity lookup, rechecks the current verified key, and aborts before reading/publishing if the identity or generation changed. It retains same-account restore. Regression coverage includes delayed A→B, sign-out, and same-account positive control.

Code commits:
- `adbf4ec0b722824c020f527e1c40f9246c1e7c0c` — guard local snapshot restore.
- `4729be6746cc4e4824417b69e6d8986f4fac0b55` — regression harness.

## Validation and limits

The local checkout/dependencies and installed Next.js 16.3.8 docs are unavailable. The Vercel sandbox restore quota remains blocked until the previously recorded 1 Dec 2026 cooldown; it was not bypassed. Local tests/build were not run. Exact-head GitHub CI is the next remote validation and must be inspected before any merge. No production deployment, mailbox access, OAuth, inbox mutation or send occurred.

## Next action

Continue: verify the draft PR's exact head and CI, review the complete source/test diff, and request independent review. Keep it draft if any gate is missing or failing. After approved merge, production READY deployment and alias verification are separate; account-switch and sign-out behavior still require authenticated browser acceptance.
