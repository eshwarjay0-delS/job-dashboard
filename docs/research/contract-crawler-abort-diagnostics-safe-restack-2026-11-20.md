# Contract crawler abort diagnostics — safe current-master restack (20 November 2026)

## Scope and approval boundary
This additive restack ports the approved diagnostic-only collector correction from draft PR #470. It does not authorize a live crawl, a new portal, new source permissions, retries/backoff, classifier/freshness changes, a schedule, application submission or production data mutation.

The existing owner correction remains authoritative: crawling is manual/on-demand only, no daily contract-crawler cron; Robert Half remains manual-only; eTeam remains excluded until a compliant official feed is verified.

## Base and branch preservation
- Current canonical master: `2da44026c0ab58ab2966b9371992efaf93427de4`.
- Safe branch: `fix/crawler-abort-diagnostics-safe-restack-20261120-1136z`.
- Original draft PR #470: https://github.com/eshwarjay0-delS/job-dashboard/pull/470 — head `26fbb95738e370482bd2914f9ec3061d21007423` preserved untouched.
- GitHub reported #470 non-mergeable against its older base. The source and test comparison confirmed the source change was limited to `politeFetcher`, and the regression tests were appended; current-master source/test files were preserved.
- This safe restack does not edit or overwrite the original PR branch.

## Source and regression
- `politeFetcher` retains the 600 ms default gap and 25,000 ms timeout; a second timeout argument enables short deterministic tests.
- Local AbortController timeout is distinguished from an upstream AbortError and attributed to the portal host.
- URL parsing remains inside try/finally so malformed URLs clear the timer and advance pacing.
- Tests cover local timeout, upstream abort, and malformed URL cleanup/pacing.
- No new workflow is required: current CI already runs `scripts/tests/crawl-collect.test.mjs`.

Original PR #470 exact-head checks succeeded: Full CI, crawler freshness/collector regression, Plan/REA and Kompas baseline. They are not reused for this safe branch; all four must rerun on the exact final safe-branch SHA. No local test execution is available.

## Release boundary
No production deployment or live crawl. The PR is draft pending Safe Merge Gate review and the protected-preview path. The protected Vercel sandbox path is currently unavailable (Hobby usage limit / HTTP 402; reported reset 1 Dec 2026). Do not unpause, bypass protection, change billing, add a ship marker, restore a cron or run a crawl. After an authorized release, post-release crawl acceptance still requires a separate explicit manual request.
