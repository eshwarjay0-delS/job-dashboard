# Contract crawler timeout/abort diagnostics — current-master restack (23 November 2026)

## Approved scope

Diagnostic-only collector correction. Preserve the 600 ms request pacing and 25,000 ms default timeout. Distinguish local AbortController timeout from an upstream AbortError with portal-host diagnostics. Keep URL parsing inside try/finally so malformed adapter URLs still advance pacing. The optional timeout parameter is deterministic-test support only. No scheduler, cron, portal adapter, feed, live crawl, or production row changes.

## Restack

PR #551 was cleanly restacked onto canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`. Source/test commit `49349feb2d698a0b66f807040786fd357c702bf6` includes only `src/lib/crawl/collect.ts` and `scripts/tests/crawl-collect.test.mjs`. The stale branch's behavior-neutral `prefer-const` fix and four Kompas VM fixture edits are excluded and remain in separate #550/#554 work. No changes to the live scheduler or adapters.

## Tests and blocker

The two added synthetic cases distinguish a local timeout from an upstream abort and verify that a malformed URL still advances pacing. The prior #551 head `c19fe4a7aa381bbbea3f1575357c9c2b8741d4b9` passed crawler freshness `45145980857`, Kompas baseline `45145980895`, and Plan/REA `45145980912`; full CI `45145980892` failed on 24 unrelated `answerCtl is not defined` Kompas fixture errors. The clean current-master head still requires exact-head checks. Current master also contains the known `prefer-const` lint issue at `src/lib/kompasConsistency.ts:1059`; this PR intentionally does not duplicate that unrelated fix. No local checkout/dependencies are available, so local execution is not claimed.

## Production limits and next steps

No production deployment, live crawl, portal request, production database mutation, application submission, cron or device test occurred. Crawling remains manual/on-demand; Robert Half remains manual-only and eTeam excluded pending compliant official feeds. Keep PR #551 DRAFT. Run exact-head crawler freshness, full CI, Kompas baseline and Plan/REA; resolve shared blockers through their existing PRs, then review, protected preview, production READY/alias and separately authorized manual crawl.
