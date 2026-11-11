# Contract To Perm and Right To Hire classification — 11 November 2026

## Decision

The contract-only Apply product accepts W2, C2C, 1099 and C2H shapes. Explicit “Right To Hire”, “Right-to-Hire”, “Contract To Perm”, “Contract-to-Perm” and “Contract To Permanent” language is C2H evidence. Explicit negation (for example, “No Right To Hire”) is not positive contract evidence. Vendor names, job titles and ordinary prose do not establish work type.

## Implementation

PR #305 restacks the approved alias classifier on current master. The implementation delegates to the shared contract-type classifier and preserves the existing W2/C2C/1099/Temporary/Contract distinctions. It adds source-level and runtime regression cases for positive aliases and explicit negation, and retains the Kompas baseline as the first fail-fast prebuild step.

Current branch: `fix/contract-right-to-hire-c2h-master-restack-20261111`, head `6a7c946866b728a1a0ac8f7579d096a399d6b37e`.

## Production evidence (read-only)

- Latest completed crawl: 10 November 2026 11:00:24–11:01:11 UTC; 6,818 found/upserted across 20 portals; one Inspyr abort.
- No 11 November crawl row exists.
- Active rows: 8,850 contract, 2,612 unknown, 945 permanent.
- Explicit Contract To Perm: 589 active rows, currently generic contract and none unknown.
- Explicit Right To Hire: 131 active rows, currently unknown.
- No database rows were modified and no manual crawl was run.

## Exact-head test status

- Crawler classification regression `43088429396`: SUCCESS.
- Kompas baseline `43088429572`: SUCCESS.
- Full CI `43088429576`: IN PROGRESS at Webpack build.
- Protected Vercel preview/public HTTP is unavailable because the project reports `live:false`.

After the owner restores the Vercel project, require a normal READY production deployment at the exact reviewed SHA, the canonical alias, public Apply API smoke, and a subsequent scheduled crawl that demonstrates reclassification. The separate Inspyr abort and missing 11 November crawl are availability issues, not fixed by this classifier.
