# Contract crawler abort diagnostics — 15 November 2026

## Current production evidence

A read-only query against the production Supabase project found the latest recorded crawl:

- Run: `cf78f4bb-5f27-4476-b28f-3efa7156b231`
- Started: 10 November 2026, 11:00:24 UTC
- Finished: 10 November 2026, 11:01:11 UTC
- Portals: 20
- Jobs found/upserted: 6,818
- Error: Inspyr — `This operation was aborted`

The current `mfit_crawl_jobs` snapshot contains 14,566 rows, 12,407 active rows, and 10,509 active rows seen within the 14-day freshness window. The newest `last_seen_at` is 10 November 2026 11:01:11 UTC; the oldest is 21 October 2026 11:00:24 UTC. No later crawl run was present in this read-only snapshot. These are stored-row counts, not unique verified opportunities or a relevance score.

## Source finding

`src/lib/crawl/collect.ts` creates an `AbortController` for each portal request and aborts it after 25 seconds. Before this change, a locally triggered abort escaped as the generic fetch error text. `crawlEach` retained only the error message, so the run record could not distinguish a local request timeout from an upstream abort or identify the portal host from the message.

The observed Inspyr error does **not** prove that the local 25-second timer caused that historical event. No live request was made to reproduce it.

## Change in this branch

- `politeFetcher` keeps its 25-second default and accepts an optional timeout argument for deterministic tests.
- When its own signal aborts, it reports the portal host and timeout duration.
- A fetch implementation that reports `AbortError` before the local timer fires is labelled separately as an upstream abort.
- `scripts/tests/crawl-collect.test.mjs` adds mocked-fetch cases for both paths.
- `.github/workflows/crawl-freshness.yml` now runs the collector regression suite when the collector or its tests change.

No retry was added. No adapter, source URL, source permission, 14-day freshness rule, clearance filter, work-type classifier, production row, or crawl schedule was changed.

## Preserved owner policy and access boundary

- Contract crawling remains manual/on-demand only; `vercel.json` contains no `/api/crawl/run` cron.
- The normal manual trigger is `POST /api/crawl/jobs`, guarded by `adminOf(req)`.
- The compatibility `GET /api/crawl/run` remains secret-protected.
- No authenticated admin session or authorized trigger was available in this scheduled environment, so no crawl was started.
- Robert Half remains manual-only pending documented source rights.
- C2H/Right-to-Hire classifier semantics remain proposed until direct owner approval is recovered.

## Verification and release state

Canonical master at branch creation: `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`.

The active production alias `job-dashboard-fawn.vercel.app` independently resolves to READY deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, runtime SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. The GitHub Vercel success status for master points to deployment `dpl_5T8no96szcfy7YtRQQKxinCda8KH`, which is CANCELED by the Ignored Build Step; it is not the active production alias. This change is in draft PR [#422](https://github.com/eshwarjay0-delS/job-dashboard/pull/422), implementation commit `27cb0f80d055af2ccffec8c378f45ece33dac32e`. It is not deployed.

Exact-head full CI, crawler regression, Plan/REA schema, Kompas baseline, protected preview, production READY alias, and a later authorized manual crawl remain separate gates. No live crawl or production mutation is claimed.


## Safe Merge Gate review correction — 15 November 2026, 20:25 UTC

The review identified one behavior-preservation gap in the diagnostic change: `new URL(url).host` executed before the `try/finally`. A malformed adapter URL could therefore throw before the cleanup block updated the request-pacing timestamp.

The correction initializes the host to a safe placeholder and parses the URL inside `try`. The existing `finally` now always clears the abort timer and updates `last`, including malformed URLs. A deterministic regression fixes `Date.now`, observes the configured gap timer, forces an invalid URL, then verifies the following valid request waits the full gap.

- Source correction: `2cb87b22ea92c908d440107b072bdf0b760264b3`
- Regression test: `395f95f5105cb019b8f8ec2333c470294494dad8`
- Code-head crawler workflow: `43757961666` SUCCESS
- Code-head Kompas baseline: `43757961612` SUCCESS
- Code-head Plan/REA schema: `43757961637` SUCCESS
- Code-head full CI: `43757961686` IN PROGRESS at Lint when recorded; results on this head do not cover the later documentation commits.

The PR remains DRAFT. The current production alias is still READY at `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`; master is `8ad319d1092fffa7e6a31a4da1b4dc61ac634934`. No protected preview, production deployment, portal request, live crawl or production-row mutation occurred. The protected preview still requires the owner-controlled `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run.
