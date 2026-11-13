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


## 12 November 2026 — current-master recheck (06:53 UTC) <!-- auth-disabled-master-recheck-0653z -->

Canonical master has advanced to `da1db145c5981254f95620ff6bb0222ab4228125` and the production alias metadata resolves to READY deployment `dpl_amu7rE9qzAEG6N7iYjEpnu7BDAwj`. The last authorized environment inspection recorded production `AUTH_DISABLED=false` and `NEXT_PUBLIC_AUTH_DISABLED=false`; this continuation did not read or change either value. No synthetic owner login was enabled and no access-control bypass was attempted.

Protected preview remains blocked by the missing private GitHub Actions `KOMPAS_VERCEL_API_TOKEN` and Vercel project `live=false`. The owner or authorized repository administrator must configure the token privately and restore legitimate preview availability. No secret value is recorded here.
## 12 November 2026 — current production configuration recheck (08:26 UTC)

Authorized Vercel project/environment reads were repeated against the current job-dashboard project:
- Production AUTH_DISABLED: false.
- Production NEXT_PUBLIC_AUTH_DISABLED: false.
- The project reports live=false; its latest deployment metadata is READY at exact master da1db145c5981254f95620ff6bb0222ab4228125, and the alias metadata assigns job-dashboard-fawn.vercel.app to that deployment.
- Only the two boolean flag states were inspected; no synthetic-owner identity, user email, token, credential or other environment value was read or recorded. No variable was changed.

This recheck resolves the current flag-state uncertainty: the synthetic fallback is not enabled by these production flags. Issue #308 remains open because the code path is present without owner approval, production fail-closed tests are still required, and owner/admin plus ordinary-account and desktop continuity acceptance have not been exercised. Keep both flags false. READY plus alias metadata and false flags do not prove public HTTP reachability or authenticated UX while the project reports live=false.

## 13 November 2026 — direct owner-authored approval correction

The earlier conclusion that no direct owner approval for login-off could be found is superseded by the owner's public GitHub comment [#6838197882](https://github.com/eshwarjay0-delS/job-dashboard/pull/319#issuecomment-6838197882), posted 12 November 2026 at 22:54:44 UTC. The owner explicitly recorded the production login-off environment as configured with `AUTH_DISABLED=true` and `NEXT_PUBLIC_AUTH_DISABLED=true` for the READY `a247ddf6042385d12a19bfd7e893983c1bcf9087` deployment. This is direct owner-authored approval, not an inference from assistant-written journal text.

Preserve that approved login-off behavior. PR #331's removal of auth-disabled handling is incompatible and must be corrected before merge. The public auth-flag endpoint was inaccessible in this continuation, so the current runtime value was not independently re-read; no environment values were changed. Account-sessions API 200, first catalog sync and actual phone/desktop convergence remain unverified.
