# Crawler adapter registry test correction — 16 November 2026

## Finding

A broad offline crawler regression run exposed two pre-existing failures: `scripts/tests/crawl-portals-3.test.mjs` on both canonical master `66291f677cbcc2318229ef9a3164961e6d3cdb6a` and current-master diagnostic PR #434 head `73b00ddaa93d88d3914adc6fdba18407109c0b9a`. The first test still required `eteam` in the active registry and called the registry thirteen portals; the second (`crawl-portals-4.test.mjs`) still asserted 21 active adapters. Both disagreed with the canonical source and Apply plan, which correctly describe 20 active adapters and keep eTeam pending/manual-only.

The eTeam endpoint `/searchjobs/api/jobs` returned HTTP 404 on 9 November 2026. Its current official careers page is interactive, and no compliant static public feed has been verified. The active registry intentionally omits eTeam; it remains a vendor-directory/manual link. Do not register it or use interactive scraping to satisfy a stale test.

## Change

- Replaced both stale registry counts with the exact 20-adapter active registry expectation.
- Explicitly asserts that eTeam is not active and remains in `PENDING_PORTALS` until a compliant official public feed is verified.
- Retains the source-safety scan over the eTeam module and the other newly added portal modules.
- Adds `src/lib/crawl/portals/**` and `scripts/tests/crawl-portals-*.test.mjs` to the dedicated crawler workflow path filters, and runs all portal registry/source-safety regressions in that workflow.
- No runtime crawler, source URL, adapter, freshness, classifier, clearance, pacing, retry, schedule, or database behavior changes.

## Validation

- Before correction, both stale assertions failed on master and PR #434: `AssertionError: eteam` and `20 !== 21`. They are pre-existing test/source-policy mismatches, not regressions introduced by #434.
- On 17 November 2026, the portal registry, collector, classifier and freshness suites passed together in the restored Node 22 sandbox: **31 passed, 0 failed**.
- `npm run check` exited 0: TypeScript passed; ESLint completed with existing warnings; autofill passed **133/133**; applications merge passed **15/15**.
- Plan Journal and REA schema regression passed **15/15**; `git diff --check` passed.
- No live crawl, external portal request, production-row mutation, application submission, email or WhatsApp send occurred.

## Follow-up state

The correction is a test/workflow/documentation follow-up stacked on PR #434. It remains a draft until exact-head GitHub CI and the dedicated crawler workflow complete, then MFit Safe Merge Gate must sequence it. PR #434 itself remains pending its legitimate protected preview. This test-only correction does not require a production deployment and does not authorize a live crawl or eTeam activation.
