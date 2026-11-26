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


## 24 November — test-source audit correction

A remote source audit of the PR branch found a missing closing parenthesis in `scripts/tests/apply-clearance-filter.test.mjs` (the first crawler assertion), which would prevent Node from parsing that test file. Corrected on commit `0fb890a5207c34d9ad6966b6b255d1da3734e796`. This was found through GitHub source inspection; no local execution is available. Exact-head remote CI must confirm the test file parses and runs. The earlier crawler-focused green run did not establish that this file had executed.


## 25 November — concurrent crawler write correction

The previous multi-page offset scan used `last_seen_at`, a sort key that manual crawls can update while the search is paging. Even with a UUID tie-breaker, a moving row can cross an offset and be skipped or duplicated. The approved continuation replaces that scan with one ordered bounded query snapshot, then filters clearance in memory. The same 14-day cutoff, default exclusion, 100–1,000-row cap, explicit cap warning and manual-only crawler policy remain.

Regression coverage now exercises snapshot filtering, the cap signal and the route's single-query/no-offset contract. The tests are committed on PR #575, but no local Node execution occurred. Exact-head remote CI is pending; the common master lint/Kompas fixture blocker remains tied to PR #554. Protected preview and production/API acceptance remain pending.


## Exact-head validation update — 25 November 2026

Code/test head `c38508dd12641250a86f2953b888b66a6e851448`: crawler freshness/classification `45588555323`, manual-only `45588555335`, Plan/REA `45588555396`, and Kompas baseline `45588555314` all SUCCESS. Full CI `45588555512` FAILED on shared lint `src/lib/kompasConsistency.ts:1059` (`prefer-const`); this is part of PR #554 and is not duplicated here. The first Plan/REA run failed because the updated REA entry lacked a comma; corrected in `d01ba02` and schema check passed on `c38508dd`. No local Node execution. PR #575 remains DRAFT; protected preview, production/API acceptance and separate manual crawl authorization are pending.

## 25 November 2026 — terminal and filled-limit edge coverage

The current PR #575 code/test head adds two helper regressions: a terminal database snapshot shorter than the scan cap can underfill without setting `clearance_scan_limited`; and if the visible limit is filled at the cap, the response does not show a misleading limited notice.

Code/test commit: `dff71866c839a7ba42c61dac39d37d0b473c75ed`. Exact-head crawler freshness/classification `45648678364`, manual-only `45648678152`, Plan/REA `45648678127`, and Kompas baseline `45648678301` passed. Full CI `45648677995` failed at the existing master `prefer-const` lint error in `src/lib/kompasConsistency.ts:1059`, before type-check/build. The docs-only follow-up head `a7d972337b2344a8d76b6d7e923b3aaeb88d91e3` has Plan/REA schema `45650386942` SUCCESS.

The candidate remains DRAFT and unreleased. PR #554 is the shared lint/Kompas VM prerequisite; its exact-head source gates pass, but it still requires a second authorized reviewer. Protected preview requires the owner-controlled `KOMPAS_VERCEL_API_TOKEN`. No production crawl, portal request, DB mutation, job submission or deployment occurred. Manual/on-demand policy, Robert Half manual-only and eTeam exclusion remain unchanged.


## 25 November 2026 — restack against current production master

The branch is being advanced onto production master a17b3267e271c77cd8887312445271b7fa172bd0, which is independently READY at deployment dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW and owns the canonical job-dashboard-fawn.vercel.app alias. The earlier exact-head crawler freshness/classification, manual-only, Plan/REA and Kompas baseline checks passed; full CI failed at the old prefer-const lint error. Current master contains that correction and the shared VM harness initialization, so a new exact-head full CI is required rather than reusing the old failure or the old green focused checks. The restack preserves the one-query snapshot and does not change crawler schedules, adapters, clearance policy, work-type classification or application submission. No live crawl, portal request, database mutation, application or deployment occurred.


## 26 November — clean current-master restack

The candidate is being isolated from PR #575's unrelated Kompas overlay/desktop changes. The restack applies only the five crawler/search/UI/test files to current master, with the clearance notice and research record. Current master at restack start: `e2a94783041559c8c0c317f860ef1ba792de9fc9`; production alias was still READY at `a17b3267e271c77cd8887312445271b7fa172bd0`. Source changes reviewed: a stable `last_seen_at DESC, id ASC` order, one bounded query (100–1,000 rows), clearance filtering before the requested limit, and a user-visible scan-cap notice. The existing 14-day freshness, contract default, `clearance=include`, adapter list, manual-only crawl schedule, Robert Half manual-only and eTeam exclusion remain unchanged. This is a source/test restack, not a deployment.


**Limitations:** location/remote filtering remains client-side and can underfill; the crawl POST route's 60-second Vercel duration is shorter than the runner deadline; protected preview is unavailable. The sandbox could not resolve GitHub, so no local tests/build were run. Exact-head remote CI is pending. No live crawl, portal request, DB write or application was performed.


## 26 November — PR #590 clean current-master restack

The candidate is isolated from PR #575's unrelated Kompas overlay/desktop changes. PR #590 applies only the five crawler/search/UI/test files to current master, with the clearance notice and research record. Current master at restack start: `e2a94783041559c8c0c317f860ef1ba792de9fc9`; production alias was still READY at `a17b3267e271c77cd8887312445271b7fa172bd0`. Source changes reviewed: a stable `last_seen_at DESC, id ASC` order, one bounded query (100–1,000 rows), clearance filtering before the requested limit, and a user-visible scan-cap notice. The existing 14-day freshness, contract default, `clearance=include`, adapter list, manual-only crawl schedule, Robert Half manual-only and eTeam exclusion remain unchanged. Source commit: `7cf941373cf203c8327b5592d719b60677579630`.

**Limitations:** location/remote filtering remains client-side and can underfill; the crawl POST route's 60-second Vercel duration is shorter than the runner deadline; protected preview is unavailable. The sandbox could not resolve GitHub, so no local tests/build were run. Exact-head remote CI is pending. No live crawl, portal request, DB write or application was performed.
