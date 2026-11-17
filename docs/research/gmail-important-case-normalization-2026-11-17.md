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
- GitHub Actions exact-head CI and Plan/REA checks: pending PR creation in this run.
- Local checkout/test execution: unavailable; `git ls-remote` could not resolve `github.com`. No local test success is claimed.

## Release and acceptance limits

No Gmail API/OAuth request, inbox mutation, email send, WhatsApp send, production database write or device test occurred. This branch is not deployed. The separate Poke-style worker remains disabled. Protected preview, two-authorized-inbox behavior, selected-From/reconnect acceptance and a narrow-mobile device check are still required before production completion.
