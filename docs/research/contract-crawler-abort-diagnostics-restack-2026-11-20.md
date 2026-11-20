# Contract crawler abort diagnostics — additive restack on current master (20 November 2026)

## Scope and approval boundary
This is an additive restack of the previously approved diagnostic-only collector correction from PRs #470/#471. It does not authorize a live crawl, new portal, source permission, retries/backoff, classifier/freshness change, schedule, application submission or production data mutation.

The owner correction remains authoritative: crawling is manual/on-demand only; no daily contract-crawler cron. Robert Half remains manual-only, and eTeam remains excluded until a compliant official feed is verified.

## Base and branch preservation
- Previous PR head: `671a3732105111a8d8fdf91678359fb74f7b5332`.
- Current master: `13542c5e1127ed7c1ccf59e4faa034d0af021fc1`.
- Safe branch: `safe-merge/crawler-abort-diagnostics-master-20261120-1455z`.
- Prior safe branch PR #471 head `6c390ab5b64144e022ff750174645a03be97a4f9` is `mergeable_state=dirty` after master advanced through PR #467. Its conflict includes shared Plan/REA files.
- Original draft PR #470 and prior safe PR #471 are preserved untouched. The branch was advanced by a two-parent merge commit preserving both the previous PR head and current master. The ref update was a non-force fast-forward guarded by the expected previous head SHA. Original PRs #470 and #471 remain untouched.

## Source and regression
- `politeFetcher` retains the 600 ms default pacing and 25,000 ms default timeout; the optional timeout parameter is for deterministic tests.
- A locally triggered AbortController timeout is distinguished from an upstream `AbortError`, with the portal host included in diagnostics.
- URL parsing stays inside the `try/finally` cleanup boundary, so malformed URLs still clear the timer and advance pacing.
- Two deterministic tests cover local timeout versus upstream abort and malformed-URL pacing cleanup.
- No new retry, adapter, schedule, crawler permission, data mutation or application behavior is introduced.

## Validation and release boundary
Exact-head full CI, crawler freshness/collector regression, Plan/REA schema and Kompas baseline must run on the updated branch head; predecessor results are not reused. Prior PR results are not reused. No local test execution, live crawl, portal request, production-row mutation, protected preview, production deployment or alias change is claimed.

Keep the replacement PR draft until the exact-head checks pass and any legitimate protected preview/release requirement is satisfied. Do not bypass Vercel protection/quota, change billing, add a ship marker, restore a cron or run a crawl.