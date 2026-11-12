# Production AUTH_DISABLED review — 12 November 2026

## Finding

Canonical master commit `65bdf2f8cf1dd7299b8623885641400efe57bbfe` adds `AUTH_DISABLED` / `NEXT_PUBLIC_AUTH_DISABLED` handling in `src/lib/authDisabled.ts`. When enabled, that path can substitute a synthetic owner identity when a real user session is absent or rejected. Accessible owner instruction evidence says public pre-login demonstrations are permitted, but actual application features must remain authenticated; an October 10 correction restricted login changes to the admin email only. No accessible owner-authored instruction approves synthetic production identity or a production no-login fallback.

## Authorized production configuration check

The Vercel project environment was read through the authorized connector, but only boolean state was emitted:

- Production `AUTH_DISABLED`: false.
- Production `NEXT_PUBLIC_AUTH_DISABLED`: false.
- No synthetic-owner ID, credential, token value or secret was read or recorded.
- No environment variable was changed.

Vercel alias metadata maps `job-dashboard-fawn.vercel.app` to READY production deployment `dpl_5ipmErFiEhTsp5tEupta39o8EA1K`, exact master SHA `65bdf2f8cf1dd7299b8623885641400efe57bbfe`. PR #306 records a public production smoke at 12 Nov 00:56 UTC: `/api/health`, `/version.json`, and `/api/kompas/desktop-version` returned HTTP 200; the manifest reported desktop 0.8.8. This is not authenticated account isolation, Windows sign-in or mobile acceptance.

## Exact blocker

PR #306's protected preview workflow 43130279686 failed because the private GitHub Actions secret `KOMPAS_VERCEL_API_TOKEN` is absent. The 17 fail-closed resolver tests passed. The owner or authorized repository administrator must configure that secret privately. Do not request, print, copy, or bypass the token.

## Decision and remaining work

- Keep both production flags false.
- Do not enable or deploy synthetic owner identity without explicit owner approval.
- Do not automatically roll back or change production: issue #308 explicitly does not request that.
- Add source tests proving production cannot synthesize an authenticated owner for a missing/rejected session, while unset/false flags preserve real login.
- Separately verify owner/admin access, ordinary account isolation, and desktop sign-in continuity using real verifiable sessions.

No auth behavior, production environment, account data, deployment or Vercel protection was changed in this review.
