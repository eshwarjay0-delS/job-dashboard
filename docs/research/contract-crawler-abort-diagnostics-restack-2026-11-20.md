# Contract crawler abort diagnostics — current-master restack, 20 November 2026

## Request and approval boundary

Continue the approved contract job search/crawler with a narrow diagnostic repair for portal aborts. This does not authorize a live crawl, a new portal, new source permissions, automatic retry/backoff, classifier changes, freshness changes, a schedule change, application submission, or production data mutation.

The owner correction remains authoritative: contract crawling is manual/on-demand only; no daily contract-crawler cron; Robert Half is manual-only; eTeam remains excluded from the active 20 adapters until a compliant official feed is verified.

## Current master and stale-branch reconciliation

- Current canonical master at the start of this restack: `db13450a61a1188ad7cd95b148c32baefa6e14ad`.
- Existing PR #451 branch head: `cede6180da3aaf4a83b3e3b8baeb7b6d633baba1`.
- GitHub compare reported 11 commits ahead / 17 behind and `diverged`; the PR was not merged or force-updated.
- Exact master/branch file comparison showed no intervening edits in `src/lib/crawl/collect.ts` or `scripts/tests/crawl-collect.test.mjs`. Only those two focused files were carried forward. The old Plan/REA and product-plan snapshots were not copied.

## Existing crawl evidence

The last evidenced completed crawl remains 10 November 2026, 11:00:24–11:01:11 UTC: 20 portals, 6,818 found/upserted, one Inspyr error reported as “This operation was aborted”. That generic message does not establish whether the local timeout or upstream fetch implementation aborted. No new portal request was made.

## Source and regression change

- Collector source commit: `5dcb4e8aaf21f4f2a69cae8df7150784f9e28294`.
- Regression-test commit: `0aea6fb77e21f17f9c1dce2078a2c2ed30f8c8e5`.
- `politeFetcher` keeps the existing 600 ms default request gap and 25,000 ms default timeout; a second timeout argument supports short deterministic tests.
- A local AbortController timeout now reports the portal host and configured timeout.
- An upstream AbortError before the local timeout is reported separately.
- URL parsing is inside the try/finally cleanup boundary, so malformed URLs still clear the timer and advance request pacing.
- Tests cover local timeout attribution, upstream AbortError attribution, and malformed-URL cleanup/pacing before the next valid request.
- No retry/backoff, adapter, portal permission, classifier, freshness, schedule, storage, or application behavior changed.

The current master crawler workflow already watches `src/lib/crawl/collect.ts` and `scripts/tests/crawl-collect.test.mjs`; no workflow or `vercel.json` change is needed. The current `vercel.json` has no `/api/crawl/run` cron.

## Validation and release status

Prior PR #451 exact-head runs were green: full CI 44472689901, crawler 44472689912, Plan/REA 44472689839 and Kompas baseline 44472689791. Those runs belong to the old head and are not reused for this restack. New exact-head checks and Safe Merge Gate review are pending.

Vercel project `job-dashboard` currently reports `live=false`. Latest production attempt `dpl_LbkLUxKN3Dom56dtdDJMY2f6QoGX` is CANCELED by the configured ignored-build step. Canonical alias `job-dashboard-fawn.vercel.app` is still READY on `dpl_FusdJPpFqFu6ZwMGTgg3pLomCAH9`, SHA `5af72c125649b1306dd804704963edc40d1d3215`, not current master. A sandbox attempt returned HTTP 402 `payment_required`; Vercel reports the Hobby usage limit resets at `2026-12-01T00:00:00Z`. No billing, protection, or access-control setting was changed.

No local repository checkout or installed `node_modules/next/dist/docs` is available. No local test run, protected preview, production deployment, live crawl, portal request, production write, application submission, email or WhatsApp send is claimed.

## Next

Await exact-head full CI, crawler freshness/collector, Kompas baseline and Plan/REA. Keep the PR DRAFT until MFit Safe Merge Gate review and the legitimate protected-preview path are available. Do not add a `[ship]` marker, unpause the project, bypass protection, change billing, restore a cron, or run a live crawl. After an authorized production release is READY on the exact merge SHA and canonical alias, a separate explicit manual request is still required for post-release crawl acceptance.
