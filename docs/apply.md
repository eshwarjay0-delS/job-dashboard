# Apply — Master Vision

*Owner's vision, captured 2026-10-17. This is the north star for the Apply tab. Build toward it in phases; never against it.*

## The one-liner

A centralized place where a normal user searches **contract jobs** across every prime vendor portal, picks one, and applies — without ever feeling like they left MarketFit.

## What Apply is / is not

- **Is:** a job search + apply hub for everyday users. Great UI, one search box, every contract job in one place.
- **Is not:** a firm finder. The vendor list is infrastructure, not the product. Users come to find *jobs*, not firms.

## Core principles

1. **Contract jobs only.** W2, C2C, 1099, C2H — any contract shape (temporary, long-term, contract-to-hire). No full-time perm roles. This focus is the product's identity.
2. **Centralized search, decentralized apply.** We aggregate everything; the actual application happens on the vendor's own portal. We never fake an application.
3. **The user owns every application.** Nothing applies, submits, or sends without the user's explicit action — until they opt into automation (pillar 4).
4. **Double-submit guardrail everywhere.** Before any apply, check the user's submission tracker: two filings on one req = disqualification. Warn, don't block.

## The four pillars

### 1. Inclusive search (the crawler)

When the user searches "software developer", the engine spiders all vendor portals in our directory and returns software engineering contract jobs from across every site — one ranked list, not 57 tabs.

- Modeled on how Jobright AI crawls LinkedIn and job sites into one database. We do the same for prime vendor portals.
- Pipeline: scheduled crawler → per-site adapters → normalized job records (title, company, location, work type, rate if listed, posted date, source URL, vendor) → dedupe → full-text + faceted search (role, location, work type, remote).
- Work-type tagging is mandatory: every job carries W2 / C2C / 1099 / C2H. Contract-only filtering is the default view.
- Start with the top portals by volume; expand adapter coverage over time. Adapters are isolated per site so one site's redesign never breaks the rest.

### 2. Inclusive browser (browse without leaving)

Like X/Twitter or Instagram: tap a link and the site opens *inside* the app. The user browses the vendor portal, logs in, and their login is saved — exactly like a normal Chrome browser. We are not inventing a browser; we are replaying one inside MarketFit.

Platform mapping:

| Platform | In-app browser | Cookie/login persistence |
|---|---|---|
| **Web app (now)** | New tab (job sites block iframes — no way around it) | User's own browser saves logins automatically |
| **Desktop app (Electron, exists)** | Embedded `BrowserView` / webview | Persistent session partition = app-level cookie jar, survives restarts |
| **Mobile app (future)** | Chrome Custom Tabs / SFSafariViewController | Shares the *system* browser's cookies — logins saved with zero extra work |

The Apply page's "Open portal" links are the seam: today they open a tab; on desktop/mobile they open the inclusive browser. Same component, platform-aware behavior.

### 3. Resume at apply time

When the user hits Apply on a job, MarketFit offers its resume library:

- Pick any saved resume, **or** pick a baseline resume and generate a JD-tailored version on the spot — every single time, per job.
- The tailored resume is what goes to the portal. The user reviews it before it leaves (until auto-apply, pillar 4).

### 4. Auto-apply + pattern learning (the long game)

Everything the user does inside Apply is saved: searches, viewed jobs, saved jobs, applications, skips.

- **Pattern analysis** runs over this history and builds a *choice profile*: roles they chase, locations they accept, work types they prefer, vendors they trust, rates they take.
- **Auto-apply** (opt-in, per user): once the profile is strong, one "Auto Apply" button applies to matching jobs using the saved profile + auto-tailored resumes — the same flow as manual apply, minus the clicks.
- This only works because everything happens inside our centralized place. The database of user behavior *is* the moat.

## Data foundation

- `src/lib/vendorPortals.ts` — 57 US IT contract staffing prime vendors (28 verified portal URLs, 39 with a cybersecurity practice, 3 cyber-only boutiques). Generated from `prime-vendor-portals.md`.
- The Apply tab (`/dashboard/apply`) is the directory today and becomes the search UI as the crawler comes online.
- The agent chatbot has the `search_vendor_portals` tool — Ask MFit answers portal questions from the same data.

## Build phases

1. **Directory (done, 2026-10-17).** Apply tab + portal directory + smart search + chatbot tool.
2. **Crawler v1.** Scheduled crawl of the top ~10 portals by volume; normalized jobs table; contract-only search UI on the Apply tab.
3. **Inclusive browser (desktop).** Electron `BrowserView` with persistent session; "Open portal" opens in-app; logins persist like Chrome.
4. **Resume-at-apply.** Resume picker + per-JD tailoring wired into the Apply flow.
5. **Pattern learning.** Event capture (search/view/save/apply/skip) → choice profiles → recommendations.
6. **Auto-apply (opt-in).** One-click apply against the choice profile, with full user-visible log of everything it did.

## Non-goals

- Scraping or applying to sites in ways that violate their terms — adapters respect robots/ToS; if a portal blocks us, it stays a directory link.
- Becoming a staffing firm. We never submit on the user's behalf without their action (until they explicitly opt into auto-apply).
- Full-time perm roles. Contract-only is the brand.
