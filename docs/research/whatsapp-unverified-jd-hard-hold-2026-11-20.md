# WhatsApp unsupported-JD hard hold — isolated approved slice, 20 November 2026

## Scope and approval

This is a narrow source/test continuation of the owner's approved WhatsApp resume reliability work. The latest accessible owner correction on 19 November 2026 at 23:22:42Z requires a fallback to be restricted to an explicitly selected same-account Files/Library resume, labelled exactly **Original resume — NOT TAILORED**. Unsupported JD-only qualifications or experience must never be represented as candidate experience. A fresh upload without explicit library selection must not be silently substituted or sent unchanged.

The historical 27 October closest-matched-library failsafe remains preserved as history; the later 19 November correction narrows its implementation. This slice does not implement the explicit-selection marker or webhook route wiring.

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

Test commits: `597979a80aec648e16a14dc4782c15b31ee4af9c`, `b941baa31536669679194c30219488aafde815fc`, and final isolated assertion fix `ac37a6147f6c066487a2356f024d127252337d9c`.

The change is deliberately split from PR #450. It does not include R2 ETag-CAS/conditional writes, worker leases/fencing, recovery queue changes, provider callback changes, or uploaded-original-after-timeout behavior. Those remain unapproved and are not copied into this branch.

## Validation and deployment state

- No local test/build was run: this scheduled environment has no canonical repository checkout or installed `node_modules` tree.
- Exact-head GitHub Actions full CI, WhatsApp recovery, Kompas baseline, and Plan/REA checks must run after the final documentation commit. No earlier or predecessor-head test result is reused.
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

## Next steps

1. Require full CI, WhatsApp recovery, Kompas baseline, and Plan/REA schema success on the exact final PR head.
2. Let MFit Safe Merge Gate sequence the PR with shared Plan/REA work in #479 and #485; preserve all other developers' entries and rebase if needed.
3. Keep explicit Files/Library selection provenance and webhook wiring as a separate pending route task. AGENTS.md requires the installed Next.js 16.3.8 route-handler guide before that route change; this runtime has neither the installed package tree nor a runnable local checkout.
4. Keep PR #450's R2 ETag-CAS/lease/fencing architecture and uploaded-original-after-timeout behavior unapproved.
5. Do not deploy or claim the 17 October file was delivered until the relevant source, exact output and signed provider receipt are available.
