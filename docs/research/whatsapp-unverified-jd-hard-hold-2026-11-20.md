# WhatsApp unsupported-JD hard hold — isolated approved slice, 20 November 2026

## Scope and approval

This is a narrow source/test continuation of the owner's approved WhatsApp resume reliability work. The latest accessible owner correction on 19 November 2026 at 23:22:42Z requires a fallback to be restricted to an explicitly selected same-account Files/Library resume, labelled exactly **Original resume — NOT TAILORED**. Unsupported JD-only qualifications or experience must never be represented as candidate experience. A fresh upload without explicit library selection must not be silently substituted or sent unchanged.

The historical 27 October closest-matched-library failsafe remains preserved as history; the later 19 November correction narrows its implementation. The review branch now wires that explicit-selection provenance into the webhook and durable recovery input, rather than allowing automatic or uploaded resumes to be substituted.

## Source finding on master

Canonical repository: `eshwarjay0-delS/job-dashboard`.

Base master at branch creation: `13542c5e1127ed7c1ccf59e4faa034d0af021fc1`.

Before this change, `src/lib/whatsapp-resume-acceptance.ts`:
- included `unverified_jd_terms` in `WHATSAPP_SHORTFALL_REASONS`;
- allowed `whatsappRewriteUsable` to treat that reason as a deliverable shortfall;
- treated unverified additions as a value that `deliveredWithShortfall` could disclose while still sending; and
- returned `true` from `chosenResumeMatchesProfile` when the selected profile email was missing or blank.

The helper is separate from the route's durable explicit-selection proof. A matching email is necessary for the identity check but does not prove the user explicitly selected a Files/Library record.

## Implemented on the review branch

Branch: `fix/whatsapp-unverified-jd-hard-hold-20261120`.

- Removed `unverified_jd_terms` from the deliverable shortfall allowlist.
- Made `whatsappRewriteUsable` fail closed for either a nonempty `unverified_added_keywords` list or a cached `quality_blockers` entry containing `unverified_jd_terms`, including when the detail list is empty.
- Removed unverified JD-only additions from `deliveredWithShortfall`; only raw/supported coverage shortfalls are disclosable delivery gaps.
- Made `chosenResumeMatchesProfile` reject a missing/blank profile email and require exactly one matching email in the candidate document.
- Added three synthetic regression tests for nonempty unsupported terms, a cached blocker with an empty detail list, and missing/blank/matching/mismatched profile email.

Code commit: `6ce44b4713553af64fc0efdf657c823f9cd8837c`.

Test commits: `597979a80aec648e16a14dc4782c15b31ee4af9c`, `b941baa31536669679194c30219488aafde815fc`, and final isolated assertion fix `ac37a6147f6c066487a2356f024d127252337d9c`. CI wiring commits: `b1d869fa7b07feda776e80ccc2f6da38342b895a` and `3c038a4b055c568f91bcd09d5ce98192062914e0`.

The change is deliberately split from PR #450. It does not include R2 ETag-CAS/conditional writes, worker leases/fencing, recovery queue changes, provider callback changes, or uploaded-original-after-timeout behavior. Those remain unapproved and are not copied into this branch.

## Validation and deployment state

- No local test/build was run: this scheduled environment has no canonical repository checkout or installed `node_modules` tree.
- The acceptance test is now included in both `.github/workflows/ci.yml` and `.github/workflows/whatsapp-resume-regression.yml`. Exact-head GitHub Actions full CI, WhatsApp recovery, Kompas baseline, and Plan/REA checks must run after the final documentation commit. No earlier or predecessor-head test result is reused.
- The PR remains DRAFT and unshipped until those exact-head gates and MFit Safe Merge Gate review complete.
- No production deployment, model call, DOCX generation, R2 write, WhatsApp/Meta send, production database mutation, or native-device test occurred.

## Separate current-production failures

The read-only 24-hour Vercel aggregation for `/api/whatsapp/webhook` on production deployment `dpl_EZce7dEERrv1eVUFf64YoAzwoicb`, SHA `3a1b0bb718874f8fca5adc5f78362d3009a11281`, showed:
- a quality-gate rejection at `2026-11-20T20:25:58Z` with `roles_unrewritten` / `quality_not_deliverable` despite 100% aggregate and supported coverage, with five roles and zero JD terms placed; and
- a separate `2026-11-20T21:03:10Z` no-writer event, `Tailored with no AI writer (skills section only)`, at 43.1% JD coverage.

The current `roleQualityBlockers` implementation correctly blocks unrewritten roles and incomplete experience; its regression tests protect that behavior. Do not weaken those guards to make these events deliverable. The helper-only PR above does not fix the writer/provider availability or substantive role rewrite failures.

## Historical 17 October incident remains open

The 17 October 2026 17:28 Chicago screenshot establishes a hold at that time, not delivery. Three Library-scoped searches for the exact generated output DOCX, final exported Word file, and Meta outbound/delivered/read receipt were paginated to exhaustion without finding a matching artifact. The returned 2 November DOCX is unrelated and was not substituted.

Still missing: exact output DOCX, per-run R2 object/version, request/webhook correlation, Meta outbound message ID, and signed delivered/read receipt. No historical replay or resend was attempted. This negative Library search is scoped to the accessible Library and does not prove that another authorized archive cannot contain the artifact.

## Current source follow-through — 21 November 2026

The existing restack `fix/whatsapp-explicit-library-fallback-20261121` now contains the webhook guard and durable `files.explicitlySelected` provenance. The route sets the marker only when a resume hint was actually matched as “because you asked for it”; automatic picks and uploaded resumes do not qualify. The guard requires a verified account-owned resume directory, relative path containment, the selected path matching the run's resume path, exact bytes between the selected Library file and the run source, and a unique profile email. The unchanged file caption is exactly **Original resume — NOT TAILORED**. A follow-up commit additionally requires the durable recovery record to be pending and to match sender, verified user, JD, resume path, selected-file path, relative path, account directory, email, and explicit marker before sending. Missing/stale recovery provenance fails closed. The unsupported-JD hard-hold explanation now takes precedence over the ordinary coverage message even when the detail list is empty.


Source commits: `b14815d014299fe33a904afa013e8f8f5eea8faa`; test commit `c7b8e51d690707a61d6f0000bb764cc5693a25cf`. Existing synthetic cases cover selected fallback, automatic selection, fresh uploads, account/root mismatch, byte mismatch, provider unavailable, unsupported terms, and the new durable-record absence case. Source/test commits are `b14815d014299fe33a904afa013e8f8f5eea8faa` and `c7b8e51d690707a61d6f0000bb764cc5693a25cf`; Plan/REA/research follow-up commits are `bc5059dc117d7d731ea790479d95819ecab236b2`, `e1d92b24b5fe86d84cb379dae35a1ff903b68e55`, and `4744ca01d2b9c02ffe97f1fc4b527ff05143e197`. Draft PR #493 was opened from this restack at 2026-11-21T17:38:16Z. The initial head triggered full CI and WhatsApp recovery, while Kompas baseline and Plan/REA schema passed; this Plan/REA follow-up creates a new exact head, so require all four gates to rerun on the final SHA. This is source implementation on a draft PR, not a merge or release. No local build/test was run because the scheduled runtime lacks the checkout and dependencies.

## Next steps

1. Open a draft PR for this clean restack and run full CI, WhatsApp recovery, Kompas baseline, and Plan/REA schema on its exact final head.
2. Let MFit Safe Merge Gate sequence it with #479/#485 and the documentation-only #491; preserve concurrent entries and do not bypass approval.
3. After approval and merge, make one authorized production release, verify READY exact SHA and both canonical aliases, then smoke the webhook without outbound sends. Authenticated real-device and WhatsApp delivery remain separate acceptance.
4. Keep PR #450's R2 ETag-CAS/lease/fencing architecture and uploaded-original-after-timeout behavior unapproved.
5. Do not deploy or claim the 17 October file was delivered until the exact source, output DOCX, and signed provider receipt are available.


## 21 November — exact-head regression correction

The full CI run for PR #493 head `154ef6616dd592df7696bdf48e96cea52b20229b` failed at the inherited `WhatsApp refine` source-contract test in `scripts/tests/resume-guards.test.mjs` (run `44932154691`, job `136930917446`). Lint, type-check, the earlier Kompas/desktop/relevance/resume suites and migration closure all passed in that job; the identity-guard test was the single failure and later steps were skipped.

The test still expected the previous behavior: `sendBaseline(...)` and a caption saying the original resume was sent after identity/contact/date verification failed. The PR #493 route correctly refuses the rewritten file, leaves the version already held by the user unchanged, and only permits an unchanged file through `sendClosest` when the durable recovery record proves the exact same-account Files selection (`files.explicitlySelected`, verified path/account/email and byte equality). That permitted file is labelled exactly **Original resume — NOT TAILORED**. The source-contract test was updated on stacked branch `test/whatsapp-refine-no-baseline-after-identity-mismatch-20261121`; no runtime code changed.

The stacked branch still needs full exact-head CI, WhatsApp recovery, Kompas baseline and Plan/REA checks. It is not merged or deployed. No real WhatsApp/Meta send, R2 write, generated DOCX or historical 17 October replay occurred. The 17 October 17:28 Chicago delivery remains unverified.
