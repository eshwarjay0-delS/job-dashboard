# WhatsApp unsupported-JD hard-hold restack — 24 November 2026

## Owner-approved scope

The 19 November owner correction is authoritative: an incomplete or identity-mismatched WhatsApp resume may fall back only to an explicitly selected same-account Files/Library resume, labeled exactly **Original resume — NOT TAILORED**. Unsupported JD-only experience or credentials must not be sent as candidate claims. A matching profile email is necessary, but does not prove durable explicit selection.

This restack isolates the hard-hold/identity helper fix from the unapproved R2 CAS, lease/fencing, recovery queue, provider-callback, and uploaded-original-after-timeout changes in PR #450. It does not implement route-level durable selection provenance.

## Verified current master and production

- Current canonical master at restack: `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Production Vercel deployment: `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, READY, exact SHA `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Independent alias lookup maps `job-dashboard-fawn.vercel.app` to that same READY deployment; `marketfit-app.vercel.app` is also assigned. This is deployment evidence, not WhatsApp delivery acceptance.

## Source change on the restack

- Remove `unverified_jd_terms` from the WhatsApp shortfall-delivery allowlist.
- Explicitly fail `whatsappRewriteUsable` when unverified added keywords exist or the cached quality blocker is `unverified_jd_terms`, including an empty detail list.
- Require a nonblank profile email before `chosenResumeMatchesProfile` can return true; the document must contain exactly one matching email. Commit `667bc5568c9d1975f4f5169a251d6d10eb71d469` also aligned the comments and removed the redundant unverified-term shortfall branch.
- Add three synthetic regression cases for unsupported JD-only terms, a stale blocker with empty details, and missing/blank/matching/mismatching profile email.
- Wire the existing acceptance test file into full CI and the WhatsApp resume regression workflow.

The explicit-selection proof and exact fallback caption are deliberately not claimed by this helper. The new restack is based on current master, rather than the old PR #486 base, and preserves current-master code.

## Validation and release state

- Source, tests and CI wiring are committed to branch `fix/whatsapp-hard-hold-restack-20261124`; remote exact-head checks are pending for the docs follow-up.
- No local checkout or installed `node_modules` is available in this scheduled environment. GitHub Actions is the test path; no local test/build is claimed.
- No merge, production deployment, DOCX generation, R2 write, model call, WhatsApp send, historical replay, database mutation, or user-device test occurred.
- Original PR #486 is still a draft and non-mergeable on its stale base. It remains open until this restack has exact-head checks; it should be closed as superseded only after the replacement is validated.

## Historical incident and blockers

The 17 October 2026 17:28 Chicago WhatsApp failure remains unverified: the generated output DOCX, per-run R2 key/version, request/webhook correlation, Meta outbound message ID, and signed delivered/read receipt are missing. No replay or resend is authorized.

The durable explicit-selection route task remains blocked by the absence of a canonical local checkout and installed Next.js 16.3.8 route-handler guide. The prior Vercel sandbox resume returned HTTP 402 for exhausted Hobby snapshot storage, reset 1 December 2026. Do not change billing, bypass access, or substitute upstream docs for the installed guide.

## Next

1. Run exact-head full CI, WhatsApp recovery regression, Kompas baseline and Plan/REA schema on the new restack.
2. Keep the replacement PR DRAFT; review and protected preview/release gates remain separate.
3. Only after the required environment is available, implement durable same-account explicit Files/Library selection and exact fallback caption; preserve the original source and all account isolation.
4. Do not claim the 17 October file was delivered without the missing artifacts and provider receipt.


## 25 November — shared lint blocker corrected on this draft

The full CI failure at `src/lib/kompasConsistency.ts:1059` was `prefer-const` only. This branch now changes the local `let s` to `const s` in the existing sentence cleanup, with no behavior change intended. Commit `71a1f74b03c766fd5fbec5aa69e4476064c6b605`. Fresh exact-head CI is required; prior full-CI failure cannot be reused.


## 25 November 2026 — review correction: false-incomplete role-evidence gap

The PR #578 review was corrected on 24 Nov: the Oct 30 issue #132 sample actually recorded `incomplete=true`; the earlier wording must not imply that the helper reproduced or caused that historical incident. The residual concern is a separate synthetic combination where `role_evidence_gaps` and `quality_not_deliverable` remain while `quality.incomplete=false`. Those codes were still shortfall-allowlisted.

### Narrow correction

- When `role_evidence_gaps` is present and JD overlap is at least 70% while supported coverage is at least 95%, `whatsappRewriteUsable` now fails closed even if `quality.incomplete=false`.
- The existing below-70% finished-file shortfall behavior remains unchanged; the 30.8% / 30.8% positive regression continues to document that separate approved path.
- Added a synthetic 82% JD / 100% supported-coverage test with `quality.incomplete=false`, `quality_not_deliverable`, and `role_evidence_gaps`; it asserts the draft is neither usable nor delivered with shortfall.
- Source/test commit: `5f38fc716849af742324dc667039b11765be09fb` on PR #578. Exact-head Actions were not yet visible when this note was prepared. No local checkout/test run.

This is a stricter helper-level regression guard, not a reproduction of either the Oct 30 sample or the separate 17 Oct 17:28 Chicago delivery. The 17 Oct output DOCX, per-run R2 key/version, request/webhook/Meta correlation and signed delivered/read receipt remain missing. No DOCX, model call, R2 write, real WhatsApp send, replay or user-device acceptance occurred.


## 25 November 2026 — source-recovery correction from PR #275

PR #275, merged as `864cb9e906543b006ea730a8de1fa3e65b652ab9`, records that the exact original input DOCX and matching Risk & Controls JD were recovered and reviewed privately from the user's Library and inbox. Public artifacts omit the source locator, file digest, screenshot artifact ID and Gmail thread identifier. The current run found similarly named Library DOCX candidates and a Risk & Controls JD email, but did not independently prove byte identity with the original WhatsApp upload. Do not revert the documented recovery to “source unavailable,” and do not upgrade it to a new byte-level verification.

The generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta outbound message ID and signed delivery/read receipt remain missing. Source/JD recovery does not establish that a generated file was stored, sent, delivered or read. No replay, re-export, R2 mutation or outbound WhatsApp send occurred.


## 25 November 2026 — current-master restack and source-recovery correction

The synthetic false-incomplete case is distinct from the Oct 30 production sample, which recorded `incomplete=true`. The helper now fails closed when `role_evidence_gaps` coexists with JD overlap >=70% and supported coverage >=95%, even if `quality.incomplete=false`. The below-70% disclosed-shortfall path is preserved. The 82%/100% regression is in `scripts/tests/whatsapp-resume-acceptance.test.mjs`.

The code/test origin is `5f38fc716849af742324dc667039b11765be09fb`; it is restacked onto current master `a17b3267e271c77cd8887312445271b7fa172bd0` in `fix/whatsapp-hard-hold-master-restack-20261125`. Exact-head CI, protected preview and deployment are pending; no local tests were run.

PR #275 (merged as `864cb9e906543b006ea730a8de1fa3e65b652ab9`) records private recovery/review of the exact original input DOCX and matching Risk & Controls JD. This run did not independently prove byte identity of a similarly named Library copy. The generated output DOCX, per-run R2 object/version, webhook/request correlation, Meta message ID and signed delivery/read receipt remain missing. No replay, re-export, R2 mutation or outbound WhatsApp send occurred.
