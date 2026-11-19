# Contract crawler diagnostics and manual-only acceptance — 18 November 2026

## Owner-approved scope and exclusions

The contract job-search product remains W2/C2C/1099/C2H-focused, with crawler execution **manual/on-demand only**. The owner correction on 12 November removed the daily contract-crawler cron. Do not restore it. Robert Half remains a manual navigation link only pending express written permission or a sanctioned feed/API with commercial-aggregation rights. Right-to-Hire / Contract-to-Perm alias semantics remain unapproved.

## Current source candidate

PR [#434](https://github.com/eshwarjay0-delS/job-dashboard/pull/434), exact head `63e1f3a238f4768b29d245a9b361f27fcaf4c07e`, changes the shared portal fetcher to distinguish local AbortController timeout from upstream AbortError, report the portal host and preserve request pacing after malformed URLs.

Exact-head checks:
- Full CI 44174855613 — SUCCESS.
- Crawler regression 44174855597 — SUCCESS.
- Kompas baseline 44174855660 — SUCCESS.
- Plan/REA schema 44174855645 — SUCCESS.

PR #434 remains DRAFT pending Safe Merge Gate review and legitimate protected preview. These are source tests, not a live crawl.

## Read-only production snapshot

An aggregate-only SELECT on 18 November returned:
- Stored jobs: 14,566.
- Active jobs: 12,407.
- Active jobs seen in the preceding 14 days: 9,550.
- Crawl runs: 21.
- Latest completed run: 10 November 2026 11:00:24.379466–11:01:11.601 UTC.
- Latest run portals: 20; jobs found/upserted: 6,818; recorded errors: 1.
- Latest job-seen timestamp: 10 November 2026 11:01:11.191 UTC.

No job descriptions, user records or portal content were read. No live crawl, portal request, database write or application submission occurred.

## Deployment state

The Vercel project reports `live:false`. Its latest production deployment, `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6`, was CANCELED because the Ignored Build Step printed `Skipped: no [ship] tag` and exited 0. This is not an application build failure and does not prove the project is paused. The canonical alias `job-dashboard-fawn.vercel.app` remains READY on older SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. Protected preview requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`, unavailable to this run.

## Required acceptance

1. Keep the crawler manual/on-demand only; do not add a daily cron.
2. Keep Robert Half manual-only and C2H/Right-to-Hire aliases unapproved until evidence and owner approval exist.
3. Obtain legitimate protected-preview access and Safe Merge Gate review for PR #434.
4. After a reviewed release, verify exact READY production SHA, canonical alias, public freshness/clearance API behavior and a later manually authorized crawl.
5. Never treat unit tests or a stale aggregate as proof of a live crawl.

No deployment, scheduler change, live crawl, portal request, job application, email or WhatsApp send occurred.
