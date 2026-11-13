# Kompas session start after a full logout, 12 November 2026

Method: source analysis and simulated tests. No live Supabase call, no email, no WhatsApp, no model resume, and no production data write.

## What was failing

After a Supabase logout of every session, the refresh token is gone. The desktop kept a token unless the error text said `revoked`. `Refresh Token Not Found`, which is what a global logout returns, was classified as `invalid_grant` and left in place. A still-unexpired access token made quiet renewal look successful, so Start never asked for Google again. A 401 from `/api/answer` tried one desktop refresh and then said the answer service was not ready. The website Kompas page did not try `POST /api/auth/refresh` on that 401, and `/login` could not send the person back to `/kompas/index.html`.

An Auth HTTP 402 `exceed_egress_quota` was easy to treat as a signed-out session. `isAuthUnreachable` did not treat status 402 as an outage unless the message happened to match. An expired access token during that 402 became a null user, and the answer route answered 401.

## What changed

`classifyRefreshFailure` now returns `signed_out` for a missing or not-found refresh token, and `egress_quota` with HTTP 402 for the egress block. `already_used` is unchanged. The desktop clears storage only for `signed_out` or `revoked`. It keeps the 3-day family on 402, on a network failure, and on `already_used`.

The shell opens the existing Chrome handoff only when that renewal truly ends the session and no interview is running. `setInterview` is true only between Start and Stop. A failure during an interview is remembered and asked after Stop. A 402 does not open Chrome. It sends the egress sentence.

The Kompas page uses the same decision. Outside an interview, a dead token or a 401 followed by a failed refresh goes to sign-in. On the website that is `/login?next=/kompas/index.html`. After Google, that path is allowed and nothing else on the query is. During an interview the page does not navigate. A 402 shows the egress sentence and a Sign in button the person can press once Auth answers again.

This note left `AUTH_DISABLED` off. That instruction is superseded (13 Nov 2026): skip-login stays on unless the flag is exactly `off-confirmed-by-eshwar`. Do not set the flags to false.

## Limits

No live Google round trip and no Windows click-through. If Supabase Auth is still returning 402, a new sign-in cannot complete until the project can answer Auth again. This change does not raise the spend cap. The installed Kompas.exe changes only after the existing Windows workflow publishes it. The website half ships with the production deploy.
