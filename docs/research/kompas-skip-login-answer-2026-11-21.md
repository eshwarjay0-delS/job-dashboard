# Desktop AI Answer asked to sign in

Date: 21 November 2026. Method: source and artifact analysis.

The Kompas.exe built from `c76ecc05` showed "Sign in again, then press AI Answer." and "The answer did not finish." when AI Answer was pressed. Skip-login is the default. `AUTH_DISABLED` and `NEXT_PUBLIC_AUTH_DISABLED` turn it off only when the value is exactly `off-confirmed-by-eshwar`.

The answer card treated a provider code containing AUTH or NOT_CONFIGURED as a logout. A desktop request also has no site cookie, because the shell loads `kompas://app` and forwards `/api/*` from the Electron process.

The answer route, the Kompas answer route, and the bridge route now use the Houston owner (`eshwarjay05@gmail.com`, `67f02d95-f7fe-4058-9b0d-9363221e7c61`) when skip-login is on and the request has no cookie and no bearer token. Typed chat uses the same answer route. Admin routes still require a real session or the `mf_admin` cookie. The synthetic owner is not an admin.

The local test posts that bare desktop request at a mocked model and reads a full answer. It is not a production call.
