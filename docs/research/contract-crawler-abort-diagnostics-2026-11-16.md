# Contract crawler abort diagnostics — current-master restack, 16 November 2026

## Scope and approval boundary

Continue the approved contract job search/crawler without changing its manual/on-demand policy. This change only improves diagnostics in the shared portal fetcher. It does not authorize a live crawl, new portal, source permission, automated retry, daily schedule, application submission, or production data mutation.

## Production evidence retained

The latest recorded production crawl remains the 10 November 2026 run (11:00:24–11:01:11 UTC): 20 portals, 6,818 jobs found/upserted, and one Inspyr error recorded as “This operation was aborted”. The generic error does not establish whether the local 25-second timeout fired or the upstream fetch implementation aborted. No new live request was made.

## Source change

- `politeFetcher(gapMs, requestTimeoutMs)` retains the existing 25,000 ms default.
- A local AbortController timeout reports the portal host and configured timeout.
- An upstream `AbortError` before the local signal fires is reported separately.
- URL parsing is inside the `try/finally` cleanup boundary so malformed adapter URLs still clear the timer and advance the request-pacing timestamp.
- No automatic retry, backoff, adapter, URL, classifier, freshness cutoff, clearance rule, schedule or storage behavior changes.

## Regression coverage

Mocked tests cover:
1. Local timeout attribution and host.
2. Upstream AbortError attribution.
3. Malformed URL cleanup and preservation of the pacing gap before a subsequent valid request.

The dedicated crawler freshness workflow now runs `scripts/tests/crawl-collect.test.mjs` when collector code or tests change, on both pull requests and master pushes.

## Current-master restack

- Base master at branch creation: `66291f677cbcc2318229ef9a3164961e6d3cdb6a`.
- Source was independently reviewed from predecessor PR #430, branch `fix/crawler-abort-diagnostics-current-master-20261116`, but only collector, test, workflow and Apply documentation changes are copied. No PR #428 WhatsApp files or behavior are included.
- New branch: `fix/crawler-abort-diagnostics-master-66291-20261116`, opened as draft PR [#434](https://github.com/eshwarjay0-delS/job-dashboard/pull/434) at initial head `e1d0401f372ce3410d7102bc87611c443d749f88`. Plan/REA evidence updates will advance the branch; all required workflows must be checked again on the final head.
- Workflow path filters were corrected in commit `9dfbab16b12de3aaf3b86345f8f20a8534616368` so collector changes trigger the suite on both pull requests and master pushes. The earlier workflow commit `936d8789da6126e5ac78d45e62518255d4b6df21` omitted the push-path entries; the corrected blob matches the reviewed predecessor workflow. The exact-head full CI, Kompas baseline, crawler workflow and Plan/REA schema checks must complete on the final PR head. The predecessor's focused tests are not a substitute.
- The Vercel project currently reports `live:false`; latest production attempt is CANCELED and the canonical alias remains on older READY SHA `b94e1629c544048d84a2b048ae83b21b612ab9dd`. Protected preview access requires the owner-controlled private `KOMPAS_VERCEL_API_TOKEN`. No deployment or protection bypass is attempted.

## Preserved source policy

- Contract crawling remains manual/on-demand only; no daily contract-crawler cron.
- Robert Half remains manual-only pending documented permission or a sanctioned feed/API.
- Right-to-Hire / Contract-to-Perm alias semantics remain unapproved.
- No live crawl, portal request, production database write, application submission, email or WhatsApp send occurred.

## Next

Run all exact-head checks on the new master-targeted PR, then let MFit Safe Merge Gate review it. Keep the PR DRAFT until required checks and legitimate preview/release gates are satisfied. After any approved release, verify READY deployment and canonical alias separately; post-release crawl acceptance requires a separate explicit manual request.


## 17 November 2026 — wire the existing manual-only policy regression

The repository already contains `scripts/tests/crawl-manual-only.test.mjs`. It checks that `vercel.json` has no `/api/crawl/run` cron, that the manual POST route checks `adminOf(req)` before importing/running the crawler, that the compatibility GET route validates its secret before importing/running the crawler, and that Robert Half remains in the pending/manual-only adapter list. This continuation does not duplicate or rewrite that test.

Workflow commit `c2e2e8aa84803eaef55635b913fc8b6bccafc8be` adds the existing test to both path filters and a dedicated execution step in `.github/workflows/crawl-freshness.yml`. The workflow retains `workflow_dispatch` and has no `schedule` trigger. `vercel.json` continues to contain other unrelated schedules (watchdog, Gmail and WhatsApp) but no `/api/crawl/*` contract-crawler cron. No schedule, adapter, route, portal permission, data or runtime behavior was changed.

The workflow/Plan/REA documentation commits advance PR #434 beyond predecessor head `73b00ddaa93d88d3914adc6fdba18407109c0b9a`; exact-head crawler workflow, full CI, Kompas baseline and Plan/REA checks must be rerun. The Vercel project remains `live:false`; no preview, deployment, live crawl or production mutation occurred.
