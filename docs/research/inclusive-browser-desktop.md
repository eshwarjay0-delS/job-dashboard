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


## Release evidence — 22 October 2026 (Chicago)

- Web implementation: 9deb46b4d8637c35c24d46629588dac17ddb0144; REA type correction: 5518d8dc9969dd61421bcf120fde1e7b9b842f85. TypeScript passed after the correction. [Vercel deployment succeeded](https://vercel.com/qu4ntum-s-projects/job-dashboard/5UnpF54rJpYv1iToxxez9VAydz4u).
- Canonical desktop implementation: parfAct commit 07e51a9da692da7b162c4feb23be2a4facb5054b. [Windows release run](https://github.com/eshwarjay0-delS/parfAct/actions/runs/39880697642) succeeded: source checks, x64 executable build/verification, native protocol smoke, release publication.
- [Kompas.exe](https://github.com/eshwarjay0-delS/parfAct/releases/download/desktop-latest/Kompas.exe): 162079503 bytes; release asset updated 2026-10-23T00:54:11Z; SHA-256 5abe98b34dd056ff63ad704d6e994adeb0ebf3ffa9b49f2a4661197c47b4c438. The desktop-latest URL is mutable; hash identifies this build.
- Acceptance remains pending: actual Windows portal navigation, SSO popup, manual resume upload, cookie persistence across restart, account-switch isolation against a real portal. No application submitted. Separate general repository CI was still running when release evidence was collected; packaging success is not a claim that every repository workflow finished.
- Use the updated desktop signed into the same MarketFit account, then Apply → Open in desktop. Opening a portal does not mark an application submitted.
