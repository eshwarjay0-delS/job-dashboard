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
