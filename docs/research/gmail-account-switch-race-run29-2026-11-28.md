# Gmail local snapshot account-switch race — Run 29 (28 Nov 2026)

## Scope and approval
This is a privacy guard for the already-approved multi-account Gmail workspace, not a new feature. Issue #623 records a source-level race in `refreshGmailDataForCurrentAccount()`: account A's delayed `snapshotKey()` could finish after an A→B switch or sign-out and publish A's local snapshot to the current listeners. The issue is a candidate established by source inspection, **not a reproduced browser incident**.

## Prior exact-head evidence
PR #626, head `98e05b2b1e2c01b15c7fc6220079c0accbfc781`, had four remote gates reported SUCCESS:
- Full CI: 46105859856
- Plan/REA: 46105652267
- Kompas baseline: 46105652265
- Confirmed-skill regression: 46105652280

The PR remained DRAFT and non-mergeable because it was based on `bf9a0d`, behind master. Its review found the generation/current-account guard and delayed A→B/sign-out/same-account controls appropriate.

## Run 29 work
A clean branch was created from current master `be063d6977760f902c1ced3a3078d9323229ea38`:
`fix/gmail-snapshot-account-switch-race-20261128-watch11`.

- `src/lib/use-gmail-data.ts`: ported the six generation/current-user checks into the local snapshot restore path. Account reset invalidates the delayed A path; the current verified key must still match before publishing.
- `scripts/tests/mail-digest-account-isolation.test.mjs`: ported two deferred-identity tests: A→B cannot publish A after B, sign-out cannot republish A, and same-account restore remains a positive control.
- Source commits: `05c28574769213f3d4220b5d537c7634260bc8fe`; test commit: `2129c321f0161eaf607207c21ff061ea12fb5977`.

## Validation boundary
- No canonical checkout or dependency install exists in this run. The original PR #626 remote CI passed; the clean restack's exact-head CI is pending.
- No Gmail OAuth, inbox reads/writes, email sends, production deployment or real browser acceptance.
- Current live alias is still the earlier release; this fix is not live.

## Next
Inspect the clean branch's exact-head full CI, Plan/REA and Kompas baseline. Review the source/test scope and merge only after all required checks pass. Keep the real two-account browser acceptance separate. Do not deploy or claim the fix live until the exact production SHA and alias are verified.


## Run 29 follow-up
PR #632's Plan/REA run 46115504464 failed on the existing remote branch source locator, not on the Gmail code. Test-only PR #635 validates remote references while retaining local path checks; its local probe is 4/4, remote CI is pending. Keep #632 draft until #635 is validated/merged and its exact-head gates rerun.
