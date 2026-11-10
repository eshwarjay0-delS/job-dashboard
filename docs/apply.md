# Apply — Master Vision

*Owner's vision, captured 2026-10-17. This is the north star for the Apply tab. Build toward it in phases; never against it.*

## The one-liner

A centralized place where a normal user searches **contract jobs** across every prime vendor portal, picks one, and applies — without ever feeling like they left MarketFit.

## What Apply is / is not

- **Is:** a job search + apply hub for everyday users. Great UI, one search box, every contract job in one place.
- **Is not:** a firm finder. The vendor list is infrastructure, not the product. Users come to find *jobs*, not firms.

## Core principles

1. **Contract jobs only.** W2, C2C, 1099, C2H — any contract shape (temporary, long-term, contract-to-hire). No full-time perm roles. This focus is the product's identity.
2. **We ARE the aggregator, not a client of one.** Owner directive 2026-10-17: reverse-engineering Jobright/Tsenta means learning *how* they aggregate and apply — then doing it ourselves. We never link users to a middleman's job page; we host the listing and the apply flow on MarketFit. Third-party APIs are temporary scaffolding, never the product.
3. **Centralized search, decentralized apply.** We aggregate everything; the actual application happens on the vendor's own portal. We never fake an application.
4. **The user owns every application.** Nothing applies, submits, or sends without the user's explicit action — until they opt into automation (pillar 4).
5. **Double-submit guardrail everywhere.** Before any apply, check the user's submission tracker: two filings on one req = disqualification. Warn, don't block.

## The four pillars

### 1. Inclusive search (the crawler)

When the user searches "software developer", the engine spiders all vendor portals in our directory and returns software engineering contract jobs from across every site — one ranked list, not 57 tabs.

- Modeled on how Jobright AI crawls LinkedIn and job sites into one database. We do the same for prime vendor portals.
- Pipeline: scheduled crawler → per-site adapters → normalized job records (title, company, location, work type, rate if listed, posted date, source URL, vendor) → dedupe → full-text + faceted search (role, location, work type, remote).
- Work-type tagging is mandatory: every job carries W2 / C2C / 1099 / C2H. Contract-only filtering is the default view.
- Clearance-required roles are excluded by default across both the aggregated search and stored crawler lanes. Explicit `no clearance required` wording remains eligible; an internal API override does not change the default Apply experience. Evidence: `docs/research/contract-clearance-filter.md`.
- Start with the top portals by volume; expand adapter coverage over time. Adapters are isolated per site so one site's redesign never breaks the rest.

### 2. Inclusive browser (browse without leaving)

Like X/Twitter or Instagram: tap a link and the site opens *inside* the app. The user browses the vendor portal, logs in, and their login is saved — exactly like a normal Chrome browser. We are not inventing a browser; we are replaying one inside MarketFit.

Platform mapping:

| Platform | In-app browser | Cookie/login persistence |
|---|---|---|
| **Web app (now)** | New tab (job sites block iframes — no way around it) | User's own browser saves logins automatically |
| **Desktop app (Electron, exists)** | Embedded `WebContentsView` (BrowserView deprecated since Electron 30) | Persistent session partition = app-level cookie jar, survives restarts |
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

## Crawler intelligence (historical notes, first mapped 2026-10-17)

> The early probe notes below are historical. The current active registry, production counts, and source outages are reconciled in the 9 Nov 2026 checkpoint at the end of this document.

- **Collabera**: pagination is `?q=N` (server-rendered, ~49 pages), keyword/industry/location filters as query params. Adapter crawls 5 newest pages (50 jobs).
- **Beacon Hill**: listings are AJAX-only (FacetWP); page-1 gives the 10 newest daily. Pagination not cracked — revisit with headless rendering.
- **TEKsystems**: Phenom embedded JSON adapter is active; the 20 Oct live probe recorded 1,081 IT jobs across 11 requests. Current registry is the source of truth.
- **CyberSN**: JS shell — needs headless rendering, later phase.

## Jobright lessons (researched 2026-10-17, public sources)

- **Curate, don't flood.** Jobright scores every listing against the user's resume and surfaces 10–50 top matches/day. Discovery + matching is the product; raw search is the commodity. → Build: per-job match score + reasons against the filed resume.
- **Freshness is the moat — and their #1 complaint** (stale/expired listings). Our `active` flag + per-crawl recheck is exactly the defense. → Build: show "posted X days ago" prominently on every card.
- **Explain the match.** Their fit explanation ("where you line up and where you fall short") is the most praised feature. A score without reasons is noise.
- **Own a niche filter.** Their H1B/visa filter won a segment; our contract-only W2/C2C/1099/C2H tagging is the same play.
- **Close the loop in one workspace.** Find → tailor resume per JD → apply → track. The portal must not stop at search.

## Data foundation

- `src/lib/vendorPortals.ts` — 94 US IT contract staffing prime vendors (34 verified portal URLs, 56 flagged with a cybersecurity practice in the data, 6 cyber-only boutiques). Generated from `prime-vendor-portals.md` (57 firms, 2026-10-17; counts corrected that day against the file itself, were misstated as 28/39) plus the expanded edition `prime-vendor-portals-expanded.md` (37 firms #58–94: tier-1 nationals, cyber boutiques, regionals, government-contracting primes), merged 2026-10-21 with owner approval. Crawler-config hints from the expanded edition (Peraton iCIMS feed = cheapest shared adapter; gov primes ride shared iCIMS/Phenom/Workday adapters; recruiter-driven nationals are low crawl value) are recorded in `src/lib/crawl/adapters.ts`. No new adapters are claimed by the merge — a directory URL is not a working adapter.
- The Apply tab (`/dashboard/apply`) searches jobs. The directory is secondary at `/dashboard/apply/portals`.
- The agent chatbot has the `search_vendor_portals` tool — Ask MFit answers portal questions from the same data.

## Build phases

1. **Directory (done, 2026-10-17).** Apply tab + portal directory + smart search + chatbot tool.
2. **Crawler v1 (shipped; migration completed 2026-10-20).** Jobs table (`mfit_crawl_jobs` + `mfit_crawl_runs`), adapter framework, contract-only default search, and daily cron at 11:00 UTC (06:00 CDT / 05:00 CST). The production-linked database had 14,164 crawler rows and 20 run records on 2026-11-09. The last completed production run found/upserted 6,976 jobs across 21 registered adapters and reported one eTeam HTTP 404. This PR removes eTeam from the active registry until its new official interactive `/careers` page exposes a verified public feed; it remains in the vendor directory as a manual link. After release, the registry will have 20 active adapters and 10 pending/manual-only sources. The PR also adds a `last_seen_at` cutoff of 14 days to `GET /api/crawl/jobs`, matching the runner retirement window so a failed source cannot leave old records searchable indefinitely. These code changes are not live until the reviewed merge has a READY production deployment and the canonical alias points to it. Indexed search still matches bounded query terms across title, location, firm or description; the 2026-10-23 clearance boundary excludes explicit clearance requirements by default.
3. **Inclusive browser (desktop).** Electron `WebContentsView` with persistent session; "Open portal" opens in-app; logins persist like Chrome.
   *Horizons explored 2026-10-21 (`docs/research/apply-horizons.md`): the inclusive browser is five surfaces, not one — (H1) desktop WebContentsView, (H2) hosted cloud live-view whose same session the apply worker can drive (inclusive browser and auto-apply become one infrastructure), (H3) our shipped autofill extension productized as the Chrome companion, (H4) mobile Custom Tabs / hosted fallback, (H5) a self-hosted open-source browser fleet (Steel) behind the same session seam. Recommended order: H3, H2 pilot, H1 in the next desktop rebuild, H5 at volume. Builds are proposed until the owner picks one.*
4. **Resume-at-apply.** Resume picker + per-JD tailoring wired into the Apply flow.
5. **Pattern learning.** Event capture (search/view/save/apply/skip) → choice profiles → recommendations.
6. **Auto-apply (opt-in).** One-click apply against the choice profile, with full user-visible log of everything it did.

## Non-goals

- Scraping or applying to sites in ways that violate their terms — adapters respect robots/ToS; if a portal blocks us, it stays a directory link.
- Becoming a staffing firm. We never submit on the user's behalf without their action (until they explicitly opt into auto-apply).
- Full-time perm roles. Contract-only is the brand.

## Owner clarification — 17 October 2026

MarketFit serves an individual job seeker. The first screen searches **jobs**, not staffing firms. The directory remains a secondary list of source portals. The product covers W2 contracts, C2C, 1099, contract-to-hire, temporary and long-term contracts. W2 payroll alone does not establish that a job is a contract.

### Desktop journey

1. Search a role and location across connected sources; filter contract type and remote preference.
2. Compare real listings with employer, source, location, compensation when supplied, and the job description. Normalize duplicates without collapsing distinct locations.
3. Select a job; choose a saved resume or tailor an explicitly chosen baseline to that JD.
4. Apply on the source portal. On the web this opens a browser tab; in the planned desktop shell it opens a persistent, isolated browser session. Login belongs to the source site. MarketFit must never proxy passwords or claim that a cross-origin iframe is a complete browser.
5. Record portal-open separately from application-submitted. A click is not proof of submission. Allow a user-reported submission; future automatic submissions require a portal receipt.
6. Keep account-scoped activity so the user can revisit work. Build a transparent, editable preference profile from roles, locations, contract types and explicit saves/skips. Recommendations must explain why a role was selected.
7. Offer auto-apply only after the user enables it and chooses scope, resume identity, limits and stop conditions. Every attempted submission needs a visible result and evidence. Portal login, CAPTCHA, missing answers and an ambiguous resume identity pause that attempt.

### Source integration contract

Each adapter declares its source, supported filters, pagination, refresh policy, employment evidence, last successful fetch and failure reason. Crawl only available public/authorized feeds and pages; a directory URL is not a working adapter. Store source URL and source identifier alongside normalized jobs, preserve full available JD, expire closed roles, and retain provenance. Do not claim LinkedIn or Jobright crawling parity without a verified adapter. Existing job aggregators are integrations, not evidence that all listed vendor portals are crawled.

### Implementation checkpoint

Implemented in the current change: job-first Apply UI; contract evidence filtering; real-only contract results; source links; saved resume download; baseline and JD handoff to Resume; account-scoped search/view/save/portal-open/self-reported-submission activity. The portal directory lives under `/dashboard/apply/portals`.

Not implemented by this change: a crawler for every vendor, persistent embedded desktop browser, inferred choice profiles, cross-site autofill or automatic submission. Source availability still depends on the configured integrations. No live vacancy or submitted application may be fabricated to hide an unavailable source.

### Acceptance checks

- Search software developer and show jobs, not a list of firms.
- A multi-word role/skill search can find a listing when the title and description carry different query terms.
- A permanent W2 posting with no contract evidence does not qualify.
- A source outage produces an honest empty/error state, never sample jobs.
- Resume selection carries through tailoring without switching identity.
- Portal open, saved job and submitted application have distinct activity records.
- Credentials and browsing sessions never cross users or connected identities.
- Auto-apply remains off until an actual executable, tested workflow exists.


## Desktop inclusive browser implementation — 22 October 2026

### Portal-return identity repair — 23 October 2026, local validation

Return confirmation now retains the original posting ID, URL, title, company, source, location, query and selected resume. Changing the selected job or resume while a portal is open must not change the subsequent self-reported submission or receipt identity. Both web and desktop capture this snapshot. Old title-only snapshots cannot safely identify a posting and are ignored. Expired, future, malformed and non-HTTPS snapshots are ignored. Failed activity saves retain the confirmation; concurrent confirmation clicks are locked. Six focused checks and TypeScript pass. Deployment and authenticated browser acceptance are pending.

Owner renewed: Continue with rest of REA, in-app inclusive browser. Continue the approved desktop phase without selecting a paid cloud-browser provider. The Apply detail panel now has Open in desktop behind the existing duplicate-submission warning. It resolves an opaque authenticated account ID and launches marketfit-kompas://browse; no token or password is carried in that link. The native shell independently verifies the same account before opening a separate MarketFit portal window using WebContentsView. Navigation controls, isolated persistent cookies, HTTPS navigation, popup containment, cleanup and confirmed Forget logins are implemented. Closing the portal does not mark an application submitted. Manual upload uses the selected resume downloaded from Apply.

Activity parity was repaired on 2026-10-23: a validated desktop handoff now records the same account-scoped `open_portal` milestone as the web path and labels its surface `desktop`. It never records `submitted`; that still requires the user's explicit confirmation or later verifiable receipt.

This supersedes BrowserView and bookmarklet instructions in the historical design. Native source is canonical in eshwarjay0-delS/parfAct/desktop, not the legacy snapshot. The packager explicitly includes the new browser assets. Portal sessions can persist; this is not Chrome password-manager synchronization and a provider can expire or refuse a session. Web-only users retain their normal browser path. Hosted live-view, automatic filling inside the native view, mobile and automated submission are separate unfinished phases.

Verification: six simulated Electron lifecycle/isolation/navigation checks, eight existing native auth checks, native protocol/source checks, two account-context API checks, TypeScript and the full web production build passed. Windows packaging, actual portal navigation/SSO, file upload and restart/login persistence still need release and device evidence. Source REA: docs/research/inclusive-browser-desktop.md.


## Live crawler evidence and release — 10 November 2026

- PR #266 `Exclude stale crawler listings and retire eTeam's 404 feed` merged as `30bd971c97937b9dea8716b945fa3b1219b07544` from exact head `2a88796c3cb5f2955655701f203abd2fc15605b2`.
- Exact-head full CI `42735808768`, Crawler freshness regression `42735808764`, and Kompas baseline `42735808778` all completed SUCCESS.
- Production deployment `dpl_AUuJFms4osu6TPYg768Ydy5ABhCT` was READY at `30bd971`. The current canonical alias `job-dashboard-fawn.vercel.app` is independently READY at descendant `a66c108bff6175149c4aadd882ab11128445b8cc`, deployment `dpl_7gjdfRFeLjqcPdVC52NkaEatugKA`, which includes the crawler freshness fix. The newer classifier merge `f7f322f` is not yet on the production alias.
- Source registry now has 20 active adapters and 10 pending/manual-only sources. eTeam is removed from active crawling, its official careers link remains manual, and all existing records are preserved. The public jobs API applies the 14-day `last_seen_at` cutoff.
- Read-only production database snapshot at 2026-11-10 15:35 UTC: 14,566 stored rows, 12,407 active, 12,059 active within 14 days, and 348 stale active rows excluded by the API. eTeam has 907 stored/818 active rows, newest `last_seen_at` 8 Nov 11:01 UTC; the rows remain stored.
- The latest completed crawl is still the pre-change 9 Nov 11:00 UTC run: 6,976 found/upserted across 21 adapters, with one eTeam HTTP 404. The first post-change scheduled crawl has not completed yet.
- Robert Half remains pending until its official response structure is captured and tested. No adapter or live vacancy is claimed.
- The public `GET /api/crawl/jobs?limit=1` smoke remains pending because this runtime could not resolve the public Vercel hostname. Deployment control-plane status and read-only DB counts are verified; runtime API response is not.



### 10 November 2026 — work-type classifier parity

The crawler now uses the same `contractTypes()` evidence taxonomy as Apply when normalizing portal results. This recognizes the explicit `C2H` shorthand as contract work, keeps W2 payroll by itself as unknown (W2 alone is not proof of a contract), and avoids the previous broad `/temp/i` substring that could match words such as `template` or `attempt`. Permanent/direct-hire classification remains distinct, and explicit contract evidence takes precedence when a title also contains full-time wording. Existing rows are not rewritten by this source change; the next successful crawl reclassifies only listings it sees again.


10 Nov 2026 scheduled-crawl update: the 11:00 UTC run found/upserted 6,818 jobs across 20 portals with one Inspyr abort. It executed under production SHA a66c108, so the master-only contract classifier change in f7f322 was not active. The first post-release crawl remains pending; no production rows were manually changed.


## 10 November 2026 — classifier CI and manual-source boundary

The contract work-type classifier from PR #276 is merged on master as `f7f322f242d39b12a0ade7c8d548f6f48eea79b5`, but it is not production-verified: the canonical alias still serves `a66c108bff6175149c4aadd882ab11128445b8cc`. The 10 November 11:00 UTC crawl ran on that older production SHA, covered 20 portals, found/upserted 6,818 jobs, skipped eTeam, and recorded one Inspyr abort. It is not a post-classifier run.

This follow-up wires `src/lib/crawl/classify.ts` and `scripts/tests/crawl-classify.test.mjs` into the dedicated crawler workflow and runs the classifier regression beside the freshness suite. It also retargets the Robert Half directory entry to the official cybersecurity search page and asserts that Robert Half remains pending/manual-only, not an active adapter.

Robert Half's official Terms of Use, last updated 23 September 2026, prohibit automated retrieval, indexing, scraping and data mining without express prior written consent. The directory link is navigation only. No adapter, scheduled request, listing import or scrape is authorized without written permission or a sanctioned feed/API with explicit commercial-aggregation rights.

Production acceptance remains separate from source validation: deploy only a reviewed master commit when Vercel capacity allows, then verify READY on the exact merge SHA, the canonical alias, the public 14-day/clearance API behavior, and a later completed crawl using the new classifier. No stored rows are manually rewritten.


### 10 November 2026 — classifier release verified

PR #275 merged as `864cb9e906543b006ea730a8de1fa3e65b652ab9`. Production deployment `dpl_HX7moNfuc9WAnYg7iah4zYQBWQvC` is READY at that exact SHA, target production, and independent alias lookup confirms `job-dashboard-fawn.vercel.app` points to it. Git ancestry confirms the release includes PR #276's `contractTypes()` classifier and PR #282's evidence-separated exported-DOCX gap report. PR #275 is the documentation/Plan/REA handoff; it does not change WhatsApp runtime behavior.

The 10 Nov 11:00 UTC crawl occurred before this deployment on SHA `a66c108`: 6,818 found/upserted across 20 portals, eTeam absent, one Inspyr abort. It is not a post-classifier run. The first expected post-release run is 11 Nov 11:00 UTC. Public `GET /api/crawl/jobs?limit=1` and `/api/health` HTTP smoke could not be reached from this runtime, so no API response is claimed.

The restacked PR #284 adds classifier test/workflow coverage and keeps Robert Half as a manual-only directory link. Its previous exact head `147a40e` passed full CI `42853441954`, crawler regression `42853441582`, Plan/REA schema `42853441401` and Kompas baseline `42853441467`; a subsequent documentation refresh requires a new exact-head run. Vercel reports the PR preview as `build-rate-limit`; no preview is available for that branch.


## 10 November 2026 — explicit right-to-hire label normalization

The shared `contractTypes()` classifier now treats explicit `Right To Hire` / `Right-to-Hire` and `Contract To Perm` / `Contract-to-Perm` / `Contract To Permanent` engagement labels as `C2H`. INSPYR's official employment-model article states that right-to-hire is also known as contract-to-hire or temporary-to-permanent work: https://www.inspyrsolutions.com/contract-or-full-time-it-workers-which-should-you-hire/. A current INSPYR posting also uses the “Right To Hire” label and describes the role as contract-to-hire: https://www.ihiretechnology.com/jobs/view/542706863.

A read-only production aggregate found 589 active `Contract To Perm` labels (Insight Global) and 131 active `Right To Hire` labels (Genesis10 76, INSPYR 53, eTeam 2). The 10 Nov 11:00 UTC crawl predates this change. The next scheduled crawl is 11 Nov 11:00 UTC; do not claim these records were reclassified until that run is inspected.

The same snapshot contained 2,311 unknown Everforth rows. Its adapter currently exposes title, location and date only, not employment-type evidence, so these remain unknown. No classification is inferred from the vendor name. PR #291 adds positive/negative regression cases and wires `crawl-classify.test.mjs` into `prebuild`. Vercel currently reports the project `live:false` and the account blocked; no deployment or production acceptance is claimed.
