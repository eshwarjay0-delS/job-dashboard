# Kompas voice preview gate: port-validation regression (31 October 2026)

## Scope
Owner-approved continuous voice delivery for canonical MFit and Perfact packaging. No speech audio, raw transcripts, credentials, account data, consent or provider runtime behavior is changed in this test-only fix.

## Evidence
MFit PR #155 (full 40-character deployed commit SHA verification) had a failed full CI run 41215227649 on head 4d9c336b7d77b8a69c99df45114cf9c52a285c4b. The Kompas baseline gate passed, but the voice preview smoke suite failed 1 of 9 synthetic cases. The test grouped a nonstandard HTTPS port with wrong-tenant hosts and expected the credential-scope rejection; the implementation correctly rejects nonstandard ports first with `Preview URL must be a plain HTTPS Vercel origin`. The protected-preview HTTP workflow was skipped because it is restricted to an earlier branch. Neither skip nor a READY preview is live HTTP proof.

## Correction
Commit c68451517c2c20454d101ce8a9718b9627d3fefa separates the port case and explicitly asserts URL rejection before any fetch. Wrong-tenant and unsafe-header cases retain their credential-scope assertions. The verifier still fails closed.

## Release criteria
Wait for full CI and baseline on the corrected exact PR head. Require authenticated exact-head preview version + health HTTP proof, merge-conflict review against advancing master, and post-deploy production health/commit verification before promotion. Preserve rollback. Record no WER, deletion rate, technical-term recall, zero-edit, speaker attribution or P50/P95 latency improvement without paired consented recordings and comparable baselines.
