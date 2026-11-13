# WhatsApp session-pair conditional update — 12 November 2026

## Request and scope

The owner-approved offline JD fallback and no-baseline refinement policy is carried by current-master PR #321. A code review identified a remaining race in its session-pair cleanup: the webhook read the sender's session, compared the JD/resume pair, then unconditionally wrote the modified JSON. A second webhook could persist a newer pair between that read and write, and the old consumer could erase it.

This follow-up is limited to the sender session persistence boundary. It does not change the owner-approved fallback scope, resume evidence thresholds, account ownership checks, external-send policy, Gmail behavior, crawler behavior or Kompas voice.

## Implementation

- Extend the storage contract with getWithEtag() and putIfMatch().
- Cloudflare R2 reads the object bytes and ETag together, then uses the S3-compatible PutObject If-Match conditional write. R2 evaluates that condition atomically against the committed object state.
- The local filesystem adapter serializes per-key operations within one adapter process and uses a SHA-256 content token for compare-and-swap. Production R2 uses storage-level conditional writes across serverless instances. The implementation follows Cloudflare's documented R2 conditional-write contract: https://developers.cloudflare.com/r2/api/s3/conditional-operations/. Production R2 uses storage-level conditional writes across serverless instances.
- consumeSessionPair() re-reads and reapplies the pair-match rule after a failed conditional write. It retries at most eight times. It never falls back to an unconditional write; repeated conflicts leave the session pair intact for recovery. The no-provider original consumes only after Meta returns a document message ID; the normal rewrite path retains its existing claim-time consumption, but both use the same conditional update.
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
