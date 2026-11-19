# Gmail Important sender normalization — 19 November 2026

## Scope and owner boundary

This is a narrow source correction within the approved Poke-inspired multi-account Gmail work. The latest owner correction retrieved from prior conversation at 2026-11-19T08:20:00Z preserves the existing four-account ceiling and requires the mobile navigation menu below the sticky header in normal document flow, pushing content down without overlay, scrim, dimming or page inertness. The Poke-style worker, notifications, scheduler and sending remain disabled. PR #440's no-cap migration remains unapproved.

## Source finding

At canonical master `d03f18892015bdfceb277500978cbacd95ae7808`, `src/lib/mail-important.ts` lowercased the requested account and sender values but compared them against stored values without normalizing the stored side. A valid rule persisted with mixed-case account/sender values could therefore fail to match the same logical account and sender.

The identity boundary is still receiving Gmail account + sender address. The fix must not collapse the same sender across different inboxes.

## Implemented source correction

- Trim and lowercase the requested receiving-account address.
- Trim and lowercase the requested sender address.
- Trim and lowercase both stored rule values before comparison.
- Keep the account component in the predicate; a matching sender in another inbox remains a separate rule.
- Do not alter selected-From token binding, OAuth behavior, account limits, notification worker flags or send paths.

## Regression

`scripts/tests/gmail-send-account-isolation.test.mjs` adds an executable test using two stored rules with the same sender in differently cased account addresses. It checks both inboxes independently, rejects a third inbox, and rejects a different sender. The predecessor PR #437 exact-head workflows passed, but its branch was based on an older master; this current-master restack requires fresh exact-head workflows.

## Validation and release status

- Canonical base: `d03f18892015bdfceb277500978cbacd95ae7808`.
- Predecessor PR #437 head: `3dd0256d2783f55722bb4028b550c938a5e17903`.
- Predecessor full CI: `44026214076` SUCCESS.
- Predecessor Kompas baseline: `44026214087` SUCCESS.
- Predecessor Plan/REA: `44026214099` SUCCESS.
- Current-master PR #452 head: `a18e83a35ce79f03eb2ec70f8b8303ec12c8f94d` (source and Plan/REA documentation commit).
- New current-master restack: exact-head full CI, Kompas baseline and Plan/REA pending.
- Vercel project `job-dashboard`: `live=false`; latest production deployment `dpl_AknmUNcd9Cgo8mTiZz3Ex7FEfb9i` CANCELED.
- Canonical alias: `job-dashboard-fawn.vercel.app` → READY `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. This does not include the current master or this change.

## Acceptance still required

1. Exact-head full CI, Kompas baseline and Plan/REA.
2. MFit Safe Merge Gate review and a legitimate protected preview; the owner-controlled private preview credential is unavailable to this run.
3. Two authorized inboxes with the same sender and a shared/colliding provider thread ID, proving independent Important state and correct receiving-inbox selection.
4. Selected-From and reconnect behavior on the affected inbox.
5. Narrow-phone menu acceptance for normal-flow expansion below the sticky header.
6. Production READY deployment on a reviewed master descendant and canonical alias verification.

No Gmail API/OAuth request, inbox read/mutation, email or WhatsApp send, proactive worker, scheduler, production write, protected-preview bypass or device test occurred. Source tests do not establish fresh Gmail sync or real Poke-style delivery.
