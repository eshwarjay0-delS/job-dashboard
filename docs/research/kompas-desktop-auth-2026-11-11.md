# Kompas desktop sign-in, 11 November 2026

Method: source and artifact analysis. No live Supabase sign-in. The project `ruajlrzmxzprmmngluxy` is restricted for egress, so a real Google round trip was not run.

## What was failing

1. Closing Kompas and opening it again showed signed out. `legacy/perfact/desktop/marketfit-auth.cjs` wrote the refresh token only when `safeStorage.isEncryptionAvailable()` was true, and `load()` refused to read anything otherwise. With OS encryption unavailable the session lived in memory and died with the process.

2. Sign-in opened the website, the website said the person was signed in, and the desktop never continued. The page put the browser access token into `marketfit-kompas://auth?d=...`. That URL is long enough for Windows to drop it. The page said "You are signed in" before the desktop had claimed anything. A Supabase error took the same success sentence. The state nonce lived only in the first process, and a deep link that started a second process was not delivered on macOS (`open-url` was not handled).

## What changed

The refresh token is stored with `safeStorage` when that works, and otherwise as AES-256-GCM in userData. Launch reads it back and refreshes if the access token is expired. A network failure keeps it. A revoked refresh token clears it.

The website mints a two-minute single-use code bound to the desktop nonce. The desktop exchanges that code. The link is short. While the sign-in card is open the desktop also polls for at most two minutes. The website says Kompas has the sign-in only after the claim. A service error stays an error.

Windows delivers the link through the single-instance second-instance arguments. macOS delivers it through `open-url`. The portable launcher forwards `code` as well as the older `d` form.

`getClaims()` keeps a still-valid access token when Supabase cannot be reached. Refresh is scheduled for shortly before expiry, or it runs once after a 401. The Kompas page's 60-second wake only reads the local expiry and calls Supabase when that expiry is inside the last minute and the tab is visible.

The helpers patch (logout key list, plain error sentences, one 401 retry, sign-out route, signOut stub, signOutKompas, clearAuthLocalState, transcribe 401 retry) is in this flow. Its 4-minute and 10-minute refresh windows are not.

## Limits

No installed Windows click-through. No live Google session. The desktop executable changes only after the existing Windows release workflow publishes `kompas-desktop-latest`. The website half ships with the production deploy.
