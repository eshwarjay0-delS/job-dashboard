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
