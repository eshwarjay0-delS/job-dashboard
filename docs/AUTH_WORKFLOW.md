# MarketFit sign-in

One sign-in. The website, the Kompas desktop app, and a linked WhatsApp number all belong to the same person. They do not share one refresh token.

## Website

1. Open `/login`.
2. Continue with Google, or use email and password where that account has it turned on.
3. Google returns to `/auth/callback`. The callback exchanges the code, then sends the person to the page they asked for, or to setup if the profile is unfinished.
4. The browser keeps the cookie session. `POST /api/auth/refresh` rotates that cookie family.
5. `POST /api/auth/signout` clears that cookie session. Kompas also drops the local sign-in keys (`clearAuthLocalState`). Interview notes are not part of those keys.

A wrong password, a dead link, or an unreachable sign-in service shows one sentence and a way to try again. The page does not say the person is signed in when the service failed.

## When Supabase cannot be reached

`getUser()` is the normal check. If that call cannot reach the service, and `getClaims()` can still verify the access token locally, the person stays signed in. A missing session, an anonymous session, or a token the service rejected is signed out. If the service is down and the token cannot be verified, dashboard pages stay up instead of bouncing to the login form. API calls that cannot verify the token still refuse the request.

## Desktop

The desktop does not copy Chrome's refresh token.

1. Kompas opens Chrome at `/auth/desktop?state=<nonce>&loopback=http://127.0.0.1:<port>/cb&handoff=start`.
2. After the browser session exists, the site creates a two-minute single-use code bound to that nonce (`POST /api/auth/desktop-code`).
3. The browser opens `marketfit-kompas://auth?code=<code>&state=<nonce>`, and also returns the same pair to `127.0.0.1` when the desktop gave that address.
4. The running app takes the link: Windows via the second-instance arguments, macOS via `open-url`. A cold start reads the same link from the launch arguments.
5. The app exchanges the code and nonce at `POST /api/auth/desktop-code/exchange` and stores the desktop refresh token.
6. While the sign-in card is open, and only then, the app also asks `GET /api/auth/desktop-code?nonce=` every 2.5 seconds for at most two minutes, then exchanges whatever code comes back. The poll stops when the card closes, the session is stored, or two minutes pass.
7. The website says Kompas has the sign-in only after that exchange has claimed the code. Until then it says Return to Kompas, with Try again. If the sign-in service errors, that sentence is the error. It does not say the person is authenticated.

The desktop session is `POST /api/auth/desktop-session`. A website tab rotating its own cookie does not present this refresh token.

The refresh token is stored with Electron `safeStorage` when the OS keychain or DPAPI is available. When it is not, the same JSON is stored as an AES-256-GCM file in the app's userData directory (`marketfit-auth.bin`) with the key in `marketfit-auth.key` (mode 0600). It is not localStorage. On the next launch the file is read back and the access token is refreshed if it has expired. A network failure keeps the stored session. A revoked refresh token is the case that signs the desktop out.

The desktop schedules the next refresh for shortly before the access token expires, or for the existing window before the three-day family ends. It does not refresh on a fixed 4-minute, 10-minute, or 30-minute timer. A 401 from an API call still asks the shell to renew.

## Skip-login

Owner mode is on unless `AUTH_DISABLED` or `NEXT_PUBLIC_AUTH_DISABLED` is exactly `off-confirmed-by-eshwar`. Unset, empty, `false`, and `true` all leave it on. The site does not show `/login` and does not call Supabase Auth. The person is the Houston account `eshwarjay05@gmail.com`. The id is `AUTH_DISABLED_USER_ID` when that variable is set, otherwise `67f02d95-f7fe-4058-9b0d-9363221e7c61`. Logout, a failed refresh, and HTTP 402 `exceed_egress_quota` do not send them to `/login`. Kompas Start still runs. MarketFit opens without the setup gate. Admin pages still need a real session or the `mf_admin` cookie. The synthetic owner is not an admin. Do not set the flags to `false`.

## After every session is revoked

Supabase "sign out everywhere" deletes the refresh token. The next silent renewal then fails. The desktop drops that dead token and, when no interview is running, opens the existing Chrome sign-in. The website sends the person to `/login` and, after Google succeeds, back to `/kompas/index.html` so they can press Start. A live interview does not open Chrome and does not navigate to the login page. The ask waits until Stop.

An HTTP 402 `exceed_egress_quota` response is not a logout. The stored 3-day session stays. The sentence on the screen says Auth is blocked because the project exceeded its egress quota, and that sign-in works again once Auth is reachable. This app does not raise the spend cap and does not invent another identity.

A refresh that loses a rotation race (`already used`) does not delete the desktop family. A network failure does not delete it either.

## Kompas page

`keepAuthAlive` wakes every 60 seconds and on focus, and only while the tab is visible. Each wake reads the access-token expiry already stored in this browser. It calls the refresh route only when that expiry is inside the last minute. A hidden tab does not call Supabase.

Transcription retries once after a 401, through the same refresh, then stops.

## WhatsApp

A WhatsApp number is linked by a code stored for that number, or by a verified mobile number. That link is not the website cookie and not the desktop refresh token. If the database cannot be asked, the bot says it could not check the number. It does not tell a linked number that it is unregistered.

## What was not added

No new cron. No always-on poll. The desktop poll exists only while its sign-in card is open, for at most two minutes.
