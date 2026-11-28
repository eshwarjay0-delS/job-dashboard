# Contract crawler location and remote filters — Run 32 restack (28 November 2026)

## Proposed scope — direct approval not recovered
The current continuation task prioritizes contract job search/crawler work, but scoped prior-context retrieval did not recover direct owner approval for the exact location-token AND / remote-only filter semantics. The implementation is a reviewable proposal only. It would apply filters to the indexed crawler lane before the bounded snapshot, rather than discard matches client-side after the first 100 rows. The live aggregator retains its equivalent filtering. This slice does not crawl portals, submit applications, or change manual-only policy.

## Current-master restack
- Canonical master at the restack base: `50e6eba7b75ddf28a67cf87a6895795e7c74c5e7`.
- Prior draft PR #636's five relevant files were identical to its base on current master, confirmed by exact content comparison. Only its five intended source/test files were transplanted.
- PR #651: https://github.com/eshwarjay0-delS/job-dashboard/pull/651
- Current code head: `ab07e6991fa99f4add672abb4476603c5efeb8f5`.

## Changes
- Location input is capped at 80 characters and normalized to at most four safe tokens.
- Location terms compose as AND filters and remote-only adds a remote-location filter before the bounded database query.
- Apply passes location/remote parameters to the indexed lane; indexed rows are no longer post-filtered after the bounded 100-row snapshot. The live aggregator is still filtered client-side.
- Tests cover helper composition, location-token bounds, remote-only with no location, bounded-snapshot underfill, and query-filter placement.

## Validation
Prior PR #636 checks are predecessor evidence only. Exact-head checks for #651 are pending at this checkpoint. This automation has GitHub remote access but no compliant local checkout, installed dependencies or Next.js 16.3.8 docs; no local test/build was run.

## Release and acceptance
No protected preview, public API smoke, live crawl, portal request, Supabase mutation, application submission or deployment was performed. Preserve manual/on-demand only, 600 ms pacing, 25-second request timeout, freshness/clearance/scan bounds, Robert Half manual-only and eTeam excluded. Require direct owner confirmation of the exact filter semantics, exact-head CI, independent review, protected preview, production READY plus canonical alias, and public API smoke before release. Real search acceptance remains separate from unit tests.
