# Resume display precision — 20 October 2026

## Release reconciliation

The earlier release blocker below is historical and resolved. The Chief workstream changed its cron to daily in `16ff1356d715c2ba1b2203e09ea99d7963e7ea45`; this checkout contains the precision fix. On 20 October, GitHub returned Vercel success for that commit: https://vercel.com/qu4ntum-s-projects/job-dashboard/Tv3bm67pL38nAjS5UQn4PR991imB. Re-ran 17 focused precision, quality and REA checks: all passed. Public production `/api/health` returned HTTP 200. No runtime logs, authenticated generation, artifact download or real messaging were tested. Cadence changes belong to the Chief workstream; no further scheduler changes made here. The next acceptance step remains a fresh authorized baseline/JD/confirmation/export pair, plus the original failed-run evidence. Deployment success does not establish 98% resume quality.

## Request and method

Continue the owner's approved resume-quality work and accurate reporting. Source analysis, not a live provider test or proprietary reverse engineering. Read current master 8ec8180, AGENTS.md, completion-watch.md, resume plans and the current journal. Other developers' crawler and Chief changes are outside this slice.

## Observed defect

`src/lib/tailor.ts` rounds result score, coverage, keyword analysis and notes to integers. `src/app/dashboard/resume/result/page.tsx` rounds the match ring again. Thus 949/1000 becomes a displayed 95 even though the unchanged acceptance check rejects it; 979/1000 becomes 98 despite missing the target. The repair prompt also rounds its current measurement.

## Implementation

`coveragePercent` truncates display percentages to one decimal; invalid ratios display zero. Original ratios still govern acceptance. All shared output measurements and the repair prompt use it. The web ring and its accessible label render the same numeric measurement. No resume contents, quality thresholds, role-evidence rules or delivery policy changed. Cache generation 18 prevents serving the older rounded result fields to new requests; existing stored artifacts remain unchanged.

## Evidence and limits

Regression coverage exercises 94.9, 94.999, 95, 97.9, 97.999, 98, 99.999, 100, zero and invalid input, plus source wiring for shared fields and the web ring. Test/build and deployment results are recorded below when verified. This is not evidence that any live generated resume matches 98%, nor reproduction of the exact 17:28 WhatsApp failure.

## Next

Release blocker: implementation commit `9bb90f2a2b8f517fd05e5ed3b2ce5d6a10336983` published on master. Its Vercel GitHub status is failure with target `https://vercel.link/3Fpeeb1`, redirecting to https://vercel.com/docs/cron-jobs/usage-and-pricing. Parent `1e8df2613fa3ce008b07306a397c2f5fdcca44da` has the same failure and added `/api/chief/watch/run` with `17 */2 * * *`. Official documentation says Hobby rejects more-than-daily cron schedules. This strongly indicates a plan/cadence conflict; direct team logs remain inaccessible, so no more specific runtime cause is asserted. The resume change is NOT deployed. The Chief work owner must select a supported cadence or the owner must authorize a hosting upgrade; neither was silently changed here. Preserve this evidence for the active Chief/Bible-Keeper workstream.

Validation: 64 regressions passed; TypeScript and the full production build passed on the combined tree with concurrent master 1e8df26. Scoped lint: zero errors, five existing warnings. No real provider or messaging calls. Deployment verification pending.

Inspect a fresh authenticated baseline/JD/confirmation/export pair and its download. The original failure still requires its full JD, source Word file, returned artifact and execution trace. Authorized runtime logs and an authenticated test session are not available in this execution environment. No email or WhatsApp messages sent.
