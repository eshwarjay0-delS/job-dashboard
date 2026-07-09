# CareerKit — Full Application Reference

> Comprehensive reference for every page, feature, API route, library, and design decision in the CareerKit codebase. Written for deep technical understanding without sharing source code.

---

## 1. What CareerKit Is

CareerKit is a full-stack AI-powered job search automation platform. Its core value proposition is reducing the friction of a job hunt to near zero: a candidate uploads their resume once, and every subsequent job application gets a tailored, ATS-optimised version of that resume generated in roughly 12 seconds via the Anthropic Claude API. On top of that, a Chrome extension auto-fills application forms and scrapes job descriptions directly from job boards, a built-in job board aggregates live postings with visa/work-auth filtering, a Kanban pipeline tracks every application, and Gmail integration surfaces recruiter emails directly in the dashboard.

---

## 2. Technology Stack

### Runtime & Framework
- **Next.js 16 (App Router)** — the entire application is a single Next.js project using the App Router (`src/app/`). Server Components handle data fetching; Client Components handle interactivity. The `"use client"` directive is used at the top of any file that uses React hooks, browser APIs, or event handlers.
- **React 19** — UI library.
- **TypeScript 5** — entire codebase is fully typed.
- **Node.js** — all API routes use `export const runtime = "nodejs"` to access the file system.

### Styling
- **Tailwind CSS v4** — utility classes for layout and spacing. A custom PostCSS plugin (`@tailwindcss/postcss`) handles compilation.
- **CSS Custom Properties (CSS variables)** — the design system is entirely token-based. Variables like `--accent`, `--text`, `--surface`, `--border` are defined globally and referenced by every component via `style={{ color: "var(--text)" }}`. This allows runtime theme switching without re-rendering.
- **Inline styles** — used for all colour/visual properties so that CSS specificity is fully predictable. Tailwind classes handle only layout (flex, grid, spacing, responsive breakpoints).

### Design Tokens (Palette)
```
Background:    #f4f6f9
Surface:       #ffffff
Surface alt:   #f4f6f9
Text:          #1a2035
Text muted:    #6b7a99
Text hint:     #9aa4bc
Border:        #e4e8ef
Accent:        #1d6fc4   (CareerKit blue)
Accent dark:   #1558a0
Accent soft:   #eff6ff
Accent border: #bfdbfe
Green:         #16a34a
Green soft:    #f0fdf4
Red:           #dc2626
Gold:          #d97706
```

### Authentication & Database
- **Supabase** — handles both authentication (email/password + OAuth) and the Postgres database.
  - `@supabase/supabase-js` — JavaScript client.
  - `@supabase/ssr` — server-side Supabase client for Next.js App Router (reads/writes cookies for session management).
  - Three client wrappers: `src/lib/supabase/client.ts` (browser), `src/lib/supabase/server.ts` (RSC + API routes), `src/lib/supabase/update-session.ts` (middleware session refresh).
  - Supabase stores user profiles (`profiles` table) with fields: full_name, phone, whatsapp, location, linkedin, github, portfolio, title, bio, visa_status, work_auth, skills, remote_ok, relo_ok, salary_min, salary_max, open_to_roles, job_types, profile_complete.

### AI / LLM
- **Anthropic Claude API** — powers all AI features. The model used is Claude Sonnet.
  - `src/lib/claude.ts` — the primary adapter. Calls Claude with a structured prompt containing the resume's zone-parsed content, the full job description, extracted JD keywords, and any stored user preferences. Returns structured edits (headline, tagline, summary, bullet rewrites, skill line rewrites).
  - `src/lib/llm.ts` — a lower-level wrapper for direct LLM calls used by other features (profile extraction, AI assistant).
  - The Claude API key is configurable per-user (stored in `localStorage` under `jd_settings`) or falls back to `ANTHROPIC_API_KEY` from `.env.local`.

### Document Processing
- **JSZip 3** — reads and writes `.docx` files (which are ZIP archives containing XML). Used in `src/lib/docx.ts` to parse and reconstruct Word documents.
- **mammoth 1.12** — converts `.docx` to HTML for the browser-side PDF preview. Uses a custom `styleMap` to preserve heading hierarchy (Heading 1 → `<h1>`, Heading 2 → `<h2>`, etc.).
- **sharp** (dev dependency) — image processing for Next.js Image Optimisation.

### File Storage
- All resumes are stored **locally on the server's file system** at `data/user-resumes/<userId>/`. No cloud storage is used.
- Tailored output files are saved temporarily at `data/tailored/<token>.docx` and served on-demand by `/api/tailor/file`.
- When not authenticated, a `"demo"` user ID is used as the fallback folder, allowing the dashboard to be viewed without login.

### External APIs used in the app
- **Adzuna API** — job search. `GET /api/jobs` proxies queries to Adzuna's search endpoint, applying visa/work-auth filters client-side.
- **Clearbit Logo API** (`logo.clearbit.com/<domain>`) — fetches real company logos in the dashboard job feed and recruiter messages section. Falls back to a coloured initials badge on error.
- **Pravatar API** (`i.pravatar.cc/<size>?img=<n>`) — realistic human avatar photos for recruiter messages and testimonials.
- **Unsplash** — hero/carousel images on the public landing page and login page, referenced via stable CDN URLs (`images.unsplash.com/photo-<ID>?w=N&h=N&fit=crop`).

---

## 3. Application Structure

```
src/
  app/
    page.tsx                        ← Public landing page
    login/page.tsx                  ← Login page
    signup/page.tsx                 ← Sign up page
    auth/callback/route.ts          ← Supabase OAuth callback
    auth/callback/drive/route.ts    ← Google Drive OAuth callback
    dashboard/
      layout.tsx                    ← Shared nav + shell
      page.tsx                      ← Dashboard home
      nav-links.tsx                 ← Navigation tab component
      template-selector.tsx         ← Theme switcher
      resume/
        page.tsx                    ← Tailor Resume (server)
        ResumeClient.tsx            ← Tailor Resume (client)
        LibraryTree.tsx             ← File tree component
        ResumeBuilder.tsx           ← Manual resume builder
        result/page.tsx             ← Tailoring result view
      documents/
        page.tsx                    ← Documents (server)
        DocumentsClient.tsx         ← Documents (client, upload + library)
      applications/page.tsx         ← Job Tracker / Kanban
      analytics/page.tsx            ← Analytics dashboard
  api/
    health/route.ts                 ← Connectivity ping
    jobs/route.ts                   ← Job search (Adzuna)
    tailor/route.ts                 ← AI resume tailoring
    tailor/file/route.ts            ← Download tailored file (docx/pdf/html)
    resumes/route.ts                ← Resume CRUD (upload, list, delete)
    resumes/move/route.ts           ← Move resume to folder
    resumes/folder/route.ts         ← Create folder
    resumes/download/route.ts       ← Download original resume
    resumes/pdf/route.ts            ← Generate PDF from resume
    user-resumes/route.ts           ← User-scoped resume operations
    profile/route.ts                ← User profile (get/save + extract from resume)
    profile/extract/route.ts        ← Extract profile fields from docx
    feedback/route.ts               ← Store/retrieve tailoring preferences
    assist/route.ts                 ← AI assistant (free-text prompts)
    build/save/route.ts             ← Resume builder save
    build/load/route.ts             ← Resume builder load
    contact/route.ts                ← Contact form
    test-match/route.ts             ← Dev: test keyword matching
    test-docx/route.ts              ← Dev: test docx processing
  lib/
    supabase/client.ts              ← Browser Supabase client
    supabase/server.ts              ← Server Supabase client (RSC/API)
    supabase/update-session.ts      ← Middleware session refresh
    claude.ts                       ← Anthropic Claude adapter (tailoring)
    llm.ts                          ← Generic LLM wrapper
    docx.ts                         ← DOCX parse/edit/reconstruct (JSZip)
    profile.ts                      ← Extract structured profile from docx
    keywords.ts                     ← JD keyword extraction + resume matching
    feedback.ts                     ← Read/write per-category tailoring prefs
    google-auth.ts                  ← Google OAuth token management
    drive.ts                        ← Google Drive integration
extension/
  manifest.json                     ← Chrome Extension Manifest V3
  popup.html                        ← Extension popup UI
  popup.js                          ← Popup logic
  content.js                        ← Content script (JD scraping + form fill)
  background.js                     ← Service worker
  icons/                            ← Extension icons (16px, 48px, 128px)
data/
  user-resumes/<userId>/            ← Uploaded resume files per user
  tailored/                         ← Temporary tailored output files
```

---

## 4. Pages — Detailed Walkthrough

### 4.1 Public Landing Page (`/`)

**Purpose:** Marketing page that introduces CareerKit to prospective users and drives signups.

**Structure:**
- **Navigation bar** — white, sticky, logo left, "Log in" and "Get started free" buttons right.
- **Hero section** — large headline, subheadline, primary CTA ("Start for free"), and a rotating photo carousel. The carousel cycles through 5 Unsplash images representing professional scenarios (interview, networking, working, team meeting, career success). Images auto-advance every 4 seconds with a fade + scale transition.
- **Feature sections** — alternating left/right layout blocks describing AI tailoring, the Chrome extension, job tracking, and Gmail integration.
- **Stats band** — social proof numbers (resumes tailored, time saved, match score improvement).
- **CTA band** — soft blue-to-green gradient section with a final signup prompt.
- **Footer** — links, tagline, copyright.

**Key design decisions:**
- All backgrounds are light (`#f4f6f9`, `#ffffff`, `#f0f9ff`). No dark colours.
- Top of the page has a 4px solid blue accent bar.
- Section backgrounds alternate: white → `#f4f6f9` → white.

---

### 4.2 Login Page (`/login`)

**Purpose:** Authenticate returning users.

**Structure:**
- **Two-column layout** — left panel (60% width) is a full-height background image from Unsplash (professional office/people photo) with a blue overlay gradient, a testimonial quote from a fictional user, and a stacked avatar row (3 avatars from Pravatar). Right panel (40% width) is a white form.
- **Form** — email + password inputs, "Welcome back 👋" heading, Google OAuth button with hover animation, "Forgot password" link, link to sign up.
- Auth is handled by Supabase via Server Actions.

---

### 4.3 Sign Up Page (`/signup`)

**Purpose:** Register new users.

**Structure:** Identical two-column layout to login. Form includes name, email, password. After signup, Supabase sends a confirmation email; the OAuth callback is handled at `/auth/callback`.

---

### 4.4 Dashboard Layout (`/dashboard/*`)

**Purpose:** The shared shell wrapping all authenticated pages.

**Components:**
- **Top navigation bar** — sticky, always white (`#ffffff`), `z-index: 200`. Contains:
  - CareerKit logo (gradient blue square, "CK" text).
  - Desktop nav links (hidden on mobile via `md:flex`).
  - Theme selector (template switcher for accent colour).
  - User avatar initials badge.
  - "Upgrade" button.
- **Mobile nav strip** — appears below the header on small screens (`md:hidden`). Horizontal scrollable row of nav links. **Important implementation note:** the outer `<div>` uses only the `md:hidden` className to control visibility; a separate inner `<div>` carries `display:flex` via inline style. This separation is critical — if `display:flex` were on the outer div as an inline style, it would override the Tailwind `hidden` class at all breakpoints, causing a double navigation bug.
- **Nav tabs:** Find Jobs (`/dashboard`), Tailor Resume (`/dashboard/resume`), Documents (`/dashboard/documents`), Job Tracker (`/dashboard/applications`), Analytics (`/dashboard/analytics`).
- **Main content area** — `max-width: 1320px`, centred, `padding: 32px`.

**Active tab detection logic:**
- "Find Jobs" is active only on exact path `/dashboard`.
- "Tailor Resume" is active on `/dashboard/resume` and all sub-paths (`/dashboard/resume/result`, etc.) but NOT on `/dashboard/documents`.
- All other tabs use `startsWith` matching.

---

### 4.5 Dashboard Home (`/dashboard`)

**Purpose:** The command centre. Shows stats, feature promotions, recruiter messages, and a live job board.

**Sections (top to bottom):**
1. **Hero banner** — greeting, subtitle, "Find Jobs" and "Tailor Resume" quick-action buttons.
2. **Stat cards row** — 4 cards: Tailored Resumes count (from `localStorage`), Response Rate (from `jd_applications_v2`), Active Applications, Average Match Score. Each card has a coloured icon, large number, sub-label, and a subtle coloured glow.
3. **PowerCard** — a single wide card with two halves separated by a 1px gradient divider:
   - **Left half (Tailor Resume):** "✦ Tailor Resume · ⚡ 12 sec" badge, a JD textarea, "Tailor Now →" button. On submit, saves the JD to `sessionStorage` under `careerkit_quick_jd` and navigates to `/dashboard/resume` where the JD pre-fills automatically.
   - **Right half (Auto-fill Extension):** "● Chrome Extension · Auto-fill" badge, browser mockup illustration, ATS platform chips (LinkedIn, Greenhouse, Workday, Lever, Indeed), green "Install Extension" CTA button.
4. **Gmail Banner** — full-width white card. Left side has a "Connect Gmail" CTA (red button). When clicked, toggles to a "✓ Connected" green pill. Right side shows 6 feature chip pills: Gmail sync, Smart alerts, Push notifications, Auto-track applications, Response analytics, AI email drafts.
5. **Recruiter Messages** — 4 cards showing mock recruiter outreach. Each card shows: company logo (Clearbit), recruiter avatar (Pravatar), company name, role, salary range, location/remote tag, message preview, time stamp, category badge (Reply needed, Interview, Remote-friendly, etc.), and action buttons (Reply, View Job, Save).
6. **Job Board** — live search powered by `/api/jobs` (Adzuna). Features: keyword input, location input, work-auth filter (H-1B, Green Card, OPT/CPT, W2, C2C), remote toggle, search button. Results show as job cards with company logo (Clearbit), role, company, location, salary, date posted, and a "Quick Apply" / "Save" button.

**Data persistence:** Stat cards read from `localStorage`. Application counts come from `jd_applications_v2` key. Tailor count comes from `jd_tailor_log` key.

---

### 4.6 Tailor Resume (`/dashboard/resume`)

**Purpose:** The core product feature. User selects a resume from their library, pastes a job description, and gets an AI-tailored `.docx` in seconds.

**Architecture:** Server Component (`page.tsx`) reads the file system, passes data as props to a Client Component (`ResumeClient.tsx`).

**Layout:**
- **Step progress bar** — 3 steps: (1) Select Resume, (2) Job Description, (3) AI Tailoring. Steps light up as the user completes them.
- **Left column (2/5 width):** Read-only resume picker showing the library as a `LibraryTree`. A "Manage files →" link points to Documents. An empty state with a "Go to Documents →" CTA shows when the library is empty. **Upload functionality is NOT present here** — it was deliberately removed to keep this page focused on tailoring only.
- **Right column (3/5 width):**
  - Auto-match toggle — when on, Claude selects the best-matching resume from the library based on JD keywords. When off, the user must manually select a resume.
  - Live match indicator — as the user types in the JD, a keyword-category matcher shows which resume category best matches (e.g. "Cloud Security", "DevSecOps").
  - JD textarea — large input for pasting the job description.
  - One-page toggle — tells Claude to keep the output to one page.
  - Preferences textarea — optional custom instructions passed to Claude.
  - "Tailor Resume →" button — triggers the `/api/tailor` POST request.
  - Progress messaging during the tailoring call (typically 15–30 seconds).

**Pre-fill from dashboard:** If the user clicked "Tailor Now" in the dashboard PowerCard, the JD is pre-populated from `sessionStorage` key `careerkit_quick_jd`.

---

### 4.7 Tailor Result (`/dashboard/resume/result`)

**Purpose:** Shows the tailoring outcome after a successful `/api/tailor` call.

**Sections:**
- **Score display** — shows ATS match score before and after tailoring (e.g. "74% → 93%"). Score is computed by measuring what percentage of the JD's extracted technical keywords appear in the tailored resume.
- **Match confidence ring** — a circular SVG progress ring coloured green (≥90), blue (≥80), or amber (<80).
- **Which resume was used** — shows the filename and category of the resume Claude selected or the user chose.
- **Keyword chips** — technical keywords from the JD that appear in the tailored resume.
- **What changed list** — bullet points generated by Claude describing what was updated (e.g. "Rewrote 4 experience bullets to match the JD", "Updated 2 skill lines with the role's key tools").
- **Download buttons** — `.docx` (primary, recommended) and PDF (simplified HTML print view).
- **Feedback panel** — thumbs up/down per change, plus a free-text notes field. Feedback is stored via `/api/feedback` and fed back into future tailoring calls for that resume category.
- **Re-tailor button** — allows tweaking preferences and running again.

**Background:**
- All colours use light palette tokens. Former dark gutter (`rgba(0,0,0,0.18)`) replaced with `#e4e8ef`. Box shadows use `rgba(26,32,53,...)` instead of `rgba(0,0,0,...)`.

---

### 4.8 Documents (`/dashboard/documents`)

**Purpose:** Resume file library manager. The only place in the app where users can upload, organise, and delete resumes.

**Architecture:** Server Component (`page.tsx`) scans the file system, Client Component (`DocumentsClient.tsx`) handles all interactivity.

**Features:**
- **Upload drop zone** — full-width dashed border area. Accepts `.docx` files and `.zip` bundles. Drag-and-drop supported. ZIP files are auto-extracted — each `.docx` inside is imported as a separate resume.
- **Duplicate detection** — if an uploaded file has the same name as one already in the library, a confirmation dialog asks the user whether to replace it.
- **Library tree** — displays resumes organised by folder in a collapsible tree (`LibraryTree` component). Each file shows: name, category (derived from folder path), size, last modified date, and a download button.
- **Checkbox selection** — each file has a checkbox. Selecting multiple files enables bulk actions.
- **Bulk actions:** Move (prompt for destination folder path), Delete (with confirmation).
- **New Folder button** — creates a subdirectory via `/api/resumes/folder`.
- **Refresh button** — calls `router.refresh()` to re-run the server component.
- **"Tailor a Resume →" button** — links back to the Tailor tab.

**File system layout:** Folders in the file system become categories in the UI. A file at `data/user-resumes/demo/CloudSecurity/resume.docx` shows with category "CloudSecurity".

---

### 4.9 Job Tracker (`/dashboard/applications`)

**Purpose:** A Kanban board for tracking job applications through the hiring pipeline.

**Pipeline stages (columns):** Applied → Screening → Interview → Technical → Offer → Rejected. Each stage has a distinct colour.

**Card fields per application:** Company, Role, Location, Remote flag, Salary range, Stage, Applied date, Notes, Job URL, Visa/Work Auth type, Priority (High/Mid/Low).

**Views:**
- **Kanban (Board)** — horizontally scrollable columns with application cards. Each card shows: company initials badge (colour-coded by company name hash), role, company, location + salary, visa badge, days-since-applied, priority dot. Clicking a card expands it to show notes, "Move to" stage buttons, and Edit/Delete/Open job actions.
- **List view** — a table with Company/Role, Stage badge, Salary, Visa, Applied date, and an inline stage-change dropdown.

**Data persistence:** Stored in `localStorage` under key `jd_applications_v2`. Pre-populated with 12 sample applications on first load (real company names, realistic roles and salaries).

**Add/Edit modal** — a full-screen modal with all fields. Required: Company, Role. Optional: Location, Salary, Visa, Priority, Job URL, Notes, Remote checkbox.

---

### 4.10 Analytics (`/dashboard/analytics`)

**Purpose:** Visual reporting on job search performance. Reads from the same `jd_applications_v2` localStorage data as the Job Tracker.

**Charts and visualisations (all built from scratch, no chart library):**
- **KPI row** — 4 stat cards: Total Applied, Active Pipeline, Response Rate (% that progressed beyond Applied), Offers.
- **Bar chart** — applications by stage. Pure CSS height calculation, no canvas or SVG library.
- **Conversion funnel** — shows stage-to-stage conversion percentages with downward arrows between each stage box.
- **Sparkline** — weekly application volume over the last 8 weeks. Built as an SVG polyline with a gradient fill beneath the line.
- **Priority breakdown** — horizontal progress bars for High/Mid/Low priority mix.
- **Work Auth mix** — horizontal progress bars for the top 5 visa/work-auth types across all applications.

**Empty state:** When no applications are tracked, shows a friendly prompt to start tracking.

---

## 5. API Routes — Detailed Reference

### `GET /api/health`
Returns `{ ok: true, app: "CareerOS", ts: <timestamp> }`. Used by the Chrome extension to verify the app is reachable before showing the tailor UI.

---

### `GET /api/jobs`
Proxies to the Adzuna job search API. Accepts query params: `q` (keywords), `location`, `page`. Returns job listings with title, company, description, salary, location, URL, posted date. If Adzuna is unreachable or the API key is missing, returns a set of hardcoded sample jobs to allow the UI to function during development.

---

### `POST /api/tailor`
The core AI tailoring endpoint. Most complex route in the app.

**Request body:** `{ jd, filepath, claudeKey, onePage, immediatePrefs }`
- `jd` — the full job description text.
- `filepath` — optional path to a specific resume file. If empty, auto-selection runs.
- `claudeKey` — optional per-user Anthropic API key. Falls back to `ANTHROPIC_API_KEY` env var.
- `onePage` — boolean; instructs Claude to fit the output to one page.
- `immediatePrefs` — array of string preferences for this specific tailoring session.

**Processing pipeline:**
1. **Auto-selection (if no filepath given):** Calls `matchByKeywords()` from `src/lib/keywords.ts`. This function reads all `.docx` files in the user's resume directory, extracts their text via JSZip + XML parsing, computes a keyword coverage score against the JD's extracted keywords, and returns the top-ranked file. Visa flags (no H-1B, no sponsorship) in the JD are detected and can optionally exclude certain resume variants.
2. **Zone extraction:** `extractZones()` from `src/lib/docx.ts` parses the `.docx` XML to identify structural zones (headline, summary, skills sections, experience bullets). This is what allows Claude to make surgical edits without touching the document's formatting.
3. **Feedback retrieval:** `recentFeedback()` from `src/lib/feedback.ts` loads stored preferences for the resume's category (e.g. previous "don't use buzzwords" instructions).
4. **Claude call:** `adapt()` from `src/lib/claude.ts` sends a structured prompt to Claude Sonnet with all context: resume zones, JD, extracted JD keywords, and combined preferences. Returns structured edits as a typed object (`Edits`).
5. **Rewrite application:** `applyRewrites()` from `src/lib/docx.ts` applies Claude's edits back into the original XML, preserving all formatting, fonts, and layout. Returns the modified `.docx` buffer.
6. **Scoring:** Two match scores are computed — before and after tailoring — by measuring JD keyword coverage of the resume text. Raw scores are mapped to display bands (before: 72–86, after: 90–98) to represent the "tailored to strong fit" narrative.
7. **File save:** The tailored `.docx` is written to `data/tailored/<token>.docx`.

**Response:** `{ token, score, score_before, tier, matched, matched_on, ranked_candidates, what_changed, edits, notes, applied_feedback }`

---

### `GET /api/tailor/file`
Downloads a previously tailored file.

**Query params:** `token`, `fmt` (`docx` | `pdf` | `preview`), `name`

- `fmt=docx` — returns the raw `.docx` binary as a file download.
- `fmt=pdf` or `fmt=preview` — uses `mammoth` to convert the `.docx` to HTML and serves a styled print page. The page extracts the resume's own font family from `word/styles.xml` (via JSZip) so the preview uses the candidate's chosen typeface (e.g. Calibri, Garamond). A sticky toolbar shows a prominent "Download Word (.docx)" button, since the HTML preview is explicitly a simplified text copy — the Word file is the real deliverable.

---

### `GET/POST/DELETE /api/resumes`
CRUD operations on the user's resume library.

- `GET` — scans `data/user-resumes/<userId>/` recursively, returns all `.docx` files with metadata (filename, category derived from folder path, size, modified date, ID hash).
- `POST` — handles file upload. Accepts multipart form data with a `.docx` or `.zip` file. ZIP files are extracted (JSZip), and each `.docx` inside is saved to the appropriate subfolder. Duplicate detection: if a file with the same name exists, returns `{ duplicate: true, file }` instead of overwriting. The `replace=true` param forces overwrite.
- `DELETE` — deletes a specific file by `filepath`. Validates the path is within the user's allowed directory before deletion.

---

### `POST /api/resumes/move`
Moves a resume file to a different folder within the user's library. Creates the destination folder if it doesn't exist. Validates paths.

### `POST /api/resumes/folder`
Creates a new folder inside the user's resume directory.

### `GET /api/resumes/download`
Streams an original resume file as a download response.

### `GET /api/resumes/pdf`
Converts a resume `.docx` to an HTML preview using mammoth (same pipeline as `tailor/file`).

---

### `GET/POST /api/profile`
Manages the user's structured profile.

- `GET` with no params — returns the authenticated user's profile from the Supabase `profiles` table.
- `GET ?token=<token>` — extracts structured profile data from a tailored `.docx` file using `extractProfile()` from `src/lib/profile.ts`. This is used by the Chrome extension's auto-fill feature to get name, email, phone, LinkedIn URL, etc. from the tailored resume.
- `GET ?filepath=<path>` — same extraction but from an original resume file.
- `POST` — upserts profile data to Supabase.

---

### `POST /api/feedback`
Stores a user's tailoring preference for a specific resume category. Example: "avoid passive voice in bullets for Cloud Security resumes". Preferences are read back by `/api/tailor` on the next call for the same category, creating a self-improving tailoring loop. Stored in a JSON file per category in `data/feedback/`.

---

### `POST /api/assist`
Free-text AI assistant endpoint. Accepts a user prompt and optional context (current JD, resume text). Returns a Claude-generated response. Used for the in-app AI chat assistant.

---

### `GET /api/user-resumes`
Returns the list of resumes in the current user's directory. Shares logic with `/api/resumes` but is scoped to a specific authenticated user.

---

## 6. Core Library Modules

### `src/lib/docx.ts`
The most complex module in the project. Handles all `.docx` manipulation without using any Word processing library — pure XML surgery via JSZip.

**`extractText(buffer)`** — unzips the `.docx`, reads `word/document.xml`, strips XML tags, and returns plain text. Used for keyword matching and scoring.

**`extractZones(buffer)`** — parses the document XML to identify semantic zones: the headline/name block, contact line, summary paragraph, skills section, and individual experience bullets. Returns a structured `Zones` object with the raw XML fragments for each zone. This is what makes targeted AI editing possible — Claude only receives the zones it needs to edit, not the entire document.

**`applyRewrites(buffer, edits, zones)`** — takes the original buffer, Claude's `Edits` object, and the extracted zones. For each zone that has a corresponding edit, performs a string replacement in the XML using the original XML fragment as the search key and a newly constructed XML fragment (with the new text inserted) as the replacement. Returns the modified buffer and a list of notes about what was changed.

---

### `src/lib/claude.ts`
Calls the Anthropic API with a structured prompt. The prompt is carefully engineered to:
- Instruct Claude to make only surgical, targeted edits (not rewrite the entire resume).
- Pass JD keywords explicitly so Claude knows what terminology to incorporate.
- Apply user preferences from stored feedback.
- Return a structured JSON object (`Edits`) with specific fields for headline, tagline, summary, skills rewrites, and experience bullet rewrites.

**`resolveKey(userKey)`** — returns the user-provided Claude key if present, otherwise falls back to `process.env.ANTHROPIC_API_KEY`.

**`adapt({ key, jd, zones, preferences, jdKeywords })`** — the main tailoring function. Constructs the prompt, calls Claude, parses the structured response, and returns `Edits`.

---

### `src/lib/keywords.ts`
**`extractKeywords(text)`** — extracts technical keywords from a job description using a curated list of ~200 domain-specific technology terms (AWS, Kubernetes, Python, Splunk, OWASP, etc.) plus role-title patterns. Does not use an LLM — entirely regex/dictionary-based for speed.

**`matchByKeywords(jd, gcRestricted, userDir)`** — reads all resumes in the user's directory, extracts text from each, computes a keyword overlap score between each resume and the JD, and returns the best match plus the top 3 candidates with their scores and matched keywords. Also handles "identity hits" — if the JD explicitly names a technology the resume heavily features, that resume gets a score boost.

---

### `src/lib/profile.ts`
Extracts structured personal data from a resume `.docx` by parsing the text for patterns: name (first paragraph, title-case), email (regex), phone (regex), LinkedIn URL (regex), GitHub URL (regex), city/state location, job title. Returns a `Profile` object used by the Chrome extension's auto-fill feature and the user profile dashboard.

---

### `src/lib/feedback.ts`
Reads and writes tailoring preference files stored in `data/feedback/<category>.json`. Each file is an array of preference strings (e.g. "quantify achievements with specific numbers", "use active voice"). `recentFeedback(category, limit)` returns the most recent N preferences for a category, which are prepended to the Claude prompt.

---

### `src/lib/llm.ts`
A generic wrapper around the Anthropic API for non-tailoring LLM calls. Used by the AI assistant endpoint and profile extraction. Accepts a system prompt and user message, returns the completion text.

---

## 7. Chrome Extension

**Manifest Version:** 3 (current Chrome extension standard).

**Permissions:** `activeTab`, `tabs`, `scripting`, `storage`, `notifications`.

**Host permissions:** `http://localhost:3000/*`, `http://localhost:3001/*`, `https://careerkit.app/*`.

**Content script targets:** LinkedIn Jobs, Indeed, Glassdoor, ZipRecruiter, Dice, Greenhouse, Lever, Workday, SmartRecruiters, iCIMS.

---

### popup.html / popup.js — Extension Popup

**Design:** Matches the CareerKit dashboard light palette exactly. White background (`#ffffff`), blue accent (`#1d6fc4`), `#1a2035` text, `#e4e8ef` borders, 400px wide.

**Panels:**
1. **Setup panel** — shown when the CareerKit app is unreachable. User enters the app URL (`http://localhost:3000` default) and clicks "Connect". The extension pings `/api/health` to verify connectivity. On success, switches to the input panel.
2. **Input panel** — JD textarea, "⚡ Grab from page" button, character count (green when >200 chars), "✨ Tailor & Download Resume" button, progress bar with step-by-step messages during the API call. The auto-fill teaser ("Tailor first, then auto-fill any form") is shown here as a reminder.
3. **Result panel** — shown after a successful tailor call. Contains:
   - Score circle (SVG arc, coloured green/blue/amber based on score).
   - Resume name and category.
   - Score lift badge ("↑ N% better fit").
   - "What was updated" list.
   - Matched keyword chips.
   - Download buttons: Word (.docx) primary, PDF secondary.
   - "Open in Dashboard" wide button.
   - **"⚡ Auto-fill Application" button** — calls `/api/profile?token=<token>`, receives extracted profile data (name, email, phone, LinkedIn, etc.), then sends an `AUTOFILL` message to the content script to fill the current page's form fields.
   - "← Tailor another job" button.

**Connectivity check:** On popup open, pings `/api/health`. Also checks `chrome.storage.session` for a `pendingJd` key — if found (set by the floating button on a job page), pre-fills the JD textarea automatically.

---

### content.js — Content Script

**JD Scraping:** Site-specific selectors for each major job board, plus a fallback that finds the longest text block on any page. Responds to `SCRAPE_JD` messages from the popup.

**Auto-fill:** Responds to `AUTOFILL` messages with a profile object. Scans all visible, non-disabled, non-hidden form inputs on the page. For each input, builds a "hint" string from the element's `name`, `id`, `placeholder`, `aria-label`, `autocomplete`, and associated `<label>` text. Matches this hint against a keyword map covering: full name, first name, last name, email, phone, city/location, LinkedIn, GitHub, portfolio, job title. When a match is found, fills the field using the native `HTMLInputElement.prototype.value` setter (not direct assignment) and dispatches `input`, `change`, and `blur` events — this approach triggers React/Angular/Vue change detection so frameworks register the new values.

**Floating button:** Injected on all job board pages after 1.2 seconds. Styled as a white pill with a CareerKit blue logo badge, "Tailor Resume" text, and a "⚡ 12 sec" chip. Clicking it saves the scraped JD to `chrome.storage.session` and the popup auto-picks it up when opened.

---

### background.js — Service Worker

Handles two message types:
- `SAVE_JD` — writes the JD to `chrome.storage.session.pendingJd` (for popup pickup).
- `PING` — responds with `{ ok: true }`.
- `GET_JD` — forwards a scrape request to the active tab's content script (async, returns `true` to keep the message channel open).

On install, sets the default `appUrl` to `http://localhost:3000` in `chrome.storage.sync`.

---

## 8. Authentication Flow

1. User visits any `/dashboard/*` route.
2. `src/app/auth/callback/route.ts` handles the Supabase session cookie after OAuth.
3. Dashboard pages call `supabase.auth.getUser()` server-side. If no user is found, `userId` falls back to `"demo"` (auth gate is temporarily disabled for development browsing). In production, this would redirect to `/login`.
4. All API routes that touch user files use the same `user?.id ?? "demo"` fallback pattern.

---

## 9. Data Flows

### Resume Tailoring (complete flow)
```
User pastes JD → POST /api/tailor
  → matchByKeywords() finds best resume file
  → extractZones() parses resume XML structure
  → recentFeedback() loads stored preferences
  → adapt() calls Claude Sonnet with prompt
  → applyRewrites() inserts edits into XML
  → writeFile() saves tailored .docx to data/tailored/<token>.docx
  → returns { token, score, what_changed, matched_on, ... }
User clicks Download → GET /api/tailor/file?token=<token>&fmt=docx
  → readFile() reads the saved .docx
  → returns as binary download
```

### Chrome Extension Auto-fill (complete flow)
```
User clicks "⚡ Auto-fill" in popup
  → GET /api/profile?token=<token>
    → extractProfile() reads the tailored .docx text
    → parses name, email, phone, LinkedIn, location via regex
    → returns { profile: { full_name, email, phone, linkedin, ... } }
  → popup sends { type: "AUTOFILL", profile } to content.js
    → content.js iterates all form inputs
    → matches each input's label/name/placeholder to profile fields
    → sets value using native setter + dispatches input/change/blur events
  → popup shows "✓ Form fields filled!"
```

### Job Application Tracking (complete flow)
```
User adds application via "+ Add Application" modal
  → stored in localStorage["jd_applications_v2"] as JSON array
  → Kanban board re-renders from state
User moves card between stages
  → setApps() updates stage field in state
  → localStorage writes on every state change (useEffect)
Analytics page
  → reads same localStorage key on mount
  → computes all stats client-side (no server call)
```

---

## 10. Environment Variables

```
ANTHROPIC_API_KEY          ← Claude API key (fallback if user hasn't set their own)
NEXT_PUBLIC_SUPABASE_URL   ← Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY ← Supabase anon key
ADZUNA_APP_ID              ← Adzuna job search API app ID
ADZUNA_APP_KEY             ← Adzuna job search API key
GOOGLE_CLIENT_ID           ← Google OAuth client ID (for Gmail/Drive)
GOOGLE_CLIENT_SECRET       ← Google OAuth client secret
```

---

## 11. Key Design Decisions & Patterns

**No cloud storage for resumes.** All resume files live on the local file system. This is intentional — it means zero latency for file access, no storage costs, and the user's documents never leave their machine.

**Demo mode.** The `userId ?? "demo"` pattern lets every page function without login. All file operations fall back to a shared `data/user-resumes/demo/` folder. This makes the app immediately usable for development and demos.

**CSS variables over Tailwind for colour.** Every colour in the app is applied via CSS custom properties (`var(--accent)`, `var(--text)`, etc.) using inline styles. Tailwind is used only for layout utilities (flex, grid, padding, responsive). This creates a single source of truth for the design system and enables runtime theme switching.

**Inline styles trump class-based styles.** Inline `style` props have higher specificity than CSS classes. This was used intentionally to prevent the dashboard's CSS template from overriding the component-level styles — but it also means Tailwind's responsive utilities like `md:hidden` can be inadvertently defeated if `display` is set in an inline style. The mobile nav fix specifically separates visibility control (class) from layout control (inline style on a child element).

**Mammoth for DOCX → HTML.** mammoth is used only for the PDF preview, not for editing. Editing always goes through JSZip + raw XML to preserve exact formatting. mammoth with `styleMap` config preserves the heading hierarchy for readable print output.

**Score banding.** The raw ATS keyword coverage score is mapped to display bands (before: 72–86, after: 90–98) rather than shown raw. This ensures the UI always tells the "from good to great" story, avoiding demoralising scores for strong resumes that were already a decent match.

**Tailoring feedback loop.** The `/api/feedback` + `src/lib/feedback.ts` system creates per-category preference memory. Every thumbs-up/thumbs-down on the result page, plus free-text notes, is stored and automatically prepended to Claude's prompt on the next tailoring call for the same resume category.
