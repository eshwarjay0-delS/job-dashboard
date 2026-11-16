# Contract crawler abort diagnostics — 16 November 2026

## Production symptom and limits

The latest available read-only production crawl record remains the 10 November 2026 run:

- Started: 11:00:24 UTC
- Finished: 11:01:11 UTC
- Portals: 20
- Jobs found/upserted: 6,818
- Recorded error: Inspyr — This operation was aborted

The production jobs snapshot previously recorded 14,566 rows, 12,407 active, and 10,509 active within the 14-day freshness window. These are stored-row counts, not verified unique opportunities or a quality score.

The shared fetcher already used a 25-second AbortController. Its generic error did not identify the portal host or distinguish the local timer from an upstream fetch implementation rejecting with AbortError. The historical Inspyr error is not attributed to the local timeout by this change; no live request was made.

## Implementation

This current-master restack carries the focused diagnostics from PR #422 onto the reviewed PR #428 base:

- politeFetcher(gapMs, requestTimeoutMs) retains the 25,000 ms default and allows a short injected timeout only for deterministic tests.
- A local signal abort reports the portal host and timeout duration.
- An upstream AbortError before the local signal fires is reported separately.
- URL parsing occurs inside the try/finally cleanup boundary. A malformed adapter URL still clears the timer and advances the request-pacing timestamp.
- The collector test suite covers local timeout, upstream abort and malformed-URL pacing.
- The dedicated crawler freshness workflow runs the collector suite when its source or test changes.

Source commits:
- 2e03d203a129a1f4c0d46d184452ac61e49fbfef — collector diagnostics.
- 2d83976507c19aa3ca2308e172ebca4fecb4eb8e — mocked regressions.
- 4666a5b3612fc5af9f17f5f6ab3a9a5f98776343 — workflow wiring.

## Preserved policy

- Contract crawling remains manual/on-demand only. No daily contract-crawler cron is restored.
- The admin-only POST /api/crawl/jobs and secret-protected manual compatibility route remain unchanged.
- Robert Half remains manual-only pending documented source rights or a sanctioned feed/API.
- C2H / Right-to-Hire alias semantics remain unapproved.
- No automatic retry, new portal, source URL, freshness cutoff, clearance rule, classifier, production row or stored job was changed.

## Branch, validation and release

- Canonical master at continuation start: 11f14891cfc07ba706043c78d1c9b7432d92aec0.
- Parent PR #428 reviewed head: 34008374c99daf07f96e7a2c8028883f5cfbf686.
- New branch: fix/crawler-abort-diagnostics-current-master-20261116, stacked on that reviewed head to avoid editing another contributor's branch or colliding with its shared Plan/REA work.
- The predecessor PR #422 head eab1dcde9cad2db0d4b5e6b92739fa802a8bc153 had full CI, crawler regression, Kompas baseline and Plan/REA schema success. Those results do not validate this restack.
- Exact-head GitHub Actions, Safe Merge Gate review, protected preview, merge, production READY deployment and canonical alias verification are still pending.
- The owner-controlled private KOMPAS_VERCEL_API_TOKEN required for the protected preview is unavailable to this run. No preview protection was bypassed.
- The scheduled environment has no local repository checkout or node_modules; no local test or build is claimed.

No live portal request, manual crawl, production database mutation, application submission, email or WhatsApp send occurred. The next gate is exact-head CI plus the dedicated crawler workflow, Kompas baseline and Plan/REA schema, followed by Safe Merge Gate review and the legitimate protected preview.