# Poke-inspired Gmail and mobile restack — 23 November 2026

## Owner-approved scope and corrections

- The high-level Poke-inspired multi-account Gmail/mobile direction is approved.
- The owner confirmed four connected Gmail accounts maximum in PR #452 comment 7033546581 on 20 November 2026. Preserve the server-side `LIMIT 4`; PR #440's no-cap migration is not approved.
- Mobile navigation expands below the sticky header in normal document flow and pushes content down. It must not cover the page, dim it, add a scrim, or make the page inert.
- The proactive Poke worker, scheduler, notifications and automatic sending remain disabled. Do not enable them as part of this UI/data-isolation work.
- Per-account Calendar targeting and additional waiting-on-them semantics remain proposed, not owner-approved.

## Restacked behavior

The current-master branch `feat/gmail-poke-mobile-restack-20261123` carries the approved source slice from PR #474 onto master `794e8cfdbd3103409552857806bab89851d5bfcb`:

- Digest sender mutes use receiving account + sender address.
- Digest/radar identity and React keys use receiving account + provider thread ID; opening a digest item selects the correct receiving inbox.
- Reply drafts use authenticated user + receiving inbox + provider thread ID, preventing same-thread IDs in different inboxes or users from sharing drafts.
- The visible From identity remains the receiving inbox; reconnect is scoped to the affected inbox.
- The mobile navigation opens as a normal-flow panel below the sticky header, with no overlay, scrim, dimming or page-inert behavior.
- The server remains authoritative for the four-account ceiling; the client renders the authorized account list without silently truncating it.

## Tests and CI

- `scripts/tests/mail-digest-account-isolation.test.mjs` covers account-scoped mute identity, identical provider thread IDs across inboxes, selected inbox, reply draft isolation, From identity, and the four-account server RPC limit.
- `scripts/tests/dashboard-shell.test.mjs` replaces the obsolete overlay/inert expectation with the current normal-flow contract.
- Both tests are registered in `prebuild`, full CI and a focused Gmail/mobile regression workflow. The focused workflow does not need Gmail credentials or a live inbox.

## Release and acceptance boundary

- Production at restack start: deployment `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, READY at exact master `794e8cfdbd3103409552857806bab89851d5bfcb`; `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` resolve to that deployment.
- The restack is not merged, deployed or preview-accepted. The current master full-CI blocker is separate Kompas work: `prefer-const` plus the VM fixture/Listening-hold chain. PR #554 has all five exact-head gates green but still needs an independent authorized reviewer; PR #557, #552 and #551 must be revalidated after that dependency clears.
- The older PR #474 head `56ba9341479854e3e3b8f59dc99814226721209b` passed full CI, Kompas baseline and Plan/REA on its old base, but is stale/non-mergeable and is retained as history, not used as current-master acceptance.
- Still required: exact-head full CI, Plan/REA, Kompas baseline, a legitimate protected preview, two authorized inboxes with colliding thread IDs, independent mute behavior, selected-From preservation, reconnect scoped to one inbox, and narrow-phone acceptance.

No Gmail API/OAuth call, inbox read or mutation, email/WhatsApp send, scheduler creation, background notification, or live mobile/device test was performed.


## Shared lint blocker follow-up — 23 November

The current-master Gmail/mobile restack ccd81ddd342afd75dd63e21812c93dcde9a5d093 had focused regression, Kompas baseline and Plan/REA SUCCESS, but full CI failed at the shared prefer-const lint error in src/lib/kompasConsistency.ts:1059. Behavior-neutral correction commit 37723ac1ed2e166377ccc1340964bda021b246e0 changes the never-reassigned variable to const. Exact-head workflows remain pending. The four-account ceiling and account isolation remain unchanged; no real inbox, OAuth, send or phone acceptance was performed.


## 23 Nov 2026 — muted sender unmute reachability audit

PR #559 source audit found that mutes filtered **Needs your reply**, **Waiting on them**, and **New today**, but the digest's unmute list used only `needs.filter(isMuted)`. A sender muted while they had a reply-needed mail could later have only waiting/new mail (or no current mail), disappear from every digest section, and lose the digest unmute control. The fix in code commit `dab7785df536466c7bc45797c463f1ca3959d262` adds `mutedNotifyRules`, enumerating and normalizing persisted `mode: never` rules by account+sender; duplicate normalized rules collapse, same sender in different inboxes remains separate, `always` rules are excluded, and each unmute button displays the receiving inbox and uses the rule identity rather than a mail/thread ID. A regression covers those cases and the component wiring. This is source/test-only. Exact-head remote validation is pending; no local test execution, Gmail API/OAuth, inbox read/mutation, email send, protected preview, production deploy or device acceptance occurred. The proactive worker, scheduler, notifications and sending remain disabled.


## 23 Nov 2026 — JSX review correction before validation

The initial implementation commit `6b310252` had an unclosed JSX event-handler brace on the mute button. Static source review caught it before CI was claimed; follow-up commit `dab7785df536466c7bc45797c463f1ca3959d262` closes the handler. Exact-head validation is pending on the corrected source. No broken intermediate commit was deployed.


## 23 Nov 2026 — exact-head test correction and focused validation

The first focused run after the mute-recovery change failed one pre-existing static assertion: it expected four mail/thread React keys. The unmute buttons now correctly use account+sender rule keys, leaving three. Test commit `5d930bec63b0b328cc6a8454b0633269b4f37c93` updates the expectation to three and explicitly checks the sender-rule key. On exact head `5d930bec63b0b328cc6a8454b0633269b4f37c93`, Gmail/mobile workflow `45258979200`, Plan/REA schema `45258978883`, and Kompas baseline `45258979291` **PASS**; full CI `45258979321` is **IN PROGRESS**. No full-CI success is claimed. No inbox/OAuth/send/device or protected-preview acceptance.


## Final source/test head status — 23 Nov 2026

Code commit `dab7785df536466c7bc45797c463f1ca3959d262`; test correction `5d930bec63b0b328cc6a8454b0633269b4f37c93`. Focused Gmail/mobile, Plan/REA schema and Kompas baseline all passed on `5d930bec63b0b328cc6a8454b0633269b4f37c93`; full CI run `45258979321` was still in progress at last check. The corrected test changed the stale count assertion to three current-mail keys and checks mute controls use account/sender keys. The final docs follow-up is `7cffd43da108ab203a4dff3c859af527a8e31b59`. No real inbox/mobile acceptance or production deployment.
