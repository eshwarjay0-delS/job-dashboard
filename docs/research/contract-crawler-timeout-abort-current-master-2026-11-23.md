# Contract crawler timeout/abort diagnostics — current-master restack (23 November 2026)

## Approved scope

Diagnostic-only collector correction. Preserve the 600 ms request pacing and 25,000 ms default timeout. Distinguish local AbortController timeout from an upstream AbortError with portal-host diagnostics. Keep URL parsing inside try/finally so malformed adapter URLs still advance pacing. The optional timeout parameter is deterministic-test support only. No scheduler, cron, portal adapter, feed, live crawl, or production row changes.

## Restack

PR #551 was cleanly restacked onto canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`. Source/test commit `49349feb2d698a0b66f807040786fd357c702bf6` includes only `src/lib/crawl/collect.ts` and `scripts/tests/crawl-collect.test.mjs`. The stale branch's behavior-neutral `prefer-const` fix and four Kompas VM fixture edits are excluded and remain in separate #550/#554 work. No changes to the live scheduler or adapters.

## Tests and blocker

The two added synthetic cases distinguish a local timeout from an upstream abort and verify that a malformed URL still advances pacing. The prior #551 head `c19fe4a7aa381bbbea3f1575357c9c2b8741d4b9` passed crawler freshness `45145980857`, Kompas baseline `45145980895`, and Plan/REA `45145980912`; full CI `45145980892` failed on 24 unrelated `answerCtl is not defined` Kompas fixture errors. The clean current-master head still requires exact-head checks. Current master also contains the known `prefer-const` lint issue at `src/lib/kompasConsistency.ts:1059`; this PR intentionally does not duplicate that unrelated fix. No local checkout/dependencies are available, so local execution is not claimed.

## Production limits and next steps

No production deployment, live crawl, portal request, production database mutation, application submission, cron or device test occurred. Crawling remains manual/on-demand; Robert Half remains manual-only and eTeam excluded pending compliant official feeds. Keep PR #551 DRAFT. Run exact-head crawler freshness, full CI, Kompas baseline and Plan/REA; resolve shared blockers through their existing PRs, then review, protected preview, production READY/alias and separately authorized manual crawl.


## 23 November continuation — cancellation propagation

The prior timeout race returned an error but did not abort underlying portal work, so a worker could start another portal while the timed-out fetch/storage operation still ran. PR #551 now passes an AbortSignal into each portal work callback, aborts at the per-portal timeout, and waits for cooperative work to settle before releasing the worker slot. `politeFetcher` makes pacing delay and fetch abortable; the runner forwards the same signal to Supabase upsert and stale-job retirement and checks it before writes. The 600 ms pacing and 25,000 ms request timeout are unchanged; no adapter or scheduler changed.

Commits: implementation `545359d6701dfd0ec88ce7411999cb1fa889f07`, signal correction `e6aeb5fc260c2d67d2197e6a3b0dd4553021ffd3`, workflow dependency `65b4b64f3dca6458e9d648cf808c816ff0f11323`, test-fixture correction `490a213739052c950ad1df0483d47ff5f0f89647`, assertion correction `ba13fa90b73d4baec74fdcccd47845bba0fb6663`, final signal relationship test `5d16f9a90ff9a671b1b24c10b493a23fd3a2b50d`. Exact crawler workflow `45219883528` passed (collector 8/8 plus runner wiring, registry and source-safety); Plan/REA `45219883454` and Kompas baseline `45219883587` passed. Full CI `45219883408` failed at existing master lint `prefer-const` in `src/lib/kompasConsistency.ts:1059` (2 errors, 267 warnings); type-check/build skipped. The missing VM fetch and incorrect signal-identity assertions were fixed. No local execution or live portal request.

## Release and acceptance boundary

The current production alias remains READY at master `794e8cfdbd3103409552857806bab89851d5bfcb`. PR #551 is DRAFT and not deployed. The contract crawler is manual/on-demand only; no cron, live crawl, DB write, or job submission occurred. Robert Half remains manual-only and eTeam excluded pending compliant feeds.


## Shared CI repair — 23 November

The current code/test head 0f194b18f730b184c18321b67d4da077c56b8895 includes the crawler abort-timer refactor, behavior-neutral prefer-const fixes in the collector and Kompas consistency gate, and four shared Kompas VM fixture initializations. Prior CI 45229384405 failed at two prefer-const errors. New exact-head full CI 45230015959, crawler regression 45230015822, Kompas baseline 45230016873 and Plan/REA 45230015849 are IN PROGRESS. No local checkout; no live crawl or production change. This does not resolve the separate Listening-hold behavior dependency in PR #554.


## 23 Nov 2026 — REA type-check correction

PR #551's full CI on head `5913afd` failed Type-check because the new REA record's `state` value was not in the declared enum. Code commit `19d7ac2024a959e4d247eb4cbc860ba2d33c58a4` replaces it with `Implemented, verification pending`; no collector, runner, fetch or portal runtime behavior changed. Corrected-head schema `45260236503`, Kompas baseline `45260236205`, and crawler freshness `45260235924` passed; full CI `45260236471` was in progress. No live crawl or production deployment.


## 23 Nov 2026 — REA type-check correction

PR #551's full CI on head `5913afd` failed Type-check because the new REA record's `state` value was not in the declared enum. Code commit `67810506a1b4d8a062ac9fba44d5152c88c1cb1e` replaces it with `Implemented, verification pending`; no collector, runner, fetch or portal runtime behavior changed. Corrected-head schema `45260236503`, Kompas baseline `45260236205`, and crawler freshness `45260235924` passed; full CI `45260236471` was in progress. No live crawl or production deployment.


## 23 Nov 2026 — corrected-head full CI terminal status

Code commit `19d7ac2024a959e4d247eb4cbc860ba2d33c58a4` fixes the previous Type-check enum failure. Corrected-head schema `45260236503`, crawler freshness `45260235924`, and Kompas baseline `45260236205` passed. Full CI `45260236471` failed on two shared Kompas Listening-hold assertions (tests 50 and 54); 27 tests passed, 2 failed, and Type-check was not reached. Do not claim type-check success on this head. No live crawl or production deployment.


## 23 Nov 2026 — corrected-head full CI terminal status

Code commit `19d7ac2024a959e4d247eb4cbc860ba2d33c58a4` fixes the previous Type-check enum failure. Corrected-head schema `45260236503`, crawler freshness `45260235924`, and Kompas baseline `45260236205` passed. Full CI `45260236471` failed on two shared Kompas Listening-hold assertions (tests 50 and 54); 27 tests passed, 2 failed, and Type-check was not reached. Do not claim type-check success on this head. No live crawl or production deployment.


## 23 November 2026 — clean stacked validation restack

The crawler timeout/abort source and tests are restacked onto PR #554's exact green Kompas validation base `4fafd56663bb5ddce064dcebea8802d758bb8259`. The branch carries only the crawl freshness workflow, collector/runner code and focused test files plus this research note; shared Plan/REA, Completion Watch and overlapping Kompas fixtures are excluded. The original PR #551 remains preserved until exact focused validation. No live crawl, external portal request, job-row write, schedule or application submission was performed.


## Completion Watch independent master restack — 23 November 2026

This continuation copies the reviewed collector/runner diagnostics from PR #569 exact head `e68ea50ef27133c18bf688693218b52461df3767` onto canonical master `794e8cfdbd3103409552857806bab89851d5bfcb`, without the Kompas #554 dependency. The original focused crawl test result is historical; exact-head dedicated regression and full CI must rerun. No live portal requests, storage mutations, job applications or schedule changes occurred.


## 24 November 2026 — pacing abort regression

24 November 2026: PR #573 test-only crawler continuation is at code/test head 672c7bdf49f55c8473357f56b7ad16e7379d9c16. The pacing-abort regression was corrected after its first exact-head attempt failed because the test had no prior request to establish a pacing wait. The corrected test first performs a synthetic request, then aborts during the second request's 250 ms pacing delay and asserts no second fetch starts. Exact crawler regression 45353417281 and Kompas baseline 45353417257 SUCCESS; full CI 45353417177 FAILED at the shared master prefer-const lint in src/lib/kompasConsistency.ts:1059. PR #554 already contains this one-line lint correction plus the shared VM fixture/Listening-hold fix, but its five gates are green and independent authorized review is still missing. Do not duplicate or merge that PR's voice runtime. This PR remains DRAFT; no protected preview, live crawl, Supabase crawl mutation, application or production deployment. Crawler stays manual/on-demand; Robert Half remains manual-only and eTeam excluded.
