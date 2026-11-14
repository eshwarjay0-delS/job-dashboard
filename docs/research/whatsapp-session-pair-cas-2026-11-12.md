# WhatsApp session-pair conditional update — 12 November 2026

## Request and scope

The owner-approved offline JD fallback and no-baseline refinement policy is carried by current-master PR #321. A code review identified a remaining race in its session-pair cleanup: the webhook read the sender's session, compared the JD/resume pair, then unconditionally wrote the modified JSON. A second webhook could persist a newer pair between that read and write, and the old consumer could erase it.

This follow-up is limited to the sender session persistence boundary. It does not change the owner-approved fallback scope, resume evidence thresholds, account ownership checks, external-send policy, Gmail behavior, crawler behavior or Kompas voice.

## Implementation

- Extend the storage contract with getWithEtag() and putIfMatch().
- Cloudflare R2 reads the object bytes and ETag together, then uses the S3-compatible PutObject If-Match conditional write. R2 evaluates that condition atomically against the committed object state.
- The local filesystem adapter serializes per-key operations within one adapter process and uses a SHA-256 content token for compare-and-swap. Production R2 uses storage-level conditional writes across serverless instances. The implementation follows Cloudflare's documented R2 conditional-write contract: https://developers.cloudflare.com/r2/api/s3/conditional-operations/. Production R2 uses storage-level conditional writes across serverless instances.
- consumeSessionPair() re-reads and reapplies the pair-match rule after a failed conditional write. It retries at most eight times. It never falls back to an unconditional write; repeated conflicts leave the session pair intact for recovery. Both the no-provider original and the normal rewrite consume only after markResumeDocumentAccepted confirms provider acceptance for that exact document. An explicit HTTP rejection retains the pair for retry; a signed failed-delivery callback also retains it while recovery is scheduled. An ambiguous send is never automatically duplicated.
- The same pair rule remains: clear JD and resume only when both still match this run; preserve a newer JD, a newer resume, or both; retain the last-used resume record.

## Regression evidence

- A barrier-controlled webhook regression pauses after the session ETag read, commits a newer JD/resume pair, then resumes the stale consumer. The conditional write rejects the stale ETag, the consumer reloads and preserves the newer pair, and last-used bookkeeping is retained.
- Filesystem tests verify stale-write rejection and exactly one winner for two concurrent writes using the same ETag.
- R2 adapter tests verify ETag retrieval, the outgoing If-Match value, precondition conflict handling and a successful subsequent conditional write.
- whatsapp-single-request.test.mjs is added as a dedicated full-CI step; the canonical prebuild command remains unchanged.

## Safety and acceptance boundary

No real WhatsApp message, Meta callback, model call, R2 production write, historical replay, DOCX generation, email or handset test was performed. The 17 October 2026 17:28 Chicago incident remains historically unverified: the full matching JD is available from Gmail, but the exact source DOCX bytes, generated output DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt are not currently accessible.

The source branch remains DRAFT pending exact-head full CI, WhatsApp recovery regression, Kompas baseline and the protected Vercel preview. The protected preview requires the private KOMPAS_VERCEL_API_TOKEN to be configured by the owner or an authorized repository administrator; this work does not bypass that gate. Production deployment and real WhatsApp acceptance are separate later steps.


## 13 November 2026 — current-master restack; exact-head gates pending

The reviewed WhatsApp runtime, storage and regression changes are being restacked from PR #358's old base onto current master `6e18cdd8a1d05289ef4c38bcd6f5bfd005adc9f7` in branch `fix/whatsapp-offline-cas-current-master-6e18cdd-watch12-20261113`. This avoids copying stale Plan/REA/Completion Watch history over the current Gmail security and owner-approved product records. The old-base PR #358 exact head `91848189d224d1d4e31d9e224e79879cc4aeb7a3` passed full CI `43421184710`, WhatsApp recovery `43421184715`, Kompas baseline `43421184842` and Plan/REA schema `43421184835`; those checks do not substitute for fresh exact-head checks on the new branch.

No Vercel preview deployment is listed for the new branch. The protected preview requires the repository owner's private `KOMPAS_VERCEL_API_TOKEN`; this run did not read, change or bypass it. Keep the PR DRAFT until a legitimate protected preview is available. Production remains on the previous READY alias; no release is claimed.

Cloudflare's current R2 documentation confirms that `PutObject` accepts atomic `If-Match` conditional writes. The exact 17 Oct generated DOCX, per-run R2/webhook/Meta correlation and signed delivery/read receipt remain missing. The 12 Nov Library recheck did not resolve the source DOCX path in this execution context, despite an earlier audit reporting private-archive recovery. No historical replay, model call, production R2 write or real WhatsApp send occurred.


## 13 November 2026 — first exact-head regression result

On PR #360 initial head `3a3dcb41f35b95690c38d0a74f63723a006c4e79`, WhatsApp recovery `43425563387` and Kompas baseline `43425563574` passed. Plan/REA run `43425563489` had one assertion-only failure: the new test expected `No real Meta send`, while the REA limit said `real WhatsApp send`; the other 13 checks passed. The record wording is corrected in the next commit. Full CI `43425563351` was still running at this point. No runtime source behavior was changed by this correction.


## 13 November 2026 — second Plan/REA wording correction

The first documentation correction did not satisfy the exact assertion: the new REA limits said `No production R2 write, model call, real Meta send`, while the test expected the contiguous phrase `No real Meta send`. PR #361 Plan/REA run `43425775972` therefore repeated one assertion failure; the other 13 checks passed. The limit wording is being made explicit, then the schema gate will rerun on the next exact head. The WhatsApp recovery and Kompas baseline gates passed on `5bf054926e7cb7eaadb91f585b1f73d99a995123`.


The current-master restack branch is tracked by PR #362. The previous exact-head REA assertion mismatch was corrected in commit d931eb5b7a42c40ba1b4dbae3fe3b5865da5f15a; fresh checks must be attached to the latest PR head, not reused from PR #358 or the earlier restack heads.


## 13 November 2026 — case-insensitive REA assertion

The second Plan/REA run `43425775972` failed because the REA limit used lowercase `no real Meta send`, while the test asserted uppercase `No real Meta send`. The recorded limit is accurate; the test is changed to case-insensitive matching. This does not relax the no-send requirement. All checks must rerun on the next exact head.


## 13 November 2026 — consume only after provider acceptance

A focused review of the restacked webhook found that the normal rewrite path called consumeSessionPair() before tailoring and upload, even though the no-provider path consumed only after delivery. That would erase a matching pair when the tailored upload and fallback were both rejected. The call is moved after markResumeDocumentAccepted returns true. The sendClosest path also now preserves the pair when a signed failed-delivery callback returns false, even if Meta first returned a message ID.

Two mocked regressions were added: (1) provider-backed tailored upload and same-account fallback both receive explicit HTTP rejection, and the JD/resume pair remains; (2) the fallback receives a message ID but the signed delivery callback rejects it, and the pair remains for scheduled recovery. These tests are part of the new exact-head CI run; no real Meta request was made.


## 13 November 2026 — test-fixture correction after exact-head CI

Full CI `43448510964` on head `325e4def14e3f91951eb8a36a9b3325c67ee2ade` ran 52 tests in `scripts/tests/whatsapp-single-request.test.mjs`: 51 passed and one failed. The failure occurred before the intended provider-callback scenario because the route called `saveTailored()` but the test mock exposed only `markUsed`, producing `TypeError: saveTailored is not a function`. The mock now provides `saveTailored: async () => null` so the test reaches the intended upload/fallback and signed-callback path. This is a test-fixture correction; no production source behavior changed. Commit: `6925ebdd3375c46e639c50c00fdebe5d48781ce2`.

Fresh full CI, WhatsApp recovery, Kompas baseline and Plan/REA schema results on the new exact head are required. The branch remains DRAFT and is still based on `9032d5bd`; current master has advanced to `024177889d092f30aaeada20fab649aa41c9d1f4`. Preserve the later Kompas commits when restacking. The protected preview credential remains unavailable; do not bypass it. No model call, R2 production write, Meta send, historical replay or handset acceptance occurred.


## 13 November 2026 — current-master restack and R2 status coverage

The approved runtime and test changes are restacked onto canonical master `026c72968e45314ff0a99f701942c966e79f0a1e` in branch `fix/whatsapp-offline-cas-master-026c729-run11-20261113`. The old PR #368 branch remains a source reference only; its stale Plan/REA and completion-watch history is not copied over newer master records.

The focused storage regression now distinguishes HTTP 412 (ETag precondition mismatch), HTTP 409 (conditional-write conflict), and HTTP 404 (object disappeared between read and conditional write). Unexpected 5xx errors must propagate rather than being treated as retryable conflicts. The 409/404 cases return a failed conditional write so the caller performs its bounded reread; there is still no unconditional-write fallback. The existing barrier test continues to verify that a newer JD/resume pair survives a stale consumer.

Exact-head GitHub CI, WhatsApp recovery, Kompas baseline, Plan/REA and the protected preview are pending on the new PR. No local execution, production R2 write, real WhatsApp send, model call, or handset acceptance is claimed.


## 13 November 2026 — test fixture boundary correction

The current PR branch includes test-only correction commit `83c81db42877b70227191ba90640521761575d4f`, which closes the original filesystem/CAS test before declaring the independent 409/404/500 adapter test. Evaluate workflows on the latest PR head only; earlier checks on `b7fed671999ad850f1a926351974b1eb4c10231c` do not validate the corrected head.


## 13 November 2026 — REA schema alignment

The REA now records this run's current-master restack under `whatsapp-offline-cas-restack-run11-2026-11-13`, including the explicit consume-after-provider-acceptance step. A separate blocked REA entry records that this execution's Library search did not re-resolve the exact 27,724-byte input DOCX, while preserving the earlier private-review recovery evidence. The schema tests assert these current IDs and the no-real-Meta-send boundary.


## 13 November 2026 — REA fixture corrections

The first current-master REA run found two fixture issues, not runtime failures: a non-repository Files search label was used where the schema requires a repository source path, and an extra array comma created a skipped step. The REA source now points to the public historical acceptance handoff, and the provider-acceptance step is a real ordered item. The next exact-head Plan/REA run must confirm the correction.


## 13 November 2026 — signed callback fixture correction

The first exact-head full CI run failed one assertion because the fixture combined `failNextDocument=true` (an ambiguous first upload failure) with `acceptedByProvider=false` (a signed failed-delivery result). The production path correctly avoids a duplicate when the first upload is ambiguous, so the fixture could not produce the message ID its assertion expected. Commit `cdf62de950b80ff9762ac82ff1656af98c11885f` removes that ambiguous failure from this specific scenario: the upload succeeds, the mock acceptance helper returns false because the signed failure callback already won, and the JD/resume pair must remain. This correction changes only the test fixture; exact-head CI is pending.


The callback-retention fixture correction is now recorded in the Plan Journal and REA. Exact-head CI must run on the branch head containing this documentation commit; prior failures on 40709a9 are superseded only for the test fixture, not treated as passing.


## 13 November 2026 — run 11 exact-head gates passed

PR #374 `fix/whatsapp-offline-cas-master-026c729-run11-20261113` is based on current master `026c72968e45314ff0a99f701942c966e79f0a1e`. Its final pre-documentation head `7575b5d7cd18287ba93b064a7e0f201edcf064c9` passed full CI `43491356874`, WhatsApp recovery `43491357092`, Kompas baseline `43491356934` and Plan/REA schema `43491357225`. The full CI includes `scripts/tests/whatsapp-single-request.test.mjs`, which exercises provider-acceptance pair retention, interleaving CAS, HTTP 409/404 retry conflicts and unexpected 500 propagation. This is source-level regression evidence only.

The PR remains DRAFT because the legitimate protected Vercel preview requires the private `KOMPAS_VERCEL_API_TOKEN`, which this execution cannot access. Production alias `job-dashboard-fawn.vercel.app` remains READY at `dpl_Gpo7bWY56cZDoTyjUJ6f1D5ducAb` / SHA `024177889d092f30aaeada20fab649aa41c9d1f4`; the restack is not deployed. No production R2 write, real Meta send, model call, historical replay or handset test occurred. The prior private archive review records the exact source DOCX and matching JD recovery, but the generated output DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt remain missing. Conflicting source facts remain quarantined.


## 14 November 2026 — provider-failure fallback uses verified bytes

PR #380's review found that the provider-exception catch still called `sendClosest(session.resumePath)`. That could send a session/inbox copy without proving it was the exact selected same-account library file. The catch now routes only a Files-selected initial JD run through `sendOfflineOriginal`, which verifies account root, normalized relative path, resolved path and byte equality. If any check fails, no document is sent. The explicit caption remains **Original resume — NOT TAILORED**. Swipe-reply refinement stays text-only on failure or incomplete output.

The ETag/If-Match pair-consumption logic is unchanged: consume only after provider acceptance of the exact document, retry bounded 409/412/404 conflicts by rereading, propagate unexpected storage errors, and never use an unconditional overwrite. New exact-head CI and WhatsApp recovery checks must rerun after this documentation update. Protected preview and real provider/device acceptance remain separate and unverified.


## 14 November 2026 — actual R2 adapter status mapping test

The earlier in-memory pair-CAS regression covers 409/404 retry behavior, stale ETag conflicts and concurrent winners at the higher-level pair-consumption helper. It does not instantiate the production `R2Storage` class. PR #380 adds a dedicated mocked-S3 test for `R2Storage.putIfMatch`: HTTP 412/409/404 return `false` after one conditional request, HTTP 503 propagates, and an accepted `If-Match` write returns `true`. The test is wired into full CI and uses fake credentials; no network/R2 request is made. Commit: `98fafff9f095146a71f50500c9c520007be75fef`. Exact-head CI and the protected preview remain pending.


## 14 November 2026 — R2 conditional-write compatibility and current-master gates

Cloudflare's current R2 S3 documentation explicitly lists `If-Match` and `If-None-Match` for `PutObject`, requires quoted ETags for strong `If-Match` comparison, and states that conditional writes are evaluated atomically against the committed bucket state. The adapter passes the ETag returned by `GetObject` unchanged to `PutObjectCommand.IfMatch`. References: https://developers.cloudflare.com/r2/api/s3/conditional-operations/ and https://developers.cloudflare.com/r2/reference/consistency/.

The current-master PR #380 exact head is `cf86a8d51c5fc7aea432ffc139efe4cf9c5a4b64`. Full CI `43573764438` passed all 47 steps; the WhatsApp recovery gate `43573764496` passed 51/51; Kompas baseline `43573764426` and Plan/REA schema `43573764464` passed. The full-CI combined library/single-request/fivefold/failsafe group passed 54/54, the mocked R2 adapter suite passed 3/3 (412/409/404 fail closed, 503 propagates, accepted If-Match succeeds), and the pair-consumption interleaving regression passed. Two earlier failures were test-fixture issues: a mismatched user/path fixture and an alternating read counter shared across independent cases. Commits `5f1da9f47a9bd290ed7fa5c10bc5306c72e7aafa` and `cf86a8d51c5fc7aea432ffc139efe4cf9c5a4b64` correct only those fixtures; no runtime guard was weakened.

This confirms documented API compatibility and mocked adapter behavior, not a live bucket write. No production R2 operation, Meta send, historical replay, model call or owner-device acceptance occurred. PR #380 remains DRAFT until the protected preview is legitimately configured and the Safe Merge Gate completes shared-document sequencing.
