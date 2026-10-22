# Apply Horizons — the inclusive browser and what sits next to it

*Exploration, 2026-10-21. Owner directive (chat): "Explore more horizons like inclusive browser."
Method: public reference review (Electron docs, hosted-browser vendor comparisons, extension
competitor teardowns) plus our own shipped pieces (crawl adapters, ATS fingerprints, autofill
extension engine, apply-worker V1, Tsenta REA). Approval state: the exploration is approved;
each build below is proposed until the owner picks it.*

## The idea underneath all of it

The inclusive browser (Apply pillar 2) says: the user should never feel they left MarketFit
to apply. Research says that idea is bigger than one desktop feature. There are five surfaces
that can carry it, and two of them collapse the inclusive-browser decision and the auto-apply
decision into a single piece of infrastructure — exactly the fork the owner named on
2026-10-17 ("Tsenta's approach is based on that... that's the only route").

## H1 — Desktop inclusive browser, corrected for 2026

**What changed since our docs were written:** Electron deprecated `BrowserView` in
Electron 30. The replacement is `WebContentsView` on `BaseWindow`; most of the old API
(`webContents`, `setBounds`, `setBackgroundColor`) carries over unchanged. `docs/apply.md`
still says BrowserView — corrected in this change.

**Procedure (how it actually works):**
1. The desktop shell creates a `WebContentsView` with `session.fromPartition('persist:apply-<user>')`.
   A `persist:` partition stores cookies and cache on disk, so portal logins survive restarts —
   the same mechanism the Kompas session already uses through safeStorage, a separate partition.
2. "Open portal" in Apply stops opening an external tab on desktop: the web app posts the URL
   through the existing preload bridge, the shell loads it in the view, sized beside the app.
3. The shell reports navigation back through the bridge: portal-open (activity record),
   arrival on a confirmation page (candidate submission evidence — still user-confirmed,
   never auto-claimed), and download events (a tailored resume file lands in Files).
4. Popups and `window.open` from ATS pages route to additional views, never to the system
   browser, so multi-step ATS flows (Workday account creation etc.) stay inside.

**Cost/risk:** shell work only; takes effect on the owner's next desktop rebuild, like every
shell change. No per-use cost. Cannot automate anything by itself — it is the manual surface.
**Convenience moment:** tap Apply on a posting and the portal opens inside the app, already
logged in from last time.

## H2 — Hosted inclusive browser (cloud live-view) — the horizon that merges two decisions

**What it is:** a real Chromium running on hosted infrastructure (Browserbase class), with
three properties that matter: a *live view* stream a human can watch and take over, *persistent
contexts* (cookies/logins stored per user across sessions), and a CDP endpoint our existing
Playwright worker can drive.

**Procedure:**
1. Apply asks our API for a browser session for (user, portal). The API creates a hosted
   session pinned to that user's persistent context — their portal logins from last time
   are already in it.
2. The live-view URL is embedded in the Apply page. The user browses the real portal inside
   MarketFit on web and phone today — no desktop rebuild, no app install.
3. The user logs in once, by hand, inside the live view. Credentials are typed into the real
   portal page; they never pass through our servers or any model.
4. When the user taps "fill it for me", the SAME live session is handed to the apply worker
   over CDP: ATS fingerprint → field fill from the chosen resume → screenshot + receipt →
   review gate → the user taps submit themselves, or approves the worker doing it.
5. Session closes; the context (logins) persists for next time.

This is the Tsenta architecture (server-side warm workers) with the human visibly inside it —
manual browsing and auto-apply become two control levels of one session, not two products.

**Numbers (vendor comparison pages, checked 2026-10-21 — verify before committing):**
Browserbase Developer $20/mo, overage about $0.10–0.12 per browser hour, sessions up to 6h on
paid tiers, persistent contexts and session replay included. Steel: open-source runtime
(Apache-2.0) with a hosted tier, about $0.08–0.10 per browser hour at scale. A 20-minute
assisted application is roughly 0.33 browser hours — cents per application at these rates.

**Risk:** vendor dependency. Mitigation is structural: the session API is a thin seam
(create session → live-view URL + CDP endpoint). Browserbase, Steel hosted, or our own
fleet (H5) all fit the same seam. This is infrastructure scaffolding, not the product —
the product (directory, fingerprints, fill engine, receipts) is already ours.
**Convenience moment:** on your phone, tap Apply and you are inside the real portal, logged
in, with a "fill it" button — the application finishes without leaving MarketFit.

## H3 — The extension we already own, productized as the web companion

**State of play:** we already ship an autofill engine as a browser extension (real-form tested:
Greenhouse, Jobvite, JazzHR, iCIMS, Ashby and more; see the REA register autofill sessions).
Simplify's whole business (2M+ users claimed) is this exact shape: profile → detect form →
one-click fill → user reviews and submits → application auto-logged.

**Procedure for the horizon version:**
1. Apply gains "Open with companion": the posting opens in the user's own Chrome, where
   their portal logins already live — the zero-infrastructure inclusive browser.
2. The extension fingerprints the page with `src/lib/ats-fingerprints.ts` (already built from
   the portal directory) and offers the MarketFit panel: chosen resume, match %, fill button.
3. Fill runs from the same field maps the worker uses. The user reviews and submits.
4. The extension reports the submission back to the Apply tracker with the portal receipt —
   closing the loop our tracker currently takes on the user's word.

**Cost/risk:** no browser infrastructure cost at all. Constraints: desktop Chrome/Edge only,
Chrome Web Store review, and it can never run unattended (by design — it is the manual lane).
**Convenience moment:** any careers page on the whole web becomes a one-click MarketFit apply.

## H4 — Mobile inclusive browsing (when the mobile shell comes)

- **Android:** Chrome Custom Tabs share the user's Chrome cookie jar, so portal logins carry
  over with zero work; a Capacitor-style wrapper gets this through a plugin. Ephemeral Custom
  Tabs (Chrome 136+) exist for flows that must NOT share state.
- **iOS:** `SFSafariViewController` no longer shares Safari cookies the way it did pre-iOS 11;
  `ASWebAuthenticationSession` shares for auth flows. Plan for CCT-equivalent behavior on
  Android and a hosted live-view (H2) fallback on iOS, where the browser is ours anyway.

## H5 — Sovereign fleet: self-hosted Steel on a direct-internet box

The graduation path, matching the owner's competitor-not-client rule. Steel's browser runtime
is open source (Apache-2.0): the same session API as H2, hosted on a box we control (the
direct-internet server apply-worker V1 already needs). Cost becomes the box alone; the H2
seam means users notice nothing when we graduate. Volume trigger: when hosted browser hours
cost more per month than the box, move.

## Connected horizon — the Chief drives the browser

Every surface above exposes the same verbs (open, fill, screenshot, receipt). Exposing them
through the app's MCP/agent surface lets the Chief operate the user's own browser session on
instruction ("Chief, fill this one and show me before submit") — the WhatsApp approval-card
pattern applied to applications. No new infrastructure; it rides H2/H5.

## Recommended order

1. **H3 companion productization** — engine exists, zero infra, value this week.
2. **H2 hosted live-view pilot** — one vendor, one portal (a high-volume ATS), the seam
   built so H5 is a configuration change. This is also the auto-apply V2 pilot.
3. **H1 desktop WebContentsView** — folded into the next desktop rebuild cycle.
4. **H5 sovereign fleet** — when H2 volume justifies the box.
5. **H4 mobile** — with the mobile shell; Android CCT is a one-plugin decision.

## Limits of this exploration

Public sources and vendor comparison pages only; no vendor account was created, no live
hosted session was run, and pricing must be re-verified on the vendor's own page before any
commitment. No portal was browsed and no application was filled during this research.
