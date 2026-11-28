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

## Run 35 — Kompas PR #640 release/provenance correction


- PR #640 closed/merged at 2026-11-28T10:40:58Z; master commit `fdd4816e53b9156787993c384ac72759967ff6c3` is independently READY at Vercel production deployment `dpl_9Kvhj6NKALcsucVniGoqgpy9NPKJ`, with `job-dashboard-fawn.vercel.app` alias exact. This supersedes run34's pre-merge status.
- Approval correction: scoped prior-context retrieval did not find direct owner-authored approval for the exact S8 behavior batch, and PR #640 has no comments. Mark it **unapproved/deployed**, not approved or accepted; do not automatically roll back or extend it without an owner decision.
- Earlier full CI `46134823553` failed 106/107 on head `21972ceb` because the generic provider-error string was kept. The final merge SHA's CI was not surfaced by the available workflow-run query. No real Taskmaster S8 retest occurred.
- Next: obtain explicit owner decision, verify final SHA CI and real live behavior before acceptance.


## Run 35 — confirmed-skill attribution guard in current master

- Current master `fdd4816` (the READY production alias) contains `confirmedCandidateStatements` and the non-candidate attribution split patterns. Current `src/lib/resume-evidence.ts` blob `57a6dada57e122c28094ab5a8ffba8731773e249` and regression file blob `decddd07400ed2f001a57f7536a313899a058838` were read from master.
- The current test includes nine passive actor negatives (contractors, subcontractors, consultants, vendors, clients, external teams, outside consultants, third-party vendors, colleagues) while retaining the ordinary AWS+GCP positive. The corresponding source patterns are present. No local execution occurred.
- PR #598 is closed unmerged; this is current master/source evidence, not a claim that #598 merged. The owner-approved 6 Nov cross-role rule remains narrow: a first-person-confirmed skill can be mapped to a relevant existing project bullet across roles, without inventing any other project fact.
- The guard is deployed, but no actual baseline/JD/explicit confirmation, DOCX inspection, protected preview or live 98% ATS result was produced. Final-DOCX Gemini score/correction/re-export remains separately approved and pending.


## Run 35 — WhatsApp read-only connection check

- iZap lists one business with **no linked WhatsApp number**. Read-only connection status checked at `2026-11-28T11:38:11.321718Z`: disconnected/status_none; inbound webhook never; history backfill never; outbound delivery never proven. This is current status only, not evidence about 17 Oct.
- PR #411 latest head `069707f9e7a48a698f80835bf6cf2a820ebe49b6` is documentation-only on stale base `17f8dada`, DRAFT/nonmergeable; no exact-head workflow/status. Prior four-gate green set was on predecessor `5b522ec` and is not reused.
- No message was sent or replayed. Historical source/output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound ID, signed delivery/read receipt and owner fact reconciliation remain missing. Uploaded-original timeout fallback is unapproved; explicit same-account Files/Library original fallback remains permitted and must be labelled **Original resume — NOT TAILORED**.


## Run 35 approval and incident-event correction

- Supabase read-only event confirms the 17 Oct 17:28:27 CDT model-use event (score 87, 34 calls, 205,546 input tokens, 25,331 output tokens, $0.020949 estimated cost, source_event_key NULL). Zero `resume_documents` and `resume_import_jobs` rows were created in 22:20–22:40 UTC. This is not evidence of DOCX export/delivery and does not prove R2/Meta artifacts absent.
- Correct approval boundary from PR #411 comments 6891669872/6891926333: the owner approved the **narrow offline closest-Library-resume failsafe** on 27 Oct, only with exact verified same-account original bytes, authenticated account/profile and source path, fail-closed behavior, and `Original resume — NOT TAILORED`. That does **not** approve uploaded-original timeout fallback, cross-account/partial fallback, swipe-refinement baseline delivery, real outbound testing or replay.
