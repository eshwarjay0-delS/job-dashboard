# WhatsApp two-line JD + named Files resume parser — 22 November 2026

## Owner approval and boundaries

This is a narrow continuation of the owner-approved WhatsApp resume-selection reliability work. Preserve the latest rule: a fallback document may be sent unchanged only when the user explicitly selected that exact Files/Library item for the current request and it belongs to the same verified account; the exact caption is **Original resume — NOT TAILORED**. Do not guess the account, auto-select a closest match, substitute a fresh uploaded original, send a partial rewrite, or use unsupported JD-only terms. This parser change does not itself prove explicit selection or authorize a fallback.

The 17 October 2026 17:28 Chicago WhatsApp delivery remains unverified. The exact generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID and signed delivered/read receipt remain unavailable. Do not replay, resend or label a replacement document as the historical delivery.

## Root cause

`src/lib/role-match.ts` function `splitTailInstruction` previously refused to split fewer than three non-empty lines. A one-line job post followed by `use the SOC resume` therefore lost the named-resume hint. The short-instruction parser's 120-character ceiling made the fallback parser relevant for a combined 141-character message. The existing JD-signature matcher is reused; no broader inference or account guessing is added.

## Implemented on current-master restack

- A two-line input is split only when line one contains an existing JD signature and the final line matches the established resume-instruction grammar.
- The matcher is reconstructed without the global RegExp flag, preventing repeated calls from sharing mutable `lastIndex`.
- Negative cases keep short chat and a title-only first line intact.
- A parser test covers the positive case, repeated calls, short-chat negative and title-only negative.
- A synthetic WhatsApp library test verifies that the SOC hint survives the account-email confirmation prompt, no account is guessed, and reply `1` uses the exact SOC resume path.
- The WhatsApp recovery contract and dedicated workflow now execute the parser and library suites.
- The same branch adds missing `answerCtl: null` and `detectedQueue: []` to three Kompas VM test fixtures. This is a test-harness correction for the exact-master CI failure; it does not weaken assertions or change Kompas runtime behavior.

## Evidence and current validation

- Canonical master at branch creation: `23acd80ed645edb3d51a1fda876548eb8367ecbd`.
- Canonical production alias was READY at `dpl_GXYWcz9taCcYrFWNJ8xzM8qzFqSw`, exact SHA `23acd80`.
- Master full CI `45035728154`: lint and type-check passed; step 14 failed with 24 VM test failures, including `ReferenceError: answerCtl is not defined` from `pumpDetectedQueue`. Build and later steps were skipped.
- Parser implementation commit: `4357cd73a7d1adff8aae2a6f6d5b71814fadbcb8`.
- Parser, library and recovery tests: `811c5bec8f91fb9fde2bf83cacab213018e835d7`, `6267461432446f058ac05d7adbd1a6926f9f35cd`, `6256881e4bab3268a169421a56e79b5b7c17cf04`.
- WhatsApp workflow update: `eea890f1a3799738ef7e7bf47340e1b77f32b163`.
- Kompas fixture corrections: `83b5929c70f8c1126cd377762c322273a161e2c1`, `0322d5ff647a375cea366601c94fe92904d06760`, `7fd71dedeafbe126dd318dcf4303628f5eb8c486`.
- No local test/build ran because this runtime has no canonical checkout and outbound GitHub DNS resolution fails. Exact-head GitHub Actions are the next validation step.

## Separate blockers that remain

- PR #493's durable explicit-selection provenance and unsupported-JD hard hold are still separate, not delivered by this parser prerequisite.
- The required installed Next.js 16.3.8 route-handler guide is unavailable without an approved runnable repository environment. Do not edit route handlers until that installed guide is available.
- The Vercel sandbox snapshot limit was previously reported to reset at 2026-12-01T00:00:00Z. Do not change billing, delete snapshots or bypass access controls.
- No real WhatsApp send, replay, model call, DOCX generation, R2 write, inbox action, crawl or user-device test was performed.

## Next action

Open a draft PR from the current-master restack. Require exact-head full CI, WhatsApp resume recovery, Kompas baseline and Plan/REA checks; review the complete diff; merge only when every gate passes. Then verify a READY production deployment and active canonical alias on the merge SHA. Keep the historical 17 October delivery unverified.
