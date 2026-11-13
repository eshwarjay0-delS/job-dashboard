# Contract-to-hire classifier — 13 November 2026 run 11

## Owner-approved scope

Restack the explicit C2H classification slice from PR #355 onto canonical master `026c72968e45314ff0a99f701942c966e79f0a1e`.

- Require explicit conversion-to-hire or right-to-hire language.
- Treat negations such as "no conversion" or "not C2H" as negative evidence.
- Do not infer C2H from W2 payroll, contract duration or the word "contract" alone.
- Keep C2H separate from W2, C2C and 1099 engagement type.
- Preserve manual/on-demand crawl authorization. No daily cron, live portal crawl, portal scraping or external side effect is authorized by this slice.

## Source and changes

- Source PR #355 head: `28c3f3ce97fe79721623f29c6252a727ea7c81c8`.
- Current-master base: `026c72968e45314ff0a99f701942c966e79f0a1e`.
- Implementation commit: `e7a54477ee30e48b84df36ec9e754ff81b34c9b9`.
- Branch: `fix/contract-c2h-classifier-master-026c729-run11-20261113`.
- Files: `src/app/api/crawl/jobs/route.ts`, `src/app/api/crawl/run/route.ts`, `src/lib/contract-jobs.ts`, `src/lib/crawl/classify.ts`, `scripts/tests/crawl-classify.test.mjs`, `scripts/tests/crawl-freshness.test.mjs`, and `docs/apply.md`.

The source PR #355 full CI, Kompas baseline and crawler regression passed. The current-master restack must pass its own exact-head full CI, Kompas baseline, Plan/REA schema and protected Vercel preview.

## Evidence boundary

The manual/on-demand guard was source-checked in `src/app/api/crawl/run/route.ts`. No live portal crawl, posting fetch, cron execution, external API request, production deployment or account-side write occurred. The protected preview requires the private `KOMPAS_VERCEL_API_TOKEN`, which is unavailable to this run; no bypass was attempted.

This is a C2H classifier slice, not completion of the entire contract job crawler. Post-deployment acceptance must use authorized sample postings and verify C2H positive/negative evidence, W2-only false-positive suppression, freshness and account isolation.


## 13 November 2026 — run 11 exact-head source gates passed

The current-master restack PR #376 at head `fb1aaad17b982dc323342cea87313a27ce7b3ad7` passed full CI `43491614601`, crawler freshness/classification regression `43491614548`, Kompas baseline `43491614613` and Plan/REA schema `43491614636`. The full CI is separate from the dedicated crawler regression. These are source tests only.

PR #376 remains DRAFT pending the legitimate protected Vercel preview. No production deployment, live portal crawl, external API request, scheduled job or account-side write occurred. Post-release acceptance must remain manual and use permitted sample postings to verify explicit conversion intent, negation, W2-only suppression, freshness and account isolation.
