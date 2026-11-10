# Contract-to-hire engagement label normalization — 10 November 2026

## Request

Improve contract-job discovery without guessing from vendor names or ordinary prose. Normalize explicit `Right To Hire` and `Contract To Perm` engagement labels to the existing `C2H` category, while preserving negative evidence and leaving source records with no employment-type data as unknown.

## Evidence sources

- Read-only production aggregate over active `mfit_crawl_jobs` rows on 10 November 2026. No rows were modified.
- INSPYR Solutions, [Contract or Full-Time IT Workers: Which Should You Hire?](https://www.inspyrsolutions.com/contract-or-full-time-it-workers-which-should-you-hire/). The article states that right-to-hire work is also known as contract-to-hire or temporary-to-permanent work.
- INSPYR Solutions job listing indexed by iHire, [AI Engineer](https://www.ihiretechnology.com/jobs/view/542706863), which labels the role “Right to Hire” and describes it as contract-to-hire.
- Canonical adapter source: `src/lib/crawl/portals/everforth.ts`.

## Production snapshot

The latest observed crawl was 10 November 2026 at 11:00 UTC: 6,818 jobs found/upserted across 20 portals, eTeam skipped, one Inspyr abort. That crawl preceded the current master release and is not post-change evidence.

The read-only active-row aggregate at this check returned:

| Measure | Count |
|---|---:|
| Active jobs | 12,407 |
| `work_type=contract` | 8,850 |
| `work_type=unknown` | 2,612 |
| `work_type=permanent` | 945 |
| `engagement=Contract To Perm` | 589 |
| `engagement=Right To Hire` / `Right to Hire` | 131 |

The 589 “Contract To Perm” rows are from Insight Global. The 131 “Right To Hire” rows are Genesis10 (76), INSPYR (53), and eTeam (2). The existing classifier already treated “Contract To Perm” as generic contract because it contains the explicit word “Contract”, but it did not identify it as C2H. It did not recognize “Right To Hire” as contract evidence.

Of the 2,612 unknown rows, 2,311 are from Everforth. Its current adapter exposes title, location and date only; it does not provide an employment-type field or description for classification. These rows must remain unknown. Do not infer contract status from the Everforth vendor name or a technical job title.

## Decision

- Treat explicit `Right To Hire`, `Right-to-Hire`, `Contract To Perm`, `Contract-to-Perm`, and `Contract To Permanent` labels as `C2H`.
- Keep explicit negations such as `No Right To Hire`, `No Contract To Perm`, and `No C2H` from creating contract evidence.
- Preserve the existing W2-only, C2C, 1099, temporary and permanent behavior.
- Do not infer contract work from employer identity, job title alone, or a missing employment-type field.

## Implementation

PR #291, branch `fix/apply-right-to-hire-classification-20261110`, updates `src/lib/contract-jobs.ts`, adds positive and negative cases to `scripts/tests/crawl-classify.test.mjs`, and wires that suite into the normal `prebuild` command in `package.json`.

Implementation commit: `cddd2fbbaf9d12adb6905a17d7a9baaf8fdbeaf2`.

## Validation boundary

On code head `a9d19d889520563e873085076b953720193a69c6`, crawler classification regression `42926214089`, Plan/REA schema `42926214121` and Kompas baseline `42926214174` passed. Full CI `42926214083` failed at the shared `Verify grounded spoken streaming and original-source claims` step before Build; lint/typecheck passed. Vercel preview `42926208890` failed with Account is blocked. The crawler regression executed the new classification tests; prebuild did not run because Build was skipped. The next scheduled crawl is 11 November 2026 at 11:00 UTC and is the first opportunity to validate the new mapping against fresh production records. Do not claim the 720 candidate labels have been reclassified until that run is inspected.

The Vercel project currently reports `live:false`; the protected Vercel status reports “Account is blocked”. The supported unpause action returned no state change. No production deployment, public HTTP acceptance, or post-release crawl is claimed.