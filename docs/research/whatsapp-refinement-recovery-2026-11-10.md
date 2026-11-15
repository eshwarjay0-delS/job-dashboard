# WhatsApp swipe-reply refinement recovery — 10 November 2026

## Scope and source

- Owner-tracked implementation gap: [issue #201](https://github.com/eshwarjay0-delS/job-dashboard/issues/201).
- Canonical repository: `eshwarjay0-delS/job-dashboard`.
- Work branch: `fix/whatsapp-refinement-durable-recovery-20261110`.
- This is separate from the initial-JD recovery queue and separate from the identity-normalization approval gate in PR #274.
- It does not prove that the 17 October 2026 17:28 Chicago message reached `refine()`. The original generated artifact and complete execution trace remain unavailable; no historical document was reconstructed or resent.

## Decisions implemented in the branch

1. A swipe-reply edit is persisted before model work. Its immutable record includes the original replied-to WhatsApp message ID, exact edit request, selected MarketFit user ID, JD, original generated-version path and SHA-256, a private source snapshot path and SHA-256, and a sender/message-derived idempotency key.
2. Refinement jobs use a distinct `kind: "refine"` discriminator in the existing private R2 recovery store. The initial-JD worker cannot accidentally consume them.
3. A per-attempt immutable claim with a 330-second lease prevents concurrent webhook and cron workers from running the same refinement. The existing authenticated recovery endpoint processes at most one refinement within the remaining 240-second tailor budget.
4. A generated DOCX is stored with its SHA-256 and a private result snapshot before any document send. Retries re-check and reuse that exact candidate rather than silently switching to the original or generating a different file after a delivery failure.
5. Existing WhatsApp rewrite usability, supported-experience, DOCX identity/contact/date, and source-path checks run before sending. A rejected candidate is retained with a category-only reason and retry state. No original or partial file is used as a fallback for a swipe-reply edit.
6. The send is marked `sending` before Meta is called and carries the opaque job ID. HTTP/API acceptance and signed `sent` remain uncertain; only signed `delivered` or `read` marks completion. A signed failure can retry the same stored candidate. An accepted, sent, or uncertain send is never automatically resent.
7. User-facing recovery messages name the safe outcome without exposing resume values. Diagnostic logs remain category/count only.

## Changed files

- `src/lib/whatsapp-resume-recovery.ts`: immutable refinement records, idempotency checks, due selection, lease claims, retry and status transitions.
- `src/app/api/whatsapp/webhook/route.ts`: snapshot before tailoring, recovery worker integration, strict stored-version requirement before Meta send, and signed-delivery reconciliation.
- `scripts/tests/whatsapp-recovery-durability.test.mjs`: duplicate enqueue, queue isolation, single-winner lease, stale-lease recovery, rejected candidate retention, immutable source, accepted/sent uncertainty, opaque callback correlation, and signed failure retry.
- `scripts/tests/whatsapp-resume-contract.test.mjs`: route-order, source-hash, identity/quality gate, worker-budget, and no-baseline-fallback contracts.

## Validation and release status

- These tests are synthetic state/contract tests only. They do not send a real WhatsApp message and do not prove Meta handset delivery.
- Exact-head GitHub full CI, Kompas baseline and WhatsApp recovery regression are pending PR validation.
- The branch is not merged or deployed. Production remains the previously verified deployment until a READY production deployment and canonical alias show the merged SHA.
- Acceptance still requires a real authorized refinement job, a signed Meta `delivered` or `read` callback correlated to that exact job/document, and verification that no duplicate or baseline document was sent. No such real test was performed.
- The original 17:28 Chicago incident remains historically unverified because the complete generated artifact and execution trace are not available.

## Separate open gates

- PR #274 keeps its own owner-review gate for stricter identity rejection; this branch does not bypass or merge that PR.
- The Plan & Vision journal and REA entry are deferred because the active documentation PR #275 edits those same files. Add the journal/REA update after that PR's preview-smoke gate is resolved, without conflicting edits.
- The production deployment is subject to the current Vercel build-rate quota. Do not bypass it or repeatedly submit blocked deployments.
