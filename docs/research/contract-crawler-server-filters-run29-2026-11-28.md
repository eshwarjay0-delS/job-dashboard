# Contract crawler server-side filters — clean restack Run 29 (28 Nov 2026)

## Owner-approved scope
Clean restack of #617's bounded clearance-safe contract crawler. Apply location tokens and remote-only filters in the crawler database query before the bounded snapshot, avoiding client-side filtering of the first 100 rows and underfill. The live aggregator lane keeps its equivalent filters. No portal crawl or application submission.

## Change
- Safe location tokenization remains capped at four.
- Extracted `applyCrawlerLocationFilters` so location AND tokens and remote-only compose as a testable query-builder behavior.
- Apply helper before the query's bounded scan; pass location and remote from Apply; stop post-filtering the indexed snapshot.
- Added behavior tests for AND composition, remote-only, no-location behavior, and bounded-snapshot underfill; retained source assertions for route placement.

## Prior evidence
PR #617 head `d3b4d899249e0b4cca282dedecf05f0fe8b354c2` passed six remote gates (full CI 46088479438, Plan/REA 46088479513, Kompas baseline 46088479463, crawler freshness/classification 46088479447, manual-only 46088479424, confirmed-skill 46088479478) but was stale/non-mergeable. Review noted the prior tests were source-text assertions only; the clean restack adds executable query-builder coverage.

## Validation boundary
No local canonical checkout/dependencies; exact-head remote gates pending. No protected preview/API smoke, live crawler request, portal call, DB write, application submission or deployment. Keep draft until exact-head CI/review passes and production authorization/evidence is available.
