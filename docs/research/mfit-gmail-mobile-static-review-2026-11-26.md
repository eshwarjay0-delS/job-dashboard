# Gmail multi-account/mobile static review — 26 November 2026

## Scope

Read-only source review of approved Poke-inspired in-app digest and normal-flow mobile navigation. No Gmail OAuth, mailbox read, send, draft mutation, notification worker or device interaction was used.

## Historical owner direction

`docs/gmail.md` records 3–4 connected accounts, per-account identity/From, four mobile account toggles, an in-app inbox digest and Poke-inspired proactive-mail direction. The current explicit boundary remains: proactive workers, scheduler, notifications and sending are disabled; this review covers only in-app UI/data behavior.

## PR #576 exact head

`1757fb68715081525de0f8c7b8bd3bf531ebff20` is DRAFT, based on stale `794e8cfdbd3103409552857806bab89851d5bfcb`. Its 11-file diff adds account-scoped digest sender mutes, account+thread identity for waiting radar and React keys, account-aware digest/role/radar opening, reply-composer/draft account binding, the four-account cap, and normal-flow mobile navigation with outside-click/Escape/focus behavior.

Static review COMMENT `6076244479` found no obvious defect in that narrow diff; it is not approval. The review confirms the receiving account is passed into open actions and is part of the digest/radar/thread identity, so identical thread IDs across inboxes do not collide in the reviewed UI path.

## Validation

- Kompas baseline: SUCCESS (`45401091926`).
- Full CI: FAILURE (`45401091730`), only the shared lint error `src/lib/kompasConsistency.ts:1059` (`prefer-const`, `s` never reassigned). The branch predates current master `e2a94783041559c8c0c317f860ef1ba792de9fc9`, which already has the `const` correction.
- The new `mail-digest-account-isolation.test.mjs` is wired into CI, but the lint failure stopped the job before that test ran. Do not call the Gmail tests green.
- PR #580 remains owner-merge-tap gated; no preview, two-inbox, narrow-phone or live Gmail acceptance exists for #576.

## Next

Clean-restack #576 onto current master only in the compliant environment, run exact-head full CI including the digest test, then protected preview and owner-consented two-inbox/narrow-phone acceptance. Preserve the four-account ceiling and keep proactive sending/scheduling off.
