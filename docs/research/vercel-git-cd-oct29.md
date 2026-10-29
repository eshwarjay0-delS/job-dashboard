# Vercel Git-integrated CD verification repair — 29 October 2026

## Confirmed failure
GitHub Actions CD run 40851473990 for master 85bbd32 failed at `vercel pull --yes --environment=production --token=`. The `VERCEL_TOKEN` secret expanded to an empty string. The subsequent commit-comment action also failed HTTP 403 `Resource not accessible by integration` because the job lacked write permission. The application nevertheless deployed successfully through Vercel's linked Git integration: production READY deployment dpl_FeH5U1wfUh67xUwQwc52TM1eLy2o, matching SHA 85bbd32. GitHub commit status context `Vercel` reported `success` with a vercel.com deployment URL.

## Safe release pipeline
The replacement `.github/workflows/deploy.yml` does not require the absent Vercel secret, install an unpinned latest Vercel CLI, start redundant production deployments, or attempt unauthorized comment writes. It waits for the exact pushed SHA's GitHub `Vercel` status using the built-in least-privilege `github.token` and `statuses: read`. Pending status polls are bounded; failed/error status, HTTP errors, spoofed proof URLs, and absent status fail the job.

This verifies successful Git-integrated deployment **status** for that exact commit. It does not independently prove production aliases, native desktop installation or the semantic quality of Kompas answers. Vercel deployment read-back is still required for a READY/production/domain release claim.

## Tests and gating
`scripts/tests/verify-vercel-git-status.test.mjs` covers exact SHA, pending polling, latest success, upstream 403, failure, error, timeout, fake status URLs and missing GitHub credentials. It uses a synthetic transport only; it does not deploy or require external secrets. CI now includes it.

## Remaining acceptance
Monitor the first master push after this workflow update. Verify CI green and `CD — Verify Vercel Git Deployment` green, compare Vercel READY deployment SHA and aliases, and retain separate authenticated 50-answer and desktop/WhatsApp end-to-end checks.
