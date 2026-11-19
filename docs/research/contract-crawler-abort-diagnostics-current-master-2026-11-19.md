# Contract crawler abort diagnostics — current-master restack, 19 November 2026

## Request and boundaries

Continue the approved contract job search/crawler by making a historical portal-abort message diagnosable. This is a diagnostic-only source/test change. It does not authorize a live crawl, new portal, source permission, automatic retry, application submission, schedule change or production database mutation.

The owner correction of 12 November remains authoritative: contract crawling is manual/on-demand only, there is no daily contract-crawler cron, and Robert Half remains manual-only. eTeam remains excluded from the 20 active adapters until a compliant official feed is verified.

## Existing production evidence

The latest recorded completed crawl remains 10 November 2026, 11:00:24–11:01:11 UTC: 20 portals, 6,818 jobs found/upserted, and one Inspyr error reported as “This operation was aborted”. That generic message does not establish whether the local 25-second AbortController timeout fired or the upstream fetch implementation aborted. No new portal request was made in this continuation.

## Source change

Current master at the restack point: `d03f18892015bdfceb277500978cbacd95ae7808`.

- `politeFetcher(gapMs, requestTimeoutMs)` retains the existing 25,000 ms default.
- A local AbortController timeout reports the portal host and configured timeout.
- An upstream AbortError before the local timeout is reported separately.
- URL parsing is inside the try/finally cleanup boundary so malformed adapter URLs still clear the timer and advance request pacing.
- No automatic retry/backoff, adapter, URL, classifier, freshness cutoff, permission, schedule or storage behavior changes.

Source commit: `f0c0e0cf59e687e381262b1bdb25d1e854c6d4fd`.

## Regression coverage

The current-master test file adds mocked cases for:

1. Local timeout attribution and host.
2. Upstream AbortError attribution.
3. Malformed URL cleanup and preservation of the request-pacing gap before the next valid request.

Test commit: `19d619a207bd0e29aac9ce10db61d77b907081f7`.

Current master already runs `scripts/tests/crawl-collect.test.mjs`, the active portal registry/source-safety tests, and `scripts/tests/crawl-manual-only.test.mjs` in the dedicated crawler workflow. No workflow change was needed. The existing `vercel.json` contains no `/api/crawl/run` cron.

## Release and verification status

Draft PR [#451](https://github.com/eshwarjay0-delS/job-dashboard/pull/451) carries the source/test changes and this Plan/REA handoff. Exact-head full CI, crawler freshness/collector, Kompas baseline and Plan/REA checks are required after the documentation commits. Local clone/test execution is unavailable because `github.com` DNS did not resolve in this environment; GitHub Actions is the validation path.

Vercel project `job-dashboard` reports `live:false`; latest production deployment `dpl_AknmUNcd9Cgo8mTiZz3Ex7FEfb9i` is CANCELED. The canonical alias remains on older READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. Protected preview requires owner-controlled `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run. Do not unpause, bypass protection, change billing or deploy around these controls.

No live crawl, portal request, production write, application submission, email or WhatsApp send occurred.

## Next

Complete exact-head CI and MFit Safe Merge Gate review. A legitimate protected preview and authorized project restoration are required before any release. After production READY and canonical alias verification, a separate explicit manual request is required before any live crawl acceptance.
