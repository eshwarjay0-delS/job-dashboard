# MFit Completion Watch — Run 35 (28 November 2026)

## Scope
Continue the approved Gmail local-snapshot account-switch privacy repair (issue #623 / PR #637), and reconcile its exact-head validation without reading mail or accessing user devices.

## Verified source
- Current production/master commit: [fdd4816](https://github.com/eshwarjay0-delS/job-dashboard/commit/fdd4816e53b9156787993c384ac72759967ff6c3), Vercel READY production deployment [dpl_9Kvhj6NKALcsucVniGoqgpy9NPKJ](https://vercel.com/qu4ntum-s-projects/job-dashboard/9Kvhj6NKALcsucVniGoqgpy9NPKJ); alias `job-dashboard-fawn.vercel.app` independently maps to it.
- PR #637: [account-switch guard](https://github.com/eshwarjay0-delS/job-dashboard/pull/637), DRAFT and mergeable, based on fdd4816.
- Source commit [96f87aa](https://github.com/eshwarjay0-delS/job-dashboard/commit/96f87aa22bb755b4e299a0c42c761208b0762024) captures refresh generation, rechecks it and the verified account key after asynchronous identity reads, and prevents delayed local snapshots from publishing after account switch/sign-out.
- Test commit/head [5740a53](https://github.com/eshwarjay0-delS/job-dashboard/commit/5740a5349a5c96f306c361cd3b73a7fa3668ec49) adds deferred A→B, sign-out, and same-account restore scenarios.
- Exact-head full CI [46137208957](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/46137208957) and Kompas baseline [46137208960](https://github.com/eshwarjay0-delS/job-dashboard/actions/runs/46137208960) are SUCCESS.

## Review and gate status
A non-approving COMMENT review was posted at review ID 6097486179. The narrow source diff has no blocker identified by this review. No Plan/REA or confirmed-skill exact-head run was observed; older 518e089 checks are not reused. Vercel branch-preview lookup returned zero deployments. The private protected-preview credential `KOMPAS_VERCEL_API_TOKEN` is not available. Keep the PR DRAFT; CI success is not merge or user acceptance.

## Limits
No canonical checkout/dependencies or local tests/build. No Gmail OAuth, mailbox read/write, email send, two-inbox/browser account-switch or phone acceptance. The source race is not reproduced in a real browser. The four-account limit and disabled Poke workers/scheduler/notifications/sending remain unchanged.

## Continue
Verify the missing exact-head Plan/REA and confirmed-skill gates and obtain legitimate protected-preview access. Then perform owner-consented two-inbox A→B/sign-out and same-account restore plus narrow-phone acceptance. Merge/deploy only after all required gates.