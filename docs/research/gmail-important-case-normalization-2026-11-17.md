# Important sender case normalization and inbox isolation — 17 November 2026

## Approved behavior

The owner-approved Gmail vision says that **Important means tracked**: marking a thread tracks that sender going forward. Multi-account identity remains account-scoped; the same sender in two connected inboxes is not one shared identity. This work does not enable proactive delivery or create a notification schedule.

## Source finding

- `src/lib/mail-important.ts` accepted mixed-case account and sender addresses in `validTracked`.
- Before this change, `trackedBy` lowercased only the lookup arguments, not the stored rule values.
- New API writes are normalized in `src/app/api/gmail/important/route.ts`, but a previously stored, otherwise-valid mixed-case rule could fail to match.
- `src/lib/mail-update-delivery.ts` also consumes `trackedBy`; the background worker remains disabled, so no notification is activated by this correction.

## Implemented correction

`trackedBy` now trims and lowercases both stored and queried account/email values. The existing `scripts/tests/gmail-send-account-isolation.test.mjs` adds a regression that proves:

1. A mixed-case stored sender matches the same receiving inbox.
2. The same sender does not match a different inbox unless that inbox has its own rule.
3. A different sender in the same inbox does not match.

The change preserves the account component of the key and does not alter selected-From behavior.

## Evidence and validation

- Canonical base: `66291f677cbcc2318229ef9a3164961e6d3cdb6a`
- Helper commit: `2ee3bb5a9269d0a3f0cef08731aeaff1a83b5e1d`
- Test commit: `77a70d0d2f10fc2e14247bb50dd4e6802e4531b6`
- Branch: `fix/gmail-important-case-normalization-20261117`
- PR #437: https://github.com/eshwarjay0-delS/job-dashboard/pull/437 (DRAFT), exact head 6c83abc187ecdedf1975f2bfa6b90dde32d6fcb8. Kompas baseline 44025787975 and Plan/REA schema 44025788056 SUCCESS; full CI 44025787971 remains IN_PROGRESS at step 16, the Kompas migration asset/lossless-import test. The new regression runs later in the existing Gmail selected-sender/account-isolation step.
- Local checkout/test execution: unavailable; `git ls-remote` could not resolve `github.com`. No local test success is claimed.

## Release and acceptance limits

A read-only aggregate query at 2026-11-17T05:33:05Z found 3 sync rows across 1 owner/3 accounts (all older than 24h; latest 2026-11-10 14:44:44 UTC), 2,002 cached threads (latest update 2026-11-10 14:46:49 UTC), and zero provider thread IDs shared across accounts. No Gmail message content was read. No Gmail API/OAuth request, inbox mutation, email send, WhatsApp send, production database write or device test occurred. This branch is not deployed. The separate Poke-style worker remains disabled. Protected preview, two-authorized-inbox behavior, selected-From/reconnect acceptance and a narrow-mobile device check are still required before production completion.


## Production release snapshot — 17 November 2026, 05:33 UTC

- Canonical alias: `job-dashboard-fawn.vercel.app` → READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`.
- Canonical master: `66291f677cbcc2318229ef9a3164961e6d3cdb6a`; neither PR #435 nor PR #437 is deployed.
- Vercel project `live=false`; latest production deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` is CANCELED. No deployment retry or protection bypass was attempted.
- The Gmail sync snapshot is stale; the Poke worker remains disabled. Fresh sync and two-inbox/mobile acceptance are not demonstrated.
