# Contract crawler C2H alias approval-boundary correction — 17 November 2026

## Owner decision and historical correction

The latest explicit owner correction on 15 November supersedes the earlier 14 November assistant-authored status that had described these aliases as approved. Right To Hire → C2H and Contract To Perm / Contract To Permanent → C2H are **not approved**. The 14 November wording is retained as historical context only; it is not authority to ship the mappings. The broader contract taxonomy remains separate: explicit C2H and Contract-to-Hire labels remain recognized.

Sources:
- Canonical PR #419 records the 15 November correction and keeps the proposed aliases DRAFT: https://github.com/eshwarjay0-delS/job-dashboard/pull/419
- PR #402 records that the purported 12 November approval could not be recovered from an owner-authored message and that its classifier behavior is proposed, not approved: https://github.com/eshwarjay0-delS/job-dashboard/pull/402
- Current-master owner-approval provenance: `docs/research/owner-approval-provenance-2026-11-13.md`
- Current-master product plan: `src/lib/plan-vision.ts`

## Source audit

At canonical master `66291f677cbcc2318229ef9a3164961e6d3cdb6a`:

- `src/lib/contract-jobs.ts` included `contract-to-permanent` in the C2H expression. This incorrectly promoted the explicit phrase **Contract To Permanent** to C2H.
- `src/lib/crawl/portals/pyramid.ts` converted `right-to-hire` in the source description into the normalized engagement `Contract to Hire`. That then caused `classifyWorkType` to include it in contract-only results as C2H.
- The Inspyr, Genesis10 and Mitchell Martin adapters already preserved their Right To Hire source label rather than normalizing it to C2H.
- `vercel.json` has no `/api/crawl/run` contract-crawler cron. `POST /api/crawl/jobs` is admin-only and manual/on-demand. The separate `/api/gmail/crawl` schedule is not the contract crawler. Robert Half remains a manual directory source, not an adapter.

## Correction on branch `fix/crawler-unapproved-c2h-aliases-20261117-run11`

- Removed `contract-to-permanent` from the C2H alias expression. The words still contain explicit generic Contract evidence, so Contract To Perm / Contract To Permanent remain generic Contract, not C2H.
- Pyramid now preserves **Right To Hire** as its source engagement label. Since that phrase alone is not an approved contract/C2H alias, the work type is unknown and it is not promoted into the default contract-only search.
- Explicit `C2H` and `Contract-to-hire` remain C2H.
- No changes to W2, C2C, 1099, Temporary, Permanent, clearance filtering, the contract-crawl schedule, Robert Half, eTeam or any portal request behavior.

Code commits:
- `686eb81d5db2c23a2ff3ee3edd8c4eabbd7de7f2` — remove Contract To Permanent → C2H
- `1f148e08d8d31e696056edf6825a01be24730bed` — preserve Pyramid Right To Hire source label
- `c2e57a5597dbcae768e80ba3129a77bfd36cf852` — regression tests

## Validation evidence

A Vercel Node 22 sandbox cloned exact master `66291f6`; `npm ci --ignore-scripts` completed.

- `node --test scripts/tests/crawl-classify.test.mjs`: **6/6 PASS**, including the two unapproved alias boundaries and preservation of explicit C2H / Contract-to-Hire.
- `node --experimental-strip-types --test scripts/tests/crawl-freshness.test.mjs`: **5/5 PASS**.
- `node --experimental-strip-types --test scripts/tests/crawl-classify.test.mjs`: **6/6 PASS**.
- `node --test scripts/tests/hobby-usage-pack.test.mjs scripts/tests/crawl-manual-only.test.mjs`: **8/8 PASS**; confirms no contract-crawl cron and Robert Half manual-only.
- `npm run typecheck`: PASS.
- ESLint on `src/lib/contract-jobs.ts`, `src/lib/crawl/portals/pyramid.ts`, and `src/lib/crawl/classify.ts`: PASS.
- The broader exploratory `node --test scripts/tests/crawl-*.test.mjs` run was **54/56**: two existing unrelated registry assertions fail on current master (`crawl-portals-3` still expects an eTeam source shape that is absent, and `crawl-portals-4` expects 21 adapters while the current registry has 20). Those tests were not weakened or changed. The focused supported workflow tests above passed.

## Deployment and operational limits

- This is an unmerged draft branch. GitHub exact-head workflows still need to run after the Plan/REA documentation updates.
- Vercel project `job-dashboard` currently reports `live:false`; latest production deployment `dpl_GMD7eF8vAw52sXyTopSuHqebEJq6` is CANCELED. The canonical alias `job-dashboard-fawn.vercel.app` remains READY on older deployment `dpl_7QVykeYoWSswLDgsQP99xF2piBn3`, SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. Do not unpause the project, bypass protected preview, change billing or claim the correction is live.
- Read-only production data: 14,566 crawl-job rows and 21 run rows; latest run finished 10 November 2026 11:01:11 UTC, with 6,818 jobs found/upserted across 20 portals and one recorded error. This is stale inventory, not a fresh crawl.
- No live portal request/crawl, production-row mutation, application submission, Gmail call, WhatsApp send or production deployment occurred.

## Next

Run full CI, crawler freshness, manual-only, Plan/REA schema and Kompas baseline on the final PR head. Keep DRAFT until the MFit Safe Merge Gate has sequenced shared Plan/REA edits and a legitimate protected preview is available. Do not run a live crawl or enable a schedule as part of this correction.