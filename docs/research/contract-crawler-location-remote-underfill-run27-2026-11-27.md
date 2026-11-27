# Contract crawler location/remote underfill review — 27 November 2026 (run27)

## Finding

PR #605 current exact head `bc6c0879cfa2a83cf6ce7cfd7706c1bda646eeaf` scans one bounded ordered snapshot (up to 1,000 rows) for clearance filtering, but Apply still filters location and remote only on the client after the crawler response. The crawler request sends only `q`, `work_type`, and `limit`; the route does not receive the user's location or remote choice. A relevant job later in the index can be missed when the first 1,000 rows are filtered out, and `clearance_scan_limited` can remain false because it measures clearance filtering, not subsequent location/remote filtering.

Static review COMMENT `6091418603` (not approval) requests server-side location/remote filtering before the bounded limit or a bounded continuation strategy, plus a regression with 1,000 nonmatching rows and a later matching row and accurate scan-limit notice. No live crawl was run.

## Gates and status

All four exact-head PR gates SUCCESS: full CI `46028682703`, freshness/classification `46028682536`, manual-only `46028682513`, Kompas baseline `46028682704`. PR #605 remains DRAFT; protected preview, API smoke, live crawl and owner acceptance are missing. Known 60-second route/230-second runner duration mismatch remains documented.

## Next

Add test-first location/remote filtering before the bounded limit (or a bounded continuation), then exact CI, independent review, protected preview and safe live API smoke. No code was changed in this review.
