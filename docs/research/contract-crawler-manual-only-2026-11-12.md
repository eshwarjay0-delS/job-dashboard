# Contract crawler manual-only policy and current evidence — 12 November 2026

## Owner decision

The current PR #315 handoff records the owner's 12 November correction: **Right To Hire** and **Contract To Perm / Contract To Permanent** are C2H evidence; negated forms remain unknown; generic contract administration is not employment-type evidence. The same handoff confirms the earlier owner decision that contract-portal crawling is manual/on-demand only. Do not restore a daily contract-crawler cron.

## Current source audit

Canonical master at audit time: `cd70190e9903994a01c7c721641196a2b15027d4`.

- `vercel.json` contains no `/api/crawl/run` or `/api/crawl/jobs` cron.
- `/api/gmail/crawl` remains scheduled separately for Gmail synchronization; it is not the contract-portal crawler.
- `POST /api/crawl/jobs` checks `adminOf(req)` before calling `runCrawl()`, so the visible manual trigger is admin-only.
- `GET /api/crawl/run` remains secret-gated by `CRON_SECRET` or `WATCHDOG_CRON_SECRET`, but no Vercel cron currently points to it.
- External scheduler configuration was not available for inspection. Therefore this audit cannot prove that no external scheduler calls the secret-gated GET route. Do not claim complete manual-only enforcement until that caller inventory is checked.

## Read-only production evidence

Project `ruajlrzmxzprmmngluxy`; read-only SQL only:

| Measure | 12 Nov result |
|---|---:|
| Stored crawler rows | 14,566 |
| Active rows | 12,407 |
| Active rows seen within 14 days | 11,019 |
| Crawl-run records | 21 |
| Newest job `last_seen_at` | 10 Nov 2026 11:01:11 UTC |

Latest run: 10 Nov 2026 11:00:24–11:01:11 UTC; 20 portals; 6,818 found and upserted; one Inspyr operation aborted. No newer run was present in the table. This is not evidence of a fresh 12 Nov crawl. No crawl was triggered and no rows were changed.

The deployed 14-day freshness filter and default clearance exclusion remain in place. The active eTeam adapter was retired earlier; its stored rows were not deleted. Robert Half remains a manual directory link pending written permission or a sanctioned feed/API with explicit commercial-aggregation rights.

## Right To Hire / Contract To Perm correction

Current master `src/lib/contract-jobs.ts` does not yet recognize the shortened phrases `Right To Hire` or `Contract To Perm` as C2H. PR #315 carries the approved correction and regression cases, but remains DRAFT/unmerged:

- Exact head: `bd62bcd17b2b2be79c6ee23db19b8582a5225015`.
- Full CI: `43157849751` — SUCCESS.
- Crawler regression: `43157849909` — SUCCESS (8/8).
- Kompas baseline: `43157849768` — SUCCESS.
- Protected exact-head preview: `43157849584` — FAILED closed because the private `KOMPAS_VERCEL_API_TOKEN` is unavailable.
- The Safe Merge Gate also observed mergeability false.

Do not treat the classifier as merged or live. Do not rewrite existing production rows; classification changes affect records when a later authorized crawl sees them again.

## Release and acceptance boundary

Canonical production was independently READY at deployment `dpl_GE4WyYLKQWhRcCDQq11hfvHiaSke`, exact SHA `cd70190e9903994a01c7c721641196a2b15027d4`, alias `job-dashboard-fawn.vercel.app`. The public HTTP runtime could not be reached through the available web runtime, so this is deployment-control-plane evidence, not a public API smoke test.

No external crawl, database mutation, job application, email or WhatsApp message was sent. The current changes in this handoff are documentation, comments and a schedule-policy regression only.

## Next actions

1. Keep contract portal crawling manual/on-demand; do not restore a Vercel cron.
2. Inventory external scheduler/automation callers of the secret-gated `GET /api/crawl/run` route before claiming no scheduled caller exists.
3. Keep PR #315 DRAFT until the legitimate protected preview passes and mergeability/review gates are satisfied.
4. After an approved classifier release, verify the exact READY production SHA and alias, then wait for an explicitly authorized manual crawl before checking C2H classification on refreshed records.
5. Re-run the public `GET /api/crawl/jobs?limit=1` smoke when runtime HTTP access is available; require `freshness_days: 14` and default clearance exclusion.


## 12 November 2026 19:55 UTC — current-master recheck

Canonical master is `cd70190e9903994a01c7c721641196a2b15027d4`; production alias `job-dashboard-fawn.vercel.app` is READY at `dpl_GE4WyYLKQWhRcCDQq11hfvHiaSke`. PR #315 is restacked at `f5bc047871eaa4311d6a65366e5622cbd48dd02b`; full CI `43292788396`, crawler regression `43292788428` and baseline `43292788547` all pass. The protected preview remains unavailable, so the PR is DRAFT and the classifier is not live. No post-classifier crawl or production row rewrite was performed. The external scheduler inventory remains unknown; the repository itself has no crawler cron.
