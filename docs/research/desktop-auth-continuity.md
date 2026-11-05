# Desktop and web authentication continuity — 22 October 2026

## Owner rule

A valid login must remain usable for at least two to three days and should continue by silent renewal while its server-side session family is valid. No idle timeout, visibility change or deployment may force the user out of a meeting. A real logout, credential revocation or server-enforced session limit may still require explicit reconnection.

## Source audit

The shipped client had three independent interruption risks:

1. `session-clock.ts`, the dashboard guard and `public/kompas/app.js` treated 48 hours as a forced reauthentication boundary even though the stated minimum was three days.
2. Kompas update polling automatically reloaded outside the live-copilot view. An inactive or backgrounded window could therefore lose its current visual state after a deployment.
3. The canonical Electron shell stored an access token and, on the first API 401, removed auth cookies and opened Chrome sign-in. It did not first rotate the refresh token. The web handoff and refresh-token exchange route exist, but an already installed shell must be rebuilt to use them.

## Implemented web boundary

- The login timestamp is diagnostic only; it cannot expire the client.
- The dashboard attempts `refreshSession()` on open, focus, visibility return and every 20 minutes while visible.
- Kompas first asks the native refresh bridge when available, otherwise uses the same-origin cookie refresh endpoint.
- If renewal is definitively unavailable, the current surface is preserved and an explicit **Reconnect sign-in** control appears.
- Deployment polling always offers an update button. Only the user can reload.

## Evidence and limits

Six focused tests cover no client expiry at 48 hours, 72 hours, 30 days and one year; renewal wiring; no navigation; manual update behavior; bridge preference; and 1,000 sequential renewal decisions. The client JavaScript passes syntax validation. These are deterministic policy regressions, not a real three-day authenticated run.

No live credentials, messages or protected data were inspected. No server control was bypassed. TypeScript/build/deployment evidence is added only after those steps complete. Native completion requires a canonical shell commit, rebuilt/signed Windows installer and acceptance covering idle, sleep/resume, network loss and restored answers.

## Separate desktop refresh family — 5 November 2026

Owner Eshwar Jay asked for a desktop sign-in that stays valid when the website rotates its own session. Checked origin/master `e58450c6` (PR #224 and PR #226 are both merged). PR #224's `/auth/desktop` loopback returns `{ access_token, expires_at }` to `http://127.0.0.1:<port>/cb` and does not copy the browser refresh token. There was no `POST /api/auth/desktop-session`.

The website family is `POST /api/auth/refresh`. It reads the cookie session. Two tabs renewing that cookie can reject the loser. The desktop route does not read that cookie. With a refresh token, it rotates only that token. With an empty refresh token and a bearer, it opens a new Supabase session (admin magic-link verify, no email sent) and returns that session's refresh token, marked `session: "desktop"`. A missing refresh token on the loopback payload does not erase a desktop refresh the app already stored.

A repeated presentation of a token this server process already rotated answers `401` with `error: "already_used"` and `error_description: "Invalid Refresh Token: Already Used"`. `invalid_grant` and `revoked` are separate codes. None of those bodies tells the client to wipe stored credentials.

Limit: another server instance that still presents the old desktop token to Supabase can revoke that desktop family. The website cookie family is a different session, so a tab race does not do that. The tests are in-process. They are not a live Supabase call or a three-day Windows run. The first mint needs `SUPABASE_SERVICE_ROLE_KEY`. Renewal of a token the desktop already holds uses the anon key.
