# Contract crawler freshness and eTeam source retirement — 9 November 2026

## Decision

Continue the approved contract-only Apply crawler, but do not keep calling a source that has failed and do not let stale records remain searchable indefinitely. The repair is deliberately non-destructive: it removes eTeam from the active fetch registry, preserves its directory link and existing rows, and applies the same 14-day freshness window already used by the crawler's retirement logic.

## Production evidence before this branch

- Canonical repository: `eshwarjay0-delS/job-dashboard`.
- Production master before this change: `eb37c4566f6d9c1d4b4d988096a2a44066255636`.
- Public alias `https://job-dashboard-fawn.vercel.app` was independently READY on that exact SHA at deployment `dpl_AJ1LuN2YDfv5kY4dFHMiCxXqmmYd`. This is the pre-change deployment, not proof that this branch is live.
- Read-only production query on 9 November 2026: `mfit_crawl_jobs` contained 14,164 rows; `mfit_crawl_runs` contained 20 records.
- The 9 November 11:00 UTC crawl found and upserted 6,976 jobs across 21 registered portals. Its only recorded error was `eteam: HTTP 404 from www.eteaminc.com`.
- eTeam had 907 stored rows, 818 still marked active, with its newest `last_seen_at` at 2026-11-08 11:01:01 UTC. The other active portal records had been refreshed during the 9 November run.

## Source investigation

- The registered eTeam adapter called `https://www.eteaminc.com/searchjobs/api/jobs?instance=US&limit=200&page=...`. The production crawl recorded HTTP 404 from the host on 9 November.
- The current official eTeam destination is `https://www.eteaminc.com/careers`. Its careers experience is interactive; this run did not verify a public static feed or an authorized endpoint. Do not guess a replacement API or add headless/browser automation without evidence and a separate review.
- The vendor directory keeps eTeam as a manual link. Its former parser remains only as historical fixture coverage and is no longer registered for production crawling.
- Robert Half's official cybersecurity search at `https://www.roberthalf.com/us/en/jobs/all/cyber-security` exposes contract/temporary results and is a promising next adapter. It remains pending until the actual response structure is captured and tested; no adapter is claimed by this change.

## Implementation in this branch

1. Remove eTeam from `ADAPTERS`; add it to `PENDING_PORTALS`. Keep the official careers URL in `vendorPortals.ts`.
2. Add `crawlFreshnessCutoff()` and a fixed `CRAWL_FRESHNESS_DAYS = 14` to `src/lib/crawl/search.ts`.
3. Add `.gte("last_seen_at", crawlFreshnessCutoff())` to `GET /api/crawl/jobs`, and return `freshness_days: 14`. This matches the 14-day unseen retirement window in `src/lib/crawl/runner.ts`.
4. Add deterministic tests for the cutoff, API wiring, and eTeam registry/directory state. A dedicated GitHub Actions workflow runs them without credentials or external side effects.
5. Update Apply Plan & Vision and the REA record. The concurrent Kompas Safe Merge Gate PR is editing `src/lib/plan-vision-journal.ts`; this branch intentionally does not edit that file.

## Data-safety and behavior

- No database rows are deleted, rewritten, or reassigned.
- Existing eTeam records remain stored. Because they were last seen on 8 November, they may remain visible until they age beyond 14 days; after that, the search API excludes them even if the source stays unavailable.
- The new freshness cutoff applies to all crawler search results, including `work_type=all`, while contract-only remains the default and the existing clearance exclusion remains unchanged.
- A failed or empty portal response still does not trigger bulk retirement. The runner's existing nonzero-result guard is unchanged.
- No real email, WhatsApp, job application, or external submission was sent.

## Acceptance and release gate

Status at branch creation: **built on branch; CI and deployment pending**.

1. Run the new `Crawler freshness regression` workflow and the repository's full CI on the exact PR head.
2. Review the diff and merge only if both are green and the PR remains conflict-free.
3. Verify a READY production deployment for the exact merge SHA and independently verify `job-dashboard-fawn.vercel.app` points to it.
4. Smoke-test `GET /api/crawl/jobs?limit=1` and confirm the response includes `freshness_days: 14`.
5. Confirm the next scheduled crawl lists 20 active adapters and no longer calls eTeam. Do not claim this until a completed run records it.
6. Only then consider a separate Robert Half adapter PR after a live HTML/feed capture passes.

## Exact blockers

- This environment could read GitHub and the production-linked Supabase database but could not create a Vercel sandbox or access runtime logs through the Vercel API (403). No local repository execution was available; the branch workflow and GitHub CI are the executable test path.
- The original 17 October 17:28 Chicago WhatsApp screenshot, source resume, JD and generated DOCX were not retrieved by the accessible conversation/Library search. This crawler work does not resolve or claim to reproduce that WhatsApp incident.


## 10 November release update — supersedes the branch-creation pending status

PR #266 merged as `30bd971c97937b9dea8716b945fa3b1219b07544` from exact head `2a88796c3cb5f2955655701f203abd2fc15605b2`. Full CI `42735808768`, Crawler freshness regression `42735808764`, and Kompas baseline `42735808778` all completed SUCCESS. Production deployment `dpl_AUuJFms4osu6TPYg768Ydy5ABhCT` is READY at the merge SHA. The current canonical production alias is READY at descendant `23ec076b944519e518060f14e2ce530238e8393a`, deployment `dpl_3wb2CbvvzZ98nqK7QgvnHmjXNwUc`, and includes the crawler change.

Read-only production snapshot after release: 14,164 stored rows; 12,353 active; 12,170 active within 14 days; 183 active rows older than 14 days. eTeam remains 907 stored/818 active rows with latest last_seen 8 Nov; they are preserved and will age out under the 14-day API filter if not refreshed. The current source registry contains 20 active adapters and 10 pending/manual-only sources.

The 9 Nov 11:00 UTC crawl is still the latest completed run, and it occurred before PR #266: 6,976 jobs found/upserted across 21 adapters with one eTeam HTTP 404. The first post-change scheduled crawl has not completed, so no claim is made that eTeam was skipped by a live run. The public API smoke also remains pending because external DNS resolution failed in this execution environment. The next checks are the first scheduled post-change crawl and `GET /api/crawl/jobs?limit=1` when HTTP access is available. Robert Half remains a separate pending adapter after its official feed/HTML is captured and tested.


## 10 November 2026 — work-type classification audit

The public Apply contract is explicit: W2, C2C, 1099 and C2H are contract shapes; W2 payroll alone is not proof of a contract. The crawler's previous `classifyWorkType()` used `/temp/i` (a substring) and did not recognize the standalone `C2H` shorthand, even though `contractTypes()` already implemented the canonical evidence taxonomy.

The fix delegates work-type classification to `contractTypes()`, then classifies permanent/direct-hire/full-time evidence separately. Regression cases cover C2H, C2C, 1099, temporary, temp-to-hire, contract-to-hire, W2 contract, W2-only, generic `template`/`attempt` substrings and explicit permanent-vs-contract precedence.

Read-only production aggregate before this change: 10,152 contract rows (8,814 active), 1,034 permanent rows (930 active), 2,978 unknown rows (2,609 active). No existing row with a standalone C2H token was misclassified out of contract; the one title matching `template` was correctly a contract because its engagement field explicitly said `Contract`. No production rows were updated. This is a source/test change only; existing rows are reclassified when a future crawl sees them again.

The daily Vercel cron is `0 11 * * *` (11:00 UTC; 05:00 CST on 10 Nov). The latest completed crawl remains the pre-change 9 Nov 11:00 UTC run. The first post-change run is still pending. Public GET smoke remains blocked by DNS resolution in this environment. Robert Half remains pending: the official cybersecurity page shows 53 results across two pages, but raw HTML is unavailable and its listed role-details sitemap returned HTTP 403; no adapter was added.


## 10 November 2026 — classifier CI and production handoff

### Change

The current master classifier delegates work-type evidence to Apply's shared `contractTypes()` taxonomy. The existing crawler-specific workflow previously watched freshness/search/adapters but did not watch `src/lib/crawl/classify.ts` or execute `scripts/tests/crawl-classify.test.mjs`. The follow-up adds both paths to the PR/push filters and runs the existing three-case classifier suite in the same workflow. No runtime classifier code or stored job row is changed by this CI follow-up.

### Exact local verification

- Current master: `f7f322f242d39b12a0ade7c8d548f6f48eea79b5`.
- `node --test scripts/tests/crawl-classify.test.mjs`: 3 passed, 0 failed.
- Resume/confirmed-experience/WhatsApp regression group: 115 passed, 0 failed.
- `npm run typecheck`: exit 0.
- `npm run check`: exit 0; existing ESLint warnings were emitted and not suppressed.
- `npm run build`: exit 0; Next.js reported 10 existing dynamic-filesystem tracing warnings. This is a local sandbox build, not a Vercel deployment.

### Production evidence and release boundary

- `job-dashboard-fawn.vercel.app` independently resolves to READY production deployment `dpl_7gjdfRFeLjqcPdVC52NkaEatugKA`, source SHA `a66c108bff6175149c4aadd882ab11128445b8cc`.
- Master is exactly one commit ahead of that deployment: `f7f322f242d39b12a0ade7c8d548f6f48eea79b5`.
- GitHub's Vercel status for current master is FAILURE with `build-rate-limit`. No new production deployment was attempted and no quota/billing bypass was used.
- Public production `GET /api/health` returned 200. `GET /api/crawl/jobs?limit=1` returned 200 with `freshness_days=14`, `clearance=excluded`, and one excluded clearance result in the response metadata.
- Read-only production database shows the latest completed crawl is still 9 November 2026 11:00 UTC: 21 portals, 6,976 found/upserted, one eTeam HTTP 404. That run predates the deployed eTeam retirement. The first post-change scheduled run for 10 November 11:00 UTC was not yet present at this check.

### Next acceptance

1. Let the scheduled 10 November 11:00 UTC crawl finish; verify the run uses the 20-active-adapter registry, does not call eTeam, and records its per-adapter errors and counts.
2. Verify the public jobs API still applies the 14-day cutoff and excludes clearance-required roles.
3. When Vercel's build-rate limit clears, deploy the latest reviewed master, require READY and exact alias SHA, then recheck the classifier behavior against a fresh crawl. Do not claim the current classifier is live before that.
4. Keep Robert Half manual-only until its official feed or permitted HTML can be captured and tested; no adapter was guessed or added.


## 10 November 2026 — post-change crawl and Robert Half permission boundary

### Post-change production run

A read-only query of the production-linked MFit database found the 10 November scheduled run:

- Run ID: `cf78f4bb-5f27-4476-b28f-3efa7156b231`.
- Started `2026-11-10 11:00:24 UTC`; finished `11:01:11 UTC`.
- 20 registered portals; eTeam is absent from the recorded portal list.
- 6,818 jobs found and 6,818 upserted.
- One isolated error: Inspyr returned `This operation was aborted`.

This confirms the deployed eTeam retirement/20-adapter registry. It does not validate the newer work-type classifier on master: the run executed from production SHA `a66c108bff6175149c4aadd882ab11128445b8cc`, while current master is `f7f322f242d39b12a0ade7c8d548f6f48eea79b5`. The master Vercel status is still `build-rate-limit`; no deployment was attempted. A read-only post-run work-type snapshot was contract 10,444 total / 8,850 active, permanent 1,072 / 945, unknown 3,050 / 2,612; these are existing production-classifier counts, not acceptance evidence for the master classifier fix.

### Robert Half — public reference and terms review

The official [cybersecurity search page](https://www.roberthalf.com/us/en/jobs/all/cyber-security) currently reports 53 results and exposes page 2 through `?pagenumber=2`. Parsed job cards expose title, location, worksite, employment type, pay range, description and posted date. One opened detail page showed a card marked `onsite` while the detail text described the opportunity as fully remote; a future authorized adapter must preserve this discrepancy rather than infer a worksite from one field.

The official [Terms of Use](https://www.roberthalf.com/us/en/terms), last updated 23 September 2026, state in Section 6 that robots, spiders, site-search/retrieval applications and other manual or automatic devices may not retrieve, index, scrape, data-mine or otherwise gather Site content without Robert Half's express prior written consent. Section 3 also limits the site license to personal/non-commercial use or doing business with Robert Half. This product is a commercial aggregator, so a public page or search-engine result is not permission to ingest it.

**Decision:** no Robert Half adapter, scheduled request, stored listing import or scraping probe is authorized by the current evidence. Keep the vendor directory link manual-only until express written consent or a sanctioned feed/API with explicit commercial-aggregation permission is obtained. Continue the existing permitted adapters; do not guess a hidden endpoint or use a third-party scraper.

### Remaining crawler acceptance

- The deployed 20-adapter/eTeam change has a successful scheduled-run record.
- Recheck `GET /api/crawl/jobs?limit=1` and its 14-day/clearance behavior when runtime HTTP access is available; this turn could not independently fetch the public endpoint.
- Deploy the reviewed master classifier change only after Vercel's build-rate limit clears; then confirm the alias SHA and run a fresh crawl before claiming C2H/W2/sub-string classification is live.


### Manual directory link (no ingestion)

The existing `Robert Half Technology` entry in `src/lib/vendorPortals.ts` now points to the official cybersecurity search page instead of the generic jobs landing page. It is still listed in `PENDING_PORTALS`, not `ADAPTERS`. The directory note tells users the page mixes contract and permanent roles and must be filtered manually. A source regression asserts the URL, manual-only note, and absence from the active adapter registry. This is a navigation improvement only; no Robert Half request is made by the crawler.
