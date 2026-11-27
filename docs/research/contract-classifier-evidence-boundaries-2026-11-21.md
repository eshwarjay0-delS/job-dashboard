# Contract classifier evidence boundaries — 21 November 2026

## Owner correction

The 14 November 2026 correction in accessible owner-authored history is authoritative: Right To Hire / Contract To Perm → C2H semantics remain proposed/unapproved, and explicit negations require negative tests. The existing manual/on-demand crawler policy remains unchanged.

## Source findings on master 13542c5

- src/lib/contract-jobs.ts classified contract-to-permanent as C2H.
- src/lib/crawl/portals/pyramid.ts classified right-to-hire as Contract to Hire.
- contractTypes() only guarded a subset of negative C2C/1099 forms. No C2H, Not contract, Without 1099, Contract not required, and Temporary is not offered could still be interpreted as positive evidence.
- classifyWorkType() checked permanent terms in raw text, so Not permanent could be mislabeled permanent.

## Correction branch

Branch: fix/apply-contract-negation-c2h-boundaries-20261121

- Add positiveEmploymentEvidenceText() to remove explicit negative employment statements before classifying contract or permanent evidence.
- Keep only explicit C2H and Contract To Hire phrases in the C2H branch.
- Treat Contract To Perm / Contract To Permanent as generic Contract at most, not C2H.
- Leave Right To Hire alone as unknown.
- Apply the same negative-text normalization before the crawler's permanent/direct-hire/full-time checks.
- Preserve existing positive W2/C2C/1099 code paths without adding new positive semantics or claiming new owner approval.

## Tests added

- scripts/tests/mail-compose-contracts.test.mjs: negative prefix, suffix, and mixed-positive cases.
- scripts/tests/crawl-classify.test.mjs: negated contract/permanent terms remain unknown; Right To Hire remains unknown.
- scripts/tests/crawl-portals-4.test.mjs: Pyramid does not promote Right To Hire to Contract To Hire; Contract To Perm remains generic Contract.

## Safety and acceptance

- No route, schedule, adapter registry, or production database was changed.
- No live crawl, portal request, row reclassification, application submission, email, WhatsApp message, or production deploy occurred.
- vercel.json remains manual-only for contract crawling; Robert Half remains manual-only; eTeam remains excluded pending a compliant official feed.
- Local repository execution is unavailable in this scheduled environment. Exact-head GitHub Actions full CI, crawler regression, Plan/REA schema, and Kompas baseline are required on the final PR head. The protected preview/release gate remains separate; do not add a [ship] marker or bypass SSO/protection to test this branch.
- Passing unit tests do not establish a live crawl or user acceptance.

## Next

Run exact-head workflows, review the diff for positive-evidence regressions, then let MFit Safe Merge Gate sequence the review. Do not merge or deploy until the exact-head checks and legitimate release gate are satisfied.

## Generic fallback caller regression — 21 November 2026

The Apply contract board calls `contractTypes(j.engagement || '', 'contract')`. Cleaning a negative first argument such as `Not contract` was insufficient because the second argument reintroduced a positive generic label. The helper now suppresses only that generic fallback when the source explicitly negates generic contract work; negating `Contract-to-Hire` alone does not negate generic contract work, and independent positive C2C/1099 evidence is preserved.

Regression coverage mirrors the exact two-argument caller, including negative prefix/suffix forms, the C2H-vs-contract distinction, and mixed negative/positive evidence. This is source-level test coverage, not a live portal reclassification or production acceptance.


## 27 November 2026 — exact-head negative-phrase static review

Reviewed PR #487 at code head `b0c1ffa99719857186f321bfb7a908afdc181d5e`. The shared negation helper is incomplete for common wording: `Contract isn't required`, `Contract is not a requirement`, `Contract role isn't offered`, `Permanent isn't required`, and `Permanent is not a requirement` remain positive. The suffix regex handles `is/are/was/were` but not contractions or `not a requirement`. The unchanged Pyramid `kindOf()` also reads raw first-400-character description: `No contract` still maps to `Contract`, and `Not permanent` maps to `Full Time`. The PR's new Pyramid assertions cover Right To Hire and Contract To Perm, not these negatives.

- Reproduction: isolated Node 22.16.0 script copying the PR helper/classifier/portal function (not the repository test suite) confirmed each case above.
- Review: comment-only review https://github.com/eshwarjay0-delS/job-dashboard/pull/487#pullrequestreview-6082323751; asked for exact regressions and shared positive-evidence normalization in Pyramid.
- PR #487 remains DRAFT, non-mergeable on an older base. Exact-head full CI, crawler classification, Kompas baseline and Plan/REA are green; review finding is unresolved. No local repository tests/build, protected preview, production deployment, live crawl or production-row mutation.

**Next:** fix the contractions and requirement-phrase guard, make Pyramid use the shared normalized text, add the exact negative tests, restack onto current master, and rerun all required exact-head gates. Keep the crawl manual/on-demand only.
