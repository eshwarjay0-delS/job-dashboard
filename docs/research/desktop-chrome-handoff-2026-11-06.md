# Desktop Chrome handoff stuck on the sign-in card — 6 November 2026

## Request

The Nov 6 Kompas window on Eshwars_Laptop stayed on "Sign in with Chrome" after install of `kompas-desktop-latest` (the `9a68ba61` desktop-session build, running from `Kompas-20261106` / `Local\Kompas\app`). The card said Chrome was opening MarketFit and that this window continues from the Google sign-in already in Chrome. It did not continue. A leftover label read `Openir`. A state-shaped token starting `v2b2ADLX5N83WOWGuKSAxFlUoXwa` sat in the title strip. Close was the window close. Do not merge. Do not log out a live session.

## What the source was doing

Checked `origin/master` `06b3a9f8`, which contains `9a68ba61`. `beginChromeSignIn` opened `/auth/desktop?state=` only. It did not listen on `127.0.0.1`. The page then set `window.location` to `marketfit-kompas://auth`. That relaunches the portable exe. The window that is already open does not receive the session when that relaunch fails or is blocked. The page note was the short string `Opening Kompas…`. `safeAuthNext` kept `state` and dropped every other parameter, so a loopback address could not survive Google sign-in. The published exe's `app.asar` has the same opener. The strings "Sign in with Chrome" and "Openir" are not in that asar. The short Opening note and the protocol handoff are.

A stored session still returns from `beginChromeSignIn` before Chrome opens. This slice does not call `desktopAuth.clear()`.

## What changed

- The shell listens on `http://127.0.0.1:<port>/cb` and opens Chrome with `state`, that loopback, and `handoff=start`.
- The first handoff may go through Google. `safeAuthNext` keeps the loopback only when it is `http://127.0.0.1:<port>/cb` with port 1024–65535, and keeps `handoff=start`. Other query keys are still dropped.
- A loopback without `handoff=start` and with no Chrome session still does not open the login form.
- The Kompas window paints one card, and only when there is no stored session. The card is the full title, the full body, and Open Chrome again. There is no separate Opening label. The state nonce is not written into the card or the loopback response.
- Open Chrome again is an explicit retry. A later automatic call does not open Chrome again.
- A bad or failed callback leaves any stored session in place and leaves the card up so the retry still works. A successful callback removes the card and sends `kompas:auth-ready`.

`PHRASE_FIXES` and `REPAIRS` were not edited. The resume tailor and the WhatsApp send path were not edited. The JEV route table and Lens `PEER_VOICE` were not edited.

## Evidence

Offline. `legacy/perfact/desktop` `npm run check`: 42 pass, 0 fail, and the protocol self-test passed. `scripts/tests/desktop-signin-state.test.mjs` and `scripts/tests/auth-gate.test.mjs`: 19 pass, 0 fail. `tsc --noEmit --skipLibCheck` was clean. ESLint on `src/lib/authRedirect.ts` and `src/app/auth/desktop/page.tsx` reported 0 errors. The two `window.location.assign` warnings are the existing desktop-page navigation.

Not a live click on the laptop. Not a new `Kompas.exe`. Not a production deploy. The installed Nov 6 exe keeps the old opener until a later Windows build replaces it.
