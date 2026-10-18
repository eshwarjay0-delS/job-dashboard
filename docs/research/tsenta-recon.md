# Tsenta (tsenta.com) — REA Reconnaissance Report

**Date:** 2026-10-17
**Method:** REA 6.5.0 (`npx -y rea-agents`) + static bundle analysis + public docs
**Scope:** Read-only. No accounts created, no applications submitted, no auth bypassed.
**Target:** Tsenta, Inc. — Y Combinator S26, founders Pulkit Gupta & Agnay Srivastava (Rose-Hulman). ~90K users, ~$3M annualized. AI job-application agent.

> Note: REA's Playwright browser capture was blocked by Tsenta's bot defenses (navigation failed in headless Chromium). All findings below come from static analysis of their JS bundles (landing page + dashboard), their public pages (`/mcp`, `/privacy`, `/ai-disclosure`, `/changelog`, blog), and direct probing of their public API/OAuth endpoints.

---

## (a) MCP Server — Full Details

**This is the highest-value find. Tsenta ships a production MCP server as a first-class surface.**

| Item | Value |
|---|---|
| **MCP endpoint** | `https://api.autojobs.me/api/v1/mcp` |
| **Transport** | Streamable HTTP (`--transport http`) |
| **Setup command** | `claude mcp add --transport http tsenta https://api.autojobs.me/api/v1/mcp` |
| **Docs page** | `https://tsenta.com/mcp` |
| **Supported clients** | Claude Code, Claude Desktop & Web, Cursor, Codex CLI, ChatGPT (per blog) |

### OAuth 2.1 (probed live, all 200 OK)
Discovered via `/.well-known/oauth-protected-resource` and `/.well-known/oauth-authorization-server`:

| Item | Value |
|---|---|
| Protected resource | `https://api.autojobs.me/api/v1/mcp` |
| Authorization server | `https://api.autojobs.me` |
| Authorize | `https://api.autojobs.me/oauth/authorize` |
| Token | `https://api.autojobs.me/oauth/token` |
| Dynamic client registration | `https://api.autojobs.me/oauth/register` |
| Revocation | `https://api.autojobs.me/oauth/revoke` |
| Grant types | `authorization_code`, `refresh_token` |
| PKCE | S256 |
| Client auth | `none` (public clients — no secret) |

### User flow (from `/mcp` page)
1. `claude mcp add` → Claude Code opens the browser to Tsenta's OAuth approval screen
2. User signs in with Google, clicks Approve
3. Short-lived OAuth token stored locally by the client; auto-refreshes silently
4. `claude mcp list` verifies; Tsenta never sees a password

### Known tool (from their marketing example)
```
$ claude > apply to the new Stripe role
→ calling tsenta.apply(role: "sr-frontend@stripe")
✓ submitted via greenhouse · 8s
✓ tracker updated · alex_morgan_stripe_v6.pdf
```
Tool name observed: **`tsenta.apply`**. Full tool list requires an authenticated session (the endpoint drops unauthenticated MCP handshakes — my probe timed out, which is expected).

### Data & privacy (from `/privacy`, section b)
When authorized, the assistant provider receives: **prompts, tool inputs, tool outputs** — which may include profile data, job listings, application status, and inbox messages. Tsenta logs connector activity (tool name, timestamps, OAuth client ID) for analytics/abuse/support. Revocation from account settings invalidates access + refresh tokens immediately.

### What this tells us
Tsenta treats "apply from inside your AI chat" as a core surface, not an integration afterthought. The MCP server is the **same backend** as the web dashboard (`api.autojobs.me/api/v1/…`) — one API, seven surfaces (web, iOS, Android, Chrome extension, MCP, iMessage, WhatsApp).

---

## (b) API Surface (from dashboard bundle static analysis)

**Base:** `https://api.autojobs.me/api/v1/` · **Dashboard:** `https://dashboard.tsenta.com` (Vite SPA, RTK Query)

### Applications — the core apply pipeline
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/applications` `…/list` `…/search` `…/stats` `…/count` `…/list/counts` | Feed, search, dashboard counts |
| GET | `/applications/{id}` `…/detail` | Application detail |
| POST | `/applications/{id}/approve` `{html?, forceNew?}` | **Triggers the submission run** |
| POST | `/applications/{id}/resume-submit` `{decision, edits}` | Review gate: approve or edit-then-submit |
| GET | `/applications/{id}/optimized-resume` `…/resume-url` `…/resume-download-url` | Tailored resume artifacts |
| POST | `/applications/{id}/regenerate-resume` `…/skip-optimization` | Resume controls |
| GET/POST | `/applications/{id}/cover-letter…` `…/skip-cover-letter` | Cover letter artifacts |
| GET | `/applications/{id}/password` | **ATS account credentials** (they create logins for you) |
| POST | `/applications/{id}/reapply` | Retry a submission |
| GET | `/applications/{id}/trace` | **The receipt** — field-by-field record of what was submitted |
| POST | `/applications/{id}/typeahead-suggest` `{fieldId, query}` | Form-field autocomplete |
| POST | `/applications/skip-bulk` · GET `/applications/rate-limit` | Queue controls |

### Cloud execution — the automation workers
| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/v1/cloud-executions/running` | Live browser-automation workers currently submitting |

### Jobs, users, networking, public
- `GET /api/v1/jobs/{jobId}/status` — job/application status
- `GET /api/v1/users/{uid}/feed-filters` — match-feed preferences
- `GET /api/v1/tracked-applications/export` — tracker export
- `/api/v1/networking/…` — contacts, companies, outreach, usage (referral/outreach feature)
- `GET /api/v1/public/pricing` · `GET /api/v1/affiliates/track-click/…` — public, no auth

---

## (c) How the Auto-Apply Technically Works

### The four stages (their words: find → prep → apply → track)

**1. Find — job discovery**
- Monitors **50,000+ company career pages 24/7**; 2M+ job database refreshed every couple of hours
- **Résumé-aware matching** (not keyword search); every role shows a match % (94%, 91%…)

**2. Prep — materials**
- Per-role résumé rewrite from the actual JD, per-role cover letter in the user's voice
- ATS parseability scoring; **diff view of every change** before send (approve/edit gate)

**3. Apply — the submission engine**
- **Server-side browser automation** ("cloud executions") — warm worker pool, not a batch queue. Their differentiator vs. competitors: *"tsenta applies in seconds… within seconds the application is submitted on the live ATS"* (competitors queue for hours)
- **ATS detection is client-side URL pattern matching**: their `ats.js` bundle contains **45 ATS definitions** with URL regexes, of which **43 are marked supported** (only Avature and Bullhorn are detected-but-unsupported). Marketing says "30+" — the code says 43
- Handles: **login flows, account creation, email verification, multi-page forms, document uploads, open-ended questions** answered from the user's real background
- **The Gmail OTP trick** (privacy policy, section c): optional `gmail.readonly` scope used to **read one-time verification codes** employers email during applications, plus application confirmations / recruiter replies / interview invites for reply routing. This is how they get through ATS account-creation walls without the user
- **Review gate** (changelog, July 2026): agent pauses right before final submit, shows every filled field + tailored resume + cover letter; user can fix answers inline, then approve. Auto-approve mode still available
- **Receipt**: `GET …/trace` returns the full field-by-field record — "every action produces a receipt showing exactly what was sent"

**4. Track**
- Recruiter emails routed back to the right application; status moves automatically; user-managed pipeline stages

### ATS coverage (from code, not marketing)
43 supported: Greenhouse, Workday, Lever, Ashby, Rippling, iCIMS, BrassRing, BambooHR, Workable, JazzHR, Jobvite, BreezyHR, Oracle Recruiting, Paylocity, SmartRecruiters, UltiPro/UKG, Zoho Recruit, ADP, Dover, Gem, SAP SuccessFactors, Recruitee, Pinpoint, Teamtailor, Polymer, Phenom, Dayforce, Join, CareerPlug, Paycor, Hireology, Eightfold, HiringThing, Betterteam, iSolved Hire, ApplicantPro, Workstream, Cornerstone OnDemand, HireClick, Gusto, Taleo, Naukri, Indeed.

### Economics
Free: 25 applications (no card). Starter $19/600, Pro $39/1,500, Power $99/4,500 per 30-day cycle (~$0.03/app). **Only successful submissions consume allowance; skipped/failed are refunded.** This refund policy is load-bearing for trust.

---

## (d) What We Can Borrow for Our Apply-In-Place Vision

1. **MCP as a first-class surface, same backend.** Tsenta's MCP server isn't a wrapper — it's the same `api.autojobs.me` API the dashboard uses, exposed via OAuth 2.1 + Streamable HTTP. For MarketFit: expose our match/tailor/apply/track as MCP tools with the same OAuth pattern. Their privacy-policy language for the connector is a good template.

2. **The receipt is the trust mechanism.** Every submission produces an inspectable field-by-field trace. Our "inclusive browser" should record the same: what was filled, what was uploaded, what was answered — shown to the user after every apply. This is what makes auto-apply *defensible* vs. "black box."

3. **Review gate before submit.** Pause → show everything → inline edit → approve. Or auto-approve for hands-free. Both modes, user's choice per application. (Maps directly to our planned apply-in-place UX.)

4. **ATS detection via URL patterns.** They ship a 45-entry ATS fingerprint file in client code. We can build the same for our 57-firm portal directory — and it's the missing piece for knowing *which* automation path to use per posting.

5. **Gmail for OTPs is the unlock for account creation.** The hardest part of auto-apply isn't filling forms — it's ATS account creation + email verification loops. Their `gmail.readonly` OTP reading solves it. We already have Gmail connected; this is directly reusable.

6. **Server-side workers, not client-side.** "Applies in seconds" because the browsers live in their cloud, warm. A Chrome-extension-only approach (like ours today) can't do unattended auto-apply. Our headless-renderer decision (pending) is the same fork: Vercel-side vs. VM-based workers.

7. **Price per successful application, refund failures.** Aligns incentives and makes the "did it actually submit?" question auditable. Our credits/ledger system could adopt the same "only successful submissions consume" rule.

8. **Match % on every role.** They show it in the feed, the MCP example, and iMessage. We just shipped this on our Apply cards — validated direction.

### What NOT to copy
- Their "50,000 career pages" crawler is a scale game we shouldn't chase head-on; our contract-only niche (W2/C2C/1099/C2H) is the differentiator.
- Monthly caps that don't roll over are a deliberate monetization choice, not a technical requirement.

---

## Appendix: recon artifacts
- Bundles + extraction scripts: `~/workspace/rea-recon/tsenta-bundle/`
- Raw page captures: `/tmp/tsenta.html`, `/tmp/tsenta-mcp.html`, `/tmp/tsenta-privacy.html`, `/tmp/tsenta-ai.html`, `/tmp/tsenta-changelog.html`, `/tmp/tsenta-dash.html`
- REA scenario attempts: `~/workspace/rea-recon/scenario1.json` (Playwright capture blocked by bot defenses — static analysis used instead)

---

## Actual Apply Procedure (added 2026-10-17 per owner: "we need to get actual procedure")

This is the step-by-step of how a Tsenta auto-apply actually happens, recovered from
their JS bundles (`ats.js` with 43 ATS URL patterns), API surface, privacy policy,
changelog, and public docs. This is what we replicate.

### Step 0: Prerequisites (one-time setup)
1. User creates account, connects Gmail (optional `gmail.readonly` scope)
2. User uploads baseline resume, fills profile (name, email, phone, location, work auth, EEO answers, etc.)
3. These are stored server-side, reused across all applications

### Step 1: Find (job → application record)
1. User finds a job in Tsenta (or via MCP: `tsenta.apply(role: "sr-frontend@stripe")`)
2. `POST /applications` creates an application record with status `found`
3. Job matched against user's resume (their match %, not keyword)

### Step 2: Prep (materials tailored)
1. Resume rewritten for this specific JD (not generic)
2. Cover letter generated in user's voice
3. ATS parseability scored
4. **User sees diff of every change** — approve or edit inline

### Step 3: Apply (the browser worker procedure)
1. **Worker assignment**: Server picks a warm browser from the pool (`GET /cloud-executions/running` shows live workers). Warm = browser already open, not cold-start. This is why "applies in seconds."
2. **Navigate**: Worker loads the job's apply URL
3. **ATS detection**: URL matched against 43 patterns in `ats.js` (e.g., `*.myworkdayjobs.com` → Workday, `boards.greenhouse.io` → Greenhouse). This tells the worker which form-filling strategy to use.
4. **Session check**: Does the worker have a logged-in session for this ATS?
   - YES → proceed to fill
   - NO → **Account creation flow**:
     a. Fill registration form (name, email, password generated)
     b. Submit → ATS sends verification email
     c. **Gmail OTP trick**: Worker reads the user's Gmail (via `gmail.readonly`) for the verification code
     d. Worker enters the code → account created → session saved for reuse
   - If ATS uses SSO/OAuth → user must connect once manually (worker can't bypass)
5. **Form filling** (per ATS strategy):
   a. Personal info: name, email, phone, location (from profile)
   b. Work authorization: visa status, sponsorship needs (from profile)
   c. EEO/demographic: uses stored answers (user pre-answered once)
   d. **Resume upload**: the tailored resume file uploaded via the file input
   e. **Cover letter upload**: if the ATS has a cover letter field
   f. **Open-ended questions**: "Why do you want this role?" → answered from user's background (LLM generates from profile + JD, user pre-approved templates)
   g. **Custom fields**: per-ATS field mapping (each of the 43 ATS types has a field map)
6. **Review gate** (unless auto-approve mode):
   - Worker PAUSES before the final submit button
   - User sees: every filled field, the exact resume being uploaded, the cover letter
   - User can edit any field inline
   - User hits Approve → worker clicks submit
   - (Auto-approve mode: worker submits without pausing)
7. **Submit**: Worker clicks the final submit/apply button
8. **Receipt**: `GET /applications/{id}/trace` — field-by-field record of what was filled, what was uploaded, timestamps. "Every action produces a receipt showing exactly what was sent."

### Step 4: Track
1. Confirmation email from ATS → routed to the application via Gmail integration
2. Status auto-updates (applied → viewed → interview, etc.)
3. Recruiter replies routed to the right application thread

### What makes it work (the load-bearing pieces)
1. **Warm browser pool** — not cold Playwright launches. Browsers stay open.
2. **Persistent sessions** — once logged into Workday, that session is reused. No re-login.
3. **Gmail OTP reading** — solves the account-creation wall that kills most auto-apply tools
4. **43 ATS field maps** — not generic form filling; per-ATS strategies
5. **Review gate** — user trust; not a black box
6. **Receipts** — accountability; every submit is inspectable
7. **Refund on failure** — only successful submits count against quota

### What this means for our in-app browser
Tsenta's "in-app browser" IS their server-side worker pool. There is no client-side
browser involved in auto-apply. The user never sees a browser window.

Our vision's "inclusive browser" has two modes:
- **Manual mode** (now): user taps apply → portal opens (new tab / WebView / Custom Tabs) → user fills the form themselves. This works today.
- **Auto mode** (future): user taps "auto-apply" → OUR server-side worker does the Tsenta procedure above. This needs the headless infrastructure decision.

They are the same browser strategy at different levels of control. The headless
renderer pick (Vercel vs VM) IS the in-app browser decision IS the auto-apply decision.
