# Contract crawler timeout/abort diagnostics — Run 30 (28 November 2026)

## Approved scope
Owner-approved manual/on-demand contract crawler reliability. Keep the 600 ms request pacing and 25,000 ms default request timeout. Distinguish a local timeout from upstream AbortError with portal-host diagnostics; ensure URL parsing/cleanup updates pacing even for malformed URLs; propagate portal cancellation to cooperative work and storage queries. No scheduler, cron, portal adapter/feed, live crawl or job submission.

## Implementation
- Collector adds abort-aware pacing, request timeout and portal cancellation; identifies local timeout, portal time-limit cancellation and upstream AbortError separately.
- URL parsing stays inside the cleanup boundary, and the per-portal pacing timestamp advances in finally.
- crawlEach passes an AbortSignal, aborts on the portal deadline and waits for cooperative work to settle before releasing its worker slot.
- Runner passes the signal into fetch, Supabase upsert and stale-job retirement, checking cancellation before writes.
- Focused collector and runner tests exercise timeout cancellation, non-overlap, host diagnostics, malformed URL pacing and signal forwarding.

## Restack
The prior PR #569 was stacked behind unmerged Kompas PR #554, preventing canonical full CI. This current branch is based on production master fefaaf1 and contains only the collector/runner changes, focused tests, and evidence records. Exact-head gates are pending.

## Constraints and acceptance
Manual/on-demand only; no daily crawler cron. Robert Half remains manual-only; eTeam excluded pending a compliant official feed. Clearance exclusions, freshness, pacing, scan limits and existing portal policy are preserved. No local clone/test (DNS resolution for github.com failed), protected preview, live crawl, portal request, Supabase mutation, production deploy, or application submission occurred. Require exact-head full CI, crawler freshness/classification, manual-only, Kompas baseline, Plan/REA, protected preview and production READY+canonical alias. Only then perform a separately authorized manual crawl.
