# Contract crawler production freshness and public-source audit — 26 November 2026

## Scope

Read-only production/API and database verification plus official public ATS documentation review. No crawl was triggered, no portal was requested, and no database row was changed.

## Production evidence

- Canonical master is documentation-only `e2a94783041559c8c0c317f860ef1ba792de9fc9`.
- Both `job-dashboard-fawn.vercel.app` and `marketfit-app.vercel.app` resolve to READY production deployment `dpl_85tAXWKpsib5LKPh6LqZDiRhsYyW`, runtime SHA `a17b3267e271c77cd8887312445271b7fa172bd0`.
- `GET /api/health`: HTTP 200, `{"ok":true,"app":"MarketFit"}`.
- `GET /api/crawl/jobs?limit=5`: HTTP 200, empty `jobs`, default `work_type=contract`, `freshness_days=14`, `clearance=excluded`.
- `GET /api/jobs?q=cybersecurity&type=contract&limit=5`: HTTP 200, 15 results from the separate Jobright source. This does not prove the vendor crawler has fresh rows.

## Read-only Supabase aggregate

Project `ruajlrzmxzprmmngluxy`, table `public.mfit_crawl_jobs`:

- Exact row count: **14,566**; active: **12,407**.
- Active contract rows: **8,850**, but **0** active contract rows were seen within the API's 14-day freshness window.
- Latest `last_seen_at` across the table: **2026-11-10 11:01:11.191 UTC**.
- `public.mfit_crawl_runs`: **21** runs; latest started **2026-11-10 11:00:24.379 UTC**, finished **11:01:11.601 UTC**, found/upserted **6,818**, with one recorded error.

The zero-result contract endpoint is consistent with its freshness cutoff; the table is populated but stale. Do not weaken the cutoff to surface expired listings.

## Policy and unblocker

Owner correction from 12 Nov: crawler is **manual/on-demand only**; no daily cron. `POST /api/crawl/jobs` is admin-gated. No admin browser/session is available in this run, so a manual crawl was not triggered. The exact unblock is an owner/admin-authorized manual crawl. A schedule, crawler run, or data mutation must not be inferred from this audit.

## PR #590

Clean crawler-only restack head `1de4a3e493380f009d2b14dd35d0451f27392d51` has five exact-head checks SUCCESS: full CI, crawler freshness, manual-only, Kompas baseline, and Plan/REA schema (check-run IDs 139755342092, 139755342096, 139755341736, 139755349078, 139755341820). It remains DRAFT; protected preview and public API acceptance are missing. The reviewed source uses one ordered bounded snapshot, clearance filtering before the visible limit, and a scan-cap notice. Remaining source-level concerns: client location/remote filters can underfill after the 100-row API page; the POST route's 60-second duration is shorter than the runner's 230-second budget. No live crawl or portal request occurred.

## Public ATS-source reference review

- **Greenhouse:** official Job Board API GET `/v1/boards/{board_token}/jobs` returns published jobs; `content=true` adds descriptions. The documentation notes request rate limiting. Only application submission POST requires Basic Auth. Use public board tokens found on the vendor's own careers link, and do not submit applications.
- **Lever:** its Postings API is publicly accessible for published public postings; its XML-feed use case is also documented. Do not confuse the public Postings API with the authenticated Lever Data API or ingest internal/unlisted postings.
- **Ashby:** the public Job Postings API returns published board postings and compensation optionally. The returned `isListed` field matters; do not expose unlisted postings. Ashby separately documents an opt-in dedicated partner feed that is updated hourly.
- **Workable:** the open-jobs API requires a token with `r_jobs` access; the XML feed spans customers' published Jobs by Workable listings and is described as an advanced option. Do not use the broad feed without an appropriate permission/partner basis.

These are adapter candidates, not newly implemented or live-tested sources. Respect vendor terms, rate limits, published/listed visibility, attribution and manual-only cadence.

## Next approved work

1. Obtain owner/admin authorization and run the manual crawler once; verify run completion and fresh contract rows without enabling cron.
2. Keep PR #590 behind protected preview and public API smoke, then independent approval.
3. Fix server-side location/remote filtering and bounded pagination so eligible jobs are not lost behind the first 100 results.
4. Align the 60-second API route with the 230-second runner budget using supported hosting constraints, or split the work into a safe bounded job/ticket flow.

## Official sources

- Greenhouse Job Board API: https://docs.greenhouse.io/job-board
- Lever public Postings API: https://hire.lever.co/developer/documentation and https://hire.lever.co/developer/support
- Ashby public Job Postings API: https://developers.ashbyhq.com/docs/public-job-posting-api
- Ashby listed-only API guidance: https://developers.ashbyhq.com/reference/jobpostinglist
- Ashby partner feed: https://developers.ashbyhq.com/docs/dedicated-partner-job-feeds
- Workable API: https://help.workable.com/hc/en-us/articles/115013356548-Workable-API-Documentation
- Workable careers-page API: https://help.workable.com/hc/en-us/articles/115012771647-Using-the-Workable-API-to-create-a-careers-page
