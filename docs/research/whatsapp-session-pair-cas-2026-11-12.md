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
- whatsapp-single-request.test.mjs is added to the production prebuild regression group so the barrier case runs with full CI.

## Safety and acceptance boundary

No real WhatsApp message, Meta callback, model call, R2 production write, historical replay, DOCX generation, email or handset test was performed. The 17 October 2026 17:28 Chicago incident remains historically unverified: the full matching JD is available from Gmail, but the exact source DOCX bytes, generated output DOCX, per-run R2 object/version, webhook correlation, Meta message ID and signed delivery/read receipt are not currently accessible.

The source branch remains DRAFT pending exact-head full CI, WhatsApp recovery regression, Kompas baseline and the protected Vercel preview. The protected preview requires the private KOMPAS_VERCEL_API_TOKEN to be configured by the owner or an authorized repository administrator; this work does not bypass that gate. Production deployment and real WhatsApp acceptance are separate later steps.
