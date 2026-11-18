# Gmail multi-account no-hard-cap proposal — 17 November 2026

## Approval boundary

The high-level Poke-inspired multi-account Gmail/mobile direction is owner-requested. Historical owner vision records 3–4 connected inboxes and four mobile toggles, but accessible prior-conversation retrieval did not recover a direct user-authored instruction removing the four-account ceiling. The no-cap change in PR #440 is therefore proposed, not approved. Do not merge it, apply its migration, or deploy it until direct owner confirmation is recorded. Preserve account ownership, receiving-inbox/thread identity, selected From and per-account reconnect. The separate background-worker batch size of four **users per invocation** is unchanged.

## Source audit on canonical master

Master at the start of this slice: `66291f677cbcc2318229ef9a3164961e6d3cdb6a`.

A prior assistant-authored Plan & Vision summary described 3–4 as a target rather than a cap; that wording is not direct owner evidence and does not establish approval. The source audit found four-account checks in several layers:

- `supabase/migrations/20261004_multi_google_workspace_accounts.sql`: `identity_attach_google_workspace_account` rejected a fifth account and `identity_list_google_workspace_accounts` returned only four.
- `src/app/api/identity/google-workspace/accounts/route.ts`, `src/app/api/connections/status/route.ts`, and `src/app/api/gmail-sync/route.ts`: returned `maxAccounts: 4`; two also set `canAdd` false at four.
- `src/app/dashboard/copilot/ChatIntegrationsCard.tsx` and `src/app/dashboard/connections/ConnectionsClient.tsx`: disabled the Add action, displayed “of 4,” and showed slots remaining.
- `src/lib/mail-update-policy.ts`: rejected mobile update preferences selecting more than four inboxes.
- `src/app/api/identity/google-workspace/callback/route.ts` and the connections UI still exposed a four-account limit error.
- `PRODUCT_DIRECTION.md` and `ChatGPT.md` described the historical target as “up to four.”

## Implemented in draft PR

PR: https://github.com/eshwarjay0-delS/job-dashboard/pull/440  
Branch: `fix/gmail-account-cap-owner-correction-20261117`  
Current recorded head: `239b2b8c0d85a331d9bf055b90e46a3ca63f4ad3`

Changes:
- New forward-only migration `supabase/migrations/20261117125100_google_workspace_no_account_cap.sql` replaces only the attach/list RPCs. It removes the count guard and list limit while retaining the same user/Google-subject ownership check, security-definer search path, audit write, profile/connected-service updates, revoked/active semantics, and service-role-only grants.
- API and UI no longer advertise or enforce four connected accounts. The Add action is available whenever the live account source is writable.
- Mobile update preferences accept all selected connected inboxes; duplicate and malformed email validation remains, and the route still verifies every selected inbox belongs to the authenticated user.
- Historical product-direction docs now say 3–4 is a target range, not a cap.
- Added source-contract tests for 12 inboxes, SQL security boundaries, API/UI no-cap behavior, and product-direction text; extended the mocked mobile-update suite and wired both tests into CI and prebuild.

## Verification state

- PR #440 is DRAFT, not merged.
- Exact-head GitHub Actions full CI, Kompas baseline and Plan/REA schema are pending; predecessor or master results are not accepted as evidence for this head.
- No local checkout or `node_modules` is present in this scheduled runtime. The matching Next.js 16.3.8 Route Handler and Server/Client Component guides were reviewed from the exact upstream tag; local npm tests/build were not run. GitHub Actions is the execution path.
- No production migration was applied. No Vercel deployment or alias change was attempted.
- No Gmail API/OAuth call, inbox read, email, WhatsApp message, mobile notification, or device test occurred.
- The canonical Vercel project currently reports `live: false`; the protected-preview credential is owner-controlled and unavailable here. Do not unpause the project or bypass its preview gate.
- Real acceptance with at least five authorized inboxes, distinct sender/thread identity, selected-From, reconnect, mobile account selection and account isolation remains open. The Poke-style background worker remains disabled.

## Next action

Continue: verify full CI, Kompas baseline and Plan/REA schema on exact PR #440 head. If all pass, let MFit Safe Merge Gate review it. Do not merge or deploy until a legitimate protected preview and consented five-plus-account acceptance are available. Keep the separate four-user worker batch size and all per-account safeguards intact.


## 17 November 2026 — CI contract-test correction

The first exact-head full CI run for PR #440 (44090609728) failed only in scripts/tests/kompas-deploy-build.test.mjs. Its assertion compared the complete prebuild command with an old literal; the approved addition of google-workspace-no-hard-cap.test.mjs and mail-updates.test.mjs made that assertion stale. The job log recorded 62 passing tests and one failing assertion. Commit 80615a2b6d13e9ddc7714e22bf8f56918d0e2a80 changes the contract to assert the Kompas baseline remains first, every required prebuild regression suite is present, and the build command remains unchanged. This is a test-only correction; it does not change Gmail or Kompas runtime behavior. Exact-head CI, Kompas baseline and Plan/REA must rerun after the documentation updates. No local test/build was run because the scheduled environment has no checkout and could not resolve github.com. The PR remains DRAFT; no migration, OAuth call, inbox read, email, mobile notification, preview bypass or production deployment occurred.

Next: wait for exact-head workflows, then let MFit Safe Merge Gate review. Keep protected preview and owner-consented five-plus-inbox acceptance as release gates.


## 17 November 2026 — second exact-head CI failure and wording correction

The exact PR #440 head `d375f384439b1edf19f233f27a940878158501b5` completed full CI run [44096783012](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/44096783012) with one focused regression failure. The failure was at `scripts/tests/google-workspace-no-hard-cap.test.mjs:57`: the test requires the phrase `not a hard maximum`, while the new Gmail vision paragraph said `not a product maximum`. The focused command reported 14/15 tests passing. This is a documentation/test-contract mismatch; no SQL, API, UI, account-identity or runtime Gmail behavior failed in the reported assertion. The wording is corrected in `docs/gmail.md` on the same PR branch. The next full CI, Kompas baseline and Plan/REA runs must validate the new exact head; no previous-head result is reusable.

The branch remains DRAFT. The canonical production alias remains READY on older SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`, not the current master `66291f677cbcc2318229ef9a3164961e6d3cdb6a` or PR #440. The protected-preview credential is owner-controlled and unavailable here. No migration was applied, no deployment was attempted, and no Gmail OAuth/API call, inbox read, email, mobile notification or real five-plus-account acceptance occurred.

Next: verify all required workflows on the final PR head, then let the active MFit Safe Merge Gate review. Keep protected preview and owner-consented five-plus-inbox identity/reconnect/mobile acceptance as separate gates.
