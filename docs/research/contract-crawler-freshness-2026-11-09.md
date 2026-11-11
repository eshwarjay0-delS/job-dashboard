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


The 10 Nov 11:00 UTC run was verified read-only in `mfit_crawl_runs`: 6,818 found/upserted, 20 portals, one Inspyr abort. It used old production SHA `a66c108bff6175149c4aadd882ab11128445b8cc`; the classifier merge `f7f322f242d39b12a0ade7c8d548f6f48eea79b5` remains blocked from production by Vercel build-rate-limit. Do not treat this as a post-change run.


## 10 November 2026 — restacked classifier CI and manual directory

The contract classifier from PR #276 is merged on master, but the live production alias still points to the earlier eTeam-retirement build. The 10 November 11:00 UTC crawl ran on production SHA `a66c108bff6175149c4aadd882ab11128445b8cc`: 20 portals, 6,818 found/upserted, eTeam absent, one Inspyr abort. This confirms the deployed eTeam retirement, not the later `contractTypes()` classifier.

The restacked branch `reconcile/crawler-ci-roberthalf-manual-20261110` (first commit `97e4f97d08bfa26d8fc0774532240a9a0d9beeb5`) adds `src/lib/crawl/classify.ts` and `scripts/tests/crawl-classify.test.mjs` to the dedicated workflow and executes both classifier and freshness suites. A directory regression pins the Robert Half Technology entry to the official cybersecurity search page while keeping it in `PENDING_PORTALS` and out of `ADAPTERS`.

Robert Half's official [cybersecurity search page](https://www.roberthalf.com/us/en/jobs/all/cyber-security) is a manual navigation link only. Its [Terms of Use](https://www.roberthalf.com/us/en/terms), last updated 23 September 2026, prohibit automated retrieval, indexing, scraping and data mining without express prior written consent. No adapter, scheduled request, scraping probe or listing import is authorized until written consent or a sanctioned feed/API with explicit commercial-aggregation permission is documented.

No runtime classifier code or stored rows are changed by this CI/manual-directory follow-up. Exact-head CI and merge review remain pending. Production acceptance requires READY on the exact merge SHA, the active canonical alias, public freshness/clearance API smoke, and a later completed crawl that uses the new classifier.


## 10 November 2026 — classifier production release verified

The canonical production deployment is now `dpl_HX7moNfuc9WAnYg7iah4zYQBWQvC`, READY at exact master SHA `864cb9e906543b006ea730a8de1fa3e65b652ab9`, target production. Independent alias lookup confirms `job-dashboard-fawn.vercel.app` resolves to that deployment. Git ancestry confirms this release includes the PR #276 `contractTypes()` classifier and PR #282 evidence-separated exported-DOCX gap report. This supersedes the earlier statement that the classifier was still blocked from production.

The 10 Nov 11:00 UTC crawl completed before the deployment on old SHA `a66c108`: 6,818 found/upserted across 20 portals, eTeam absent, one Inspyr abort. It is not post-classifier acceptance. The first expected post-release crawl is 11 Nov 11:00 UTC. The public API smoke could not be reached from this runtime; no HTTP behavior is claimed.

PR #284 restacks the CI/manual-directory follow-up from master `864cb9e`. Previous exact head `147a40e` passed crawler regression, Plan/REA schema, Kompas baseline and full CI, but this production-evidence documentation refresh changes the PR head and those gates must rerun. Its Vercel preview status is `build-rate-limit`; do not bypass quota or alias another deployment. Robert Half remains a manual navigation link only under Section 6 of its Terms of Use.

 
## 11 November 2026 — scheduled post-classifier crawl did not run (12:04 UTC)

The expected daily run at 11:00 UTC is absent from the production-linked `mfit_crawl_runs` table. The newest record remains 10 November 2026 11:00:24–11:01:11 UTC: 6,818 found/upserted across 20 portals, with one Inspyr abort. Grouped `mfit_crawl_jobs` observations remain on 10 November 11:01 UTC; no 11 November listing refresh is present.

The canonical master and alias metadata still agree on `11efbbfe7781592bc2fad1216f67546882a1c3ed` / deployment `dpl_7uEfjq1XprC48DoTFfFuiBoShPne`, but Vercel project inspection reports `live=false`. Public health and crawl endpoints have returned HTTP 402 `DEPLOYMENT_DISABLED`. The alias's READY metadata therefore does not establish an available cron runtime or successful API behavior. No crawl was manually triggered and no rows were inserted or rewritten.

**Next:** the Vercel owner/account must restore project availability. Then verify `GET /api/health`, `GET /api/crawl/jobs?limit=1`, and a subsequent completed scheduled crawl on the reviewed classifier SHA. Keep Robert Half manual-only. PR #288's clearance-safe pagination and PR #291's C2H extension remain unmerged and preview-blocked; their passing source suites are not production acceptance.


## 11 Nov 2026 — classifier precision review

A source review traced the contractTypes call sites. The jobs API passes full descriptions into the classifier, so a generic contract-token match can incorrectly classify permanent roles that mention contract administration, negotiation, compliance or lifecycle management. The crawler's work-type classifier also previously concatenated engagement and title, obscuring which value was the structured employment label.

PR #305 current head 278d9b3fa614c7e50aebf83b80ce9ac913724bf9 now passes engagement separately, trusts an explicit structured employmentType for generic Contract labels, and requires strong employment-context phrases in free text. It strips negated Contract, W2, C2C, 1099 and Temporary labels. Regression cases cover generic contract vocabulary, explicit contract positions, structured C2C/1099/Contract/Temporary, W2 payroll alone and negative statements.

Exact-head full CI 43096994492, crawler regression 43096994482 and Kompas baseline 43096994493 are queued. This is not merged or live. No manual crawl or database mutation occurred; the latest persisted crawl remains 10 Nov 11:00 UTC.

## 11 November 2026 — daily Apply crawl schedule gap and source repair

A read-only production audit at 22:15 UTC found that mfit_crawl_runs still had no 11 November run. Its newest row was 10 November 11:00:24.379466–11:01:11.601 UTC: 6,818 jobs found/upserted across 20 portals, with one Inspyr abort. No run row was inserted on 11 November. The 20 registered portal records remain visible in mfit_crawl_jobs; this audit did not rewrite them.

The missed 11 November run and the later configuration regression are separate facts. The parent 11efbbfe still registered /api/crawl/run at 0 11 * * *. Usage-pack commit 5a9e7f84ee1d6e6095f9701bec7cc0f27a31b05a removed that entry while retaining the watchdog, Gmail crawl and WhatsApp recovery schedules. That commit was made at 13:13 UTC, after the expected 11:00 UTC run, so the removal does not explain the already-missed 11 November run; it does mean future daily crawls are no longer scheduled from the current source.

The existing route remains GET /api/crawl/run, requires either a sufficiently long CRON_SECRET bearer or the timing-safe watchdog secret, refuses to run when the service client is unavailable, and delegates to runCrawl(). The production Vercel environment has a CRON_SECRET entry; its value was not decrypted or copied. No secret, manual endpoint invocation, crawl, or database write was used in this audit.

This branch restores exactly one /api/crawl/run cron at 0 11 * * * and adds a dedicated source regression for the schedule, preservation of the other three daily crons, fail-closed secret checks and service-client check. The crawler workflow now runs that test. It does not change the adapter registry, crawler classifier, freshness cutoff, row-retirement behavior, or any existing database record.

The 11 November Vercel project metadata still reports live=false; the production deployment metadata and alias are READY at master 65bdf2f8cf1dd7299b8623885641400efe57bbfe, but this run could not complete public HTTP smoke for /api/health or /api/crawl/jobs. The source fix is not a live crawl. Do not manually run it to manufacture acceptance. The next acceptance requires the project to be legitimately live, a READY production deployment with the restored schedule, a successful public jobs API smoke, and a later scheduled mfit_crawl_runs row recording the actual run.

The production aggregate still shows 76 Right To Hire plus 68 Right to Hire rows classified as unknown (144 total, 126 active, 120 fresh within 14 days). The separate precision classifier PR #305 is still unmerged at head 278d9b3fa614c7e50aebf83b80ce9ac913724bf9; its exact-head full CI, crawler regression and Kompas baseline remain queued. Do not label those rows contract-to-hire until that approved change passes and is deployed. Contract To Perm currently has 829 stored rows already classified as contract; the separate UI mapping remains distinct.

Official Vercel configuration reference: https://vercel.com/docs/project-configuration/vercel-json. The January 2026 Vercel changelog states that cron jobs now allow up to 100 entries per project on every plan: https://vercel.com/changelog/cron-jobs-now-support-100-per-project-on-every-plan. This restoration adds one daily entry; it does not increase the existing cadence or require a billing change.

Status: source change prepared; exact-head CI, merge, deployment, public HTTP smoke and next scheduled run remain pending. No production mutation or outbound message was performed.
