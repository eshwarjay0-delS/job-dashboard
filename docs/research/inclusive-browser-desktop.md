# Desktop inclusive browser: source analysis and implementation

Request: continue the in-app inclusive browser and the remaining REA work (22 October 2026).

## Sources and observations

- docs/embedded-browser.md still selected BrowserView and pointed at a retired bookmarklet and developer-local shell path.
- docs/apply.md and docs/research/apply-horizons.md already identify WebContentsView as the current desktop direction.
- Apply page only called window.open. Native main.js sent new windows to the external browser. No persistent portal browser existed in either path.
- Canonical native packaging uses an explicit files array; adding source files without updating it would omit the browser from Kompas.exe.
- Official Electron references checked: https://www.electronjs.org/docs/latest/api/web-contents-view and https://www.electronjs.org/docs/latest/api/browser-view. WebContentsView supports embedded web content; persistent partitions hold browser session data. This is public documentation and source analysis, not recovered vendor internals.

## Implemented

Authenticated account-context API and Apply launch button; main-process independent account check; per-account persistent portal session; sandboxed WebContentsView with no privileged preload or app authorization headers; local toolbar with back/forward/reload/address/close; HTTPS navigation checks; native popup containment; child cleanup; new auth-family/logout closes portal windows; Forget logins confirmation clears only that account. A launch is not a submission receipt. Resume download/manual upload stays available.

## Evidence and limits

Six simulated Electron tests and eight existing native auth tests pass, as do native syntax and protocol checks. Two API tests verify unauthenticated denial, stable/distinct account keys and no raw identity exposure. Web TypeScript and production build pass. No actual job application, email or WhatsApp message was sent. No paid browser provider was provisioned. Windows release, real portal/SSO/upload navigation and persistent-session acceptance remain pending until explicit evidence is recorded. Provider policies may prevent embedded sign-in; leave those portals on the ordinary browser route rather than bypassing restrictions.
