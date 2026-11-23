# Contract-crawler request diagnostics — current-master restack (23 November 2026)

## Approved scope and correction
The existing owner-approved PR #479 is diagnostic-only. Preserve the 12 November correction: contract crawling remains manual/on-demand, no daily contract-crawler cron; Robert Half stays manual-only and eTeam stays excluded pending a compliant official feed. This restack does not authorize live crawling, new portal permission, retries/backoff, scheduler changes, storage/classifier/retirement behavior, application submission or production-row mutation.

## Current master and production
- Canonical master: `794e8cfdbd3103409552857806bab89851d5bfcb`.
- Current collector on master: blob `f167d3751bb63fd54aa31abd34970dfcf75812d8`; the 600 ms default request pacing and hard-coded 25,000 ms local abort remain, with no portal-host timeout diagnostic or upstream-abort distinction.
- Vercel production: deployment `dpl_2tyBPso5SnCgHCPFCqXewExCJEYp`, READY, exact master SHA. The aliases `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` resolve to it. GitHub Vercel status SUCCESS.
- The deployed crawler remains manual/on-demand. No crawl was run in this audit; the last recorded crawl is still 10 November (20 portals, 6,818 found/upserted, one error).

## PR #479 source and tests
- Draft branch `safe-merge/crawler-abort-diagnostics-master-20261120-1455z`, prior head `e15f7dc5aa563a69c59c6d262ac913b71f171782`, base `13542c5e1127ed7c1ccf59e4faa034d0af021fc1`. It was stale/non-mergeable before this restack.
- Runtime change: `politeFetcher(gapMs, requestTimeoutMs)` keeps defaults (600 ms, 25,000 ms), records the URL host, differentiates its own timeout from an upstream `AbortError`, and parses the URL inside the `try/finally` cleanup/pacing boundary.
- Tests: one controlled local-timeout/upstream-abort test; one malformed-URL timer/pacing-cleanup test. No retry/backoff or other crawler behavior is added.
- Previous exact-head checks on `e15f7dc5...`: full CI `44805332914`, crawler regression `44805332916`, Plan/REA schema `44805332755`, Kompas baseline `44805332732`, and Vercel Preview Comments `136549636526` all SUCCESS. The actual Vercel commit status was **Canceled by Ignored Build Step**, so no protected preview was produced. These checks are not reused for a new restack head.

## Restack and verification
The restack preserves the old PR history and current master as merge parents, starts the tree from current master, and reapplies only the collector/test change plus updated additive Apply, research, Completion Watch, Plan Journal and REA evidence. It intentionally does not bump `PLAN_REVISION` or change `src/lib/plan-vision.ts`: product roadmap text is unchanged. The new exact head requires remote CI again.

Local execution is unavailable: the container has no checkout, and `git clone` failed with DNS resolution for `github.com`. No local tests/build, portal request, live crawl, data mutation, protected preview, production deployment or alias change is claimed.

## Next gates
1. Confirm the restack head and run full CI, crawler regression, Plan/REA schema and Kompas baseline on that exact SHA.
2. Keep PR #479 DRAFT and let the review gate sequence it; do not merge until review and the legitimate protected preview/release requirements are satisfied.
3. If later released, verify READY production plus canonical aliases and then request a separate explicit manual crawl acceptance. Never restore cron or call Robert Half without separate permission.
