# Gmail account-switch snapshot guard — Run 30 (28 November 2026)

## Approval and scope
Owner-approved multi-account Gmail scope: up to four accounts, per-account/thread identity isolation, selected-From preservation, ordinary-flow mobile navigation. Proactive Poke workers, scheduler, notifications and sending remain explicitly disabled. This slice is a safety correction to the local snapshot path; it does not add background activity or read/send mail.

## Source finding and fix
In `src/lib/use-gmail-data.ts`, `refreshGmailDataForCurrentAccount()` awaited the Supabase identity lookup and then published a local snapshot without checking whether the account-switch generation had changed. A delayed account-A snapshot could therefore be emitted after an A→B switch or sign-out. The current-master restack captures the generation, verifies it after the first identity lookup and again after a second identity confirmation, and checks before publishing and before invoking the shared loader. It preserves the same-account local restore.

## Tests
The source-executed VM regression adds:
- A deferred account-A lookup followed by a switch to B; B's snapshot publishes and A's late snapshot is rejected.
- Sign-out while A's lookup is pending; A is not republished.
- Same-account A restoration still works.

Earlier PR #637 head `5740a534` had full CI and Kompas baseline SUCCESS, but this fresh current-master restack needs its own exact-head CI. No local checkout/dependencies or browser session are available.

## Limits and next steps
No Gmail OAuth, inbox read/write, send, mobile click-through, production deployment, or four-account acceptance occurred. Require fresh full CI/baseline, source review, protected preview, production READY+canonical alias, then owner-consented account-switch verification with real connected accounts. Keep selected-From and reply/thread identity tests; do not enable proactive workers, scheduler, notifications, or sending.
