# Contract crawler abort diagnostics — current-master restack (22 November 2026)

## Request and approval

Continue the previously approved diagnostic-only collector correction from PR #479. The owner-approved crawler policy remains manual/on-demand only, no daily cron. Robert Half remains manual-only; eTeam stays excluded until a compliant official feed is verified.

## Current source and deployment

- Canonical master: `19a4ef20d09f43c2a22a9f1ef4bb5cdf81725a04`.
- Canonical production alias: `job-dashboard-fawn.vercel.app`, READY deployment `dpl_GCED4HQBdCgX7dsmiwB6RW7mzknk`, deployed SHA `b6c7f542641b96b7392710c25f1a6a803f71fd62`.
- Previous diagnostic branch: PR #479, head `e15f7dc5aa563a69c59c6d262ac913b71f171782`. It remains untouched; its checks are not reused.
- Current-master restack: PR #517, branch `fix/crawler-abort-diagnostics-current-master-20261122`, implementation commit `2c8cf6971efb785271e2f87afed86a458fd848fe`; Plan/REA and handoff commit `330bc195ecc17caa64255f10104a31d815c3c892`.

## Source change

- `politeFetcher` still defaults to 600 ms between requests and 25,000 ms per request.
- The optional timeout argument is used for deterministic tests; it does not change the production default.
- A local AbortController timeout is distinguished from an upstream AbortError, and the portal host is included in the diagnostic.
- URL parsing is inside the try/finally cleanup boundary, so a malformed adapter URL still advances the pacing timestamp.
- No retry/backoff, new adapter, source permission, classifier, freshness rule, schedule, storage, application, account/session or auth behavior changed.

## Regression coverage

Two tests were added to `scripts/tests/crawl-collect.test.mjs`:
1. A local timeout produces a host-specific timeout message, while an upstream AbortError produces a distinct message before the local timeout.
2. A malformed adapter URL rejects, but the next valid request still observes the configured pacing gap.

## Validation and release boundary

- No local test/build ran in this scheduled runtime; the container has no checkout and cannot resolve `github.com`.
- PR #517 exact-head full CI, crawler freshness/collector regression, Plan/REA schema and Kompas baseline are pending. Predecessor PR #479 results are not reused.
- No protected preview, production deployment or alias change is claimed.
- No live crawl, portal request, production-row mutation, application submission or cron change occurred.

Keep PR #517 DRAFT until all exact-head gates pass and the protected-preview/release requirement is legitimately satisfied. After a valid production release, verify the READY deployment SHA and canonical alias before considering the diagnostics live. A separate authorized manual crawl is required for fresh job data.
