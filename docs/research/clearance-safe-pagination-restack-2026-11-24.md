# Clearance-safe pagination — current-master restack (24 Nov 2026)

## Scope and approval

This is a continuation of the approved contract-job search/crawler work. It does not change adapter coverage, work-type classification, clearance policy, crawler cadence, portal collection or application submission. The contract crawler remains manual/on-demand only; Robert Half remains manual-only and eTeam excluded pending a compliant feed.

## Observed bug on canonical master

Master `794e8cfdbd3103409552857806bab89851d5bfcb` fetches one 4× over-fetch capped at 100 rows, then filters clearance postings. If the fetched window is clearance-heavy, later eligible listings are never scanned and results silently underfill. The 14-day freshness cutoff and default clearance exclusion are already in source.

## Candidate on PR #575

- Stable total order: `last_seen_at DESC, id ASC`.
- Filtered-page helper scans 100-row pages, stops when the visible limit is reached, the query ends, or the safe cap is reached.
- Cap: `min(1,000, max(100, limit × 10))` rows per request.
- Response includes `excluded_clearance` and `clearance_scan_limited`; the Apply page gives a plain-language warning and suggests narrowing the search when capped.
- `clearance=include` retains the direct caller-limit path; default exclusion, freshness and manual-only policy are unchanged.

## Tests added

- Clearance-heavy first page followed by eligible results fills the requested limit.
- Scan stops at a bounded cap and reports underfill.
- Stable unique tie-breaker is pinned by route/migration contract.
- Apply UI notice is pinned.

## Evidence and limits

Current-master source was fetched via GitHub. PR #575 contains five code/test files. Exact-head crawler regression 45399469446, manual-only 45399466795, Plan/REA 45399467210 and Kompas baseline 45399466971 passed. Full CI 45399466816 failed at the shared master prefer-const lint `src/lib/kompasConsistency.ts:1059`; #554 contains the correction but remains awaiting second review. Previous PR #288 green checks were on older SHAs and are not reused. Local `git clone` failed because this container could not resolve `github.com`; local tests/build were not run. Protected Vercel preview is blocked by the unavailable private `KOMPAS_VERCEL_API_TOKEN`. The current production alias is READY at the unchanged master SHA; no production deployment of this candidate exists. No crawl, portal request, database mutation, application submission or live API smoke occurred.

## Next gate

Require exact-head full CI, crawler regression, Plan/REA schema, Kompas baseline and manual-only policy regression. Review the source and synthetic tests. Keep draft until the legitimate protected preview is available; do not bypass protection. After merge/deploy, verify the READY canonical alias and public API response. A post-change crawl requires a separate explicit owner request.
