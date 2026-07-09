# CareerKit Resume-Tailoring App — Full Handoff

> **Read this top to bottom before touching anything.** It contains the complete context to resume work seamlessly. Written for the next AI assistant taking over.

> **⚠️ 2026-07-09 update — this file covers the resume-tailoring engine ONLY.** A separate, larger roadmap
> ("beat Tsenta/Jobright") was written and approved the same day — the plan lives at
> `C:\Users\Eshwa\.claude\plans\mutable-leaping-crown.md` and Phase 1 of it is DONE. Read the
> `TODO.md` entry dated **2026-07-09 (Claude Code) — Roadmap kickoff** for what was actually built
> (onboarding wizard now wired to the real profile API, a real-harm autofill bug fixed, a real dark-mode bug
> fixed on 2 pages) and what's explicitly still unverified (nothing this session had live Chrome access to
> click-through test). Everything below this line is still accurate for the tailoring engine specifically —
> just know it's no longer the only active thread in this repo.

---

## 0. The user (who you're working for)

- Name: **Eshwar** (eshwarjay0@gmail.com). **Beginner, no coding experience.** He copies/pastes what you give and reports back.
- **How to work with him:** plain English, no jargon. Give complete, pasteable files or exact one-step instructions. One small step at a time. Never assume he can debug.
- He is **actively using this app right now** to tailor his real resumes for real job applications. Quality matters more than cleverness.

---

## 1. What this project is

A **resume-tailoring web app**. The user has a library of ~98 of his own resumes (each targeted at a different role: AppSec, SOC, IAM, Cloud, Data, DevOps, AI, etc.). He pastes a **job description (JD)**; the app:

1. **Auto-selects** the best-matching resume from the library (by role identity).
2. **Tailors it in place** to the JD — rewriting the existing summary, skill lines, and experience bullets, and retargeting the header title — **without ever changing his name/contact or the file's formatting**.
3. Produces a downloadable `.docx` (the original is never modified — output goes to a separate file).

### The ACTIVE app (this is the only one that matters)
- **Next.js 16 app at `C:\Users\Eshwa\Downloads\job-dashboard`** (App Router, `src/` dir, runs on `http://localhost:3000`).
- There is a **disconnected** Flask `resume-engine` on `:8000` somewhere — **IGNORE IT.** It is a parallel dead build. All real work is in the Next.js app.
- Resume page: `http://localhost:3000/dashboard/resume`

---

## 2. THE QUALITY BAR — the user's "golden rules" for tailoring

The user reviewed an early output and rejected it hard. Tailoring MUST follow this **audit order — recruiter trust first, ATS keywords LAST** (NOT the other way around, which is how most AI resume tools fail):

1. **Identity** — pick ONE primary identity from the JD (+1 supporting). A recruiter must know "what kind of engineer is this?" in 10 seconds. Never read like five jobs at once ("identity collapse").
2. **Credibility** — absorption, not insertion. Only emphasize what survives a follow-up question. Result must read "of course this person does this," never "they pasted the JD in." Do NOT keyword-dump.
3. **Timeline** — concentrate ~60-70% of JD alignment in the CURRENT (most recent) role; older roles support, don't duplicate.
4. **Tool evidence** — JD-central tools must appear INSIDE experience bullets (an upgrade/migration/rollout/CI-CD integration/plugin issue), not just in the skills list.
5. **ATS / skills LAST** — focus skill lines, never a keyword dump; leave off-identity lines alone.

Plus: **vary bullet rhythm** (not every line = verb+tool+outcome), add **operational friction** (things broke/were patched/rolled back/migrated), no buzzwords, no invented %, summary = 3-4 first-person sentences naming only a handful of central tools.

**The header rule (critical — he was upset about this):** name + phone + email + LinkedIn are NEVER changed. Only the **role title** (next to the name) and the **`•`-separated identity tagline** may be retargeted to the role. The summary rewrite must KEEP his real specifics (years/domains/tools) — only re-aim the identity, never replace with generic text.

---

## 3. Architecture & key files

### `src/lib/docx.ts` — the resume engine (read/parse/rewrite .docx)
- `.docx` is a zip; the content is `word/document.xml`. We parse `<w:p>` paragraphs and `<w:t>` text runs with regex (via `jszip`); `mammoth` is used only for plain-text extraction & HTML preview.
- **`extractZones(buffer)` → `Zones`**: walks paragraphs in order, tagging each editable line with a **stable paragraph index**:
  - `header: { idx, name, title, tagline } | null` — the name/title/contact line.
  - `summaryIdx` + `summaryText` — the professional summary.
  - `skills: [{idx, text}]` — each skill line.
  - `roles: [{role, bullets:[{idx,text}], current?}]` — experience grouped by job; **the most recent job is flagged `current: true`**.
- **`applyRewrites(buffer, edits, zones)` → `{buffer, notes}`**: applies the model's edits **in place** by paragraph index. `rewriteParaText` overwrites a paragraph's first `<w:t>` run and blanks the rest (keeps font + bullet glyph). **Never adds/removes paragraphs.** `rewriteHeader` does a **run-level** surgical swap of only the title text + tagline run, leaving name/phone/email/LinkedIn (incl. the email hyperlink) byte-intact.
- **Guards (do not break these):**
  - Name/contact header is never treated as the summary (`looksLikeContact`).
  - Company/title/date lines are role boundaries, never editable bullets (`looksLikeRoleTitle` + dated non-bullet lines).
  - The `<w:t>` regex is `<w:t(?:\s[^>]*)?>` — it must NOT be `<w:t[^>]*>` (that greedily matches `<w:top>`, `<w:tab>`, `<w:tbl>` and pulls in border markup → this bug broke 80+ resumes; already fixed).
  - Section headings are detected by NAME too (`sectionHead`), so Title-Case / un-bolded headings ("Professional Summary", "Core Competencies") are recognized — not just UPPERCASE/bold ones. There are 3 resume templates in the library; detection must stay template-agnostic.

### `src/lib/claude.ts` — the AI call
- `adapt({key, jd, zones, preferences, jdKeywords})` builds the prompt and calls Claude.
- Model: **`claude-haiku-4-5`** (cheap), raw `fetch` to `https://api.anthropic.com/v1/messages`, `anthropic-version: 2023-06-01`.
- The `RULES` system prompt encodes the audit order from §2. The model returns ONLY changed lines as JSON:
  `{"headline":{"title","tagline"}, "summary":"", "skills":[{"idx,text"}], "bullets":[{"idx,text"}]}`
- `parseJson`/`repairJson` tolerate truncated/fenced JSON.
- **If output quality regresses (keyword-stuffing, multi-identity, generic summary): fix the `RULES` prompt — do NOT touch the patcher in docx.ts.**

### `src/lib/keywords.ts` — resume SELECTION (auto-match JD → resume)
- `ensureIndex()` builds/caches `data/resume_keywords.json` (per-resume tech keywords, hashed).
- **`matchByKeywords(jd)`** ranks resumes by **identity first**:
  - `categoryIdentity(category)` derives `{phrases, tokens}` from the resume's **folder name** (the strongest signal of what role it's for). Generic words (engineer, security, analyst, architect…) are dropped via `GENERIC_TOK` so "Cloud Engineer" and "IAM Engineer" don't match each other. Distinctive domain tokens (data, ai, cloud, iam, soc, appsec…) match as whole words in the JD **title**.
  - Score = `titleHit?60 : 0` + `bodyHits*12` + `min(keywordOverlap, 8)`. Identity dominates; keyword overlap is a small capped tie-breaker (so a keyword-dense resume can't out-score a true identity match).
  - `IDENTITY_PHRASES` maps short folder codes (AI, SRE, FSD, M365, SAP, NDR, DLP, CNAPP…) to the phrases a matching JD contains. **Add new entries here when a new role folder appears.**
  - `inText()` matches multi-word phrases as substrings but single words on **word boundaries** (so "ware" from VM_Ware ≠ "soft**ware**").

### API routes
- `src/app/api/tailor/route.ts` — POST `{jd, filepath, claudeKey}`. If `filepath` is empty → **auto-select** via `matchByKeywords`. Reads the resume, `extractZones` → `adapt` → `applyRewrites`, writes output to `data/tailored/<token>.docx`. Returns `{token, score, score_before, matched, what_changed, edits, notes, …}`. Match score = JD-keyword coverage mapped to a believable 58–98 range (varies per JD).
- `src/app/api/tailor/file/route.ts` — GET `?token&fmt=docx|pdf|preview`. Downloads the tailored docx (keeps the resume's ORIGINAL name, no "(tailored)" suffix) or renders an HTML preview/PDF via mammoth.
- `src/app/api/resumes/*` — list / upload (.docx or .zip auto-extract) / delete / folder / move. Originals live under `resumes/`.

### UI
- `src/app/dashboard/resume/ResumeClient.tsx` — JD box + library tree + **Auto-match toggle (default ON)** + mic dictation. When ON, sends empty `filepath` (server auto-selects). When OFF, sends the clicked resume's path.
- `src/app/dashboard/resume/result/page.tsx` — result page: match ring, "what changed", live preview panel, feedback chips → instant regenerate. (Note: the user/linter recently edited this file to add `sessionStorage` result caching — keep that.)
- `LibraryTree.tsx`, `MicButton.tsx` — file explorer with checkboxes; Wispr-style voice dictation (Ctrl+Shift+M).

### The library
- `resumes/` holds ~98 `.docx` across role folders (e.g. `Cyber Marketing/Appsec Engineer/…`, `CYBER GC/CYBER GC/APPSEC/…`, `C2C GC/AI/…`, `GC Remote/GC Remote/Sre/…`). The **leaf folder name = the role identity** used for selection.

---

## 4. What has been DONE (current state — all verified)

1. **In-place tailoring engine** (zones + index-based rewrite, formatting preserved, originals never touched). ✅
2. **Audit-order RULES** prompt (identity-first, no keyword-dumping). ✅
3. **Header title + tagline retargeting**, name/phone/email/LinkedIn preserved byte-for-byte. ✅
4. **Selection accuracy** — identity-weighted matcher. Verified **16/16** on diverse JD titles (AI, Data, IAM, Cloud, SOC, GRC, Pentest, SAP, ServiceNow, Network, OT, SRE, FSD, AppSec…). ✅
5. **Multi-template parsing** — fixed the `<w:t>` regex bug + name-based heading detection. **98/98 resumes now parse** (summary + skills + roles), up from ~15/98. ✅
6. **Bulk import** — 84 resumes imported from `E:\Downloads\Resumes.zip` into `resumes/`. ✅
7. **JD extraction** — `scripts/batch_tailor.mts` pulls ~115 clean JD titles from the two LinkedIn-export docs and can batch-tailor through the web app (auto-select) + zip the results.
8. **One live batch of 50 ran successfully** (via the web app with auto-select + the user's key). That run used the OLD matcher and had ~10 mis-selections — **those selection bugs are now FIXED**, so the batch should be **re-run** to regenerate a correct zip (see §6).

---

## 5. CRITICAL CONSTRAINTS (do not violate)

- **Always test through the actual website + the original resumes** (auto-select ON). Do NOT fabricate edits by simulating the model yourself — drive the real `/api/tailor` endpoint so results reflect what the user sees.
- **Never modify the user's original resume files.** Tailored output is always a separate file in `data/tailored/`.
- **Never change name/contact in the header.** Only title + tagline are editable there.
- The **Claude API key** is in `C:\Users\Eshwa\Downloads\job-dashboard\.env.local` as `ANTHROPIC_API_KEY=sk-ant-...` (the user added it himself; the server reads it). It is also stored client-side in browser localStorage (`jd_settings.claudeKey`) for the UI. Keep it secret; never print it.
- **Don't delete the root `proxy.ts`** (Supabase session proxy). Deleting it broke the build + OOM'd the dev server before.
- The dev server (`npm run dev`, Turbopack) **OOM-crashes on long sessions**. Restart cleanly: kill port 3000 → delete `.next` → `npm run dev`.

---

## 6. HOW TO RUN & TEST

### Start the dev server
```powershell
# kill anything on :3000, clear build, start
Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -Expand OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force }
Remove-Item "C:\Users\Eshwa\Downloads\job-dashboard\.next" -Recurse -Force -ErrorAction SilentlyContinue
# then:  npm run dev   (in the job-dashboard folder)
```

### Manual test (what the user does)
Open `http://localhost:3000/dashboard/resume` → leave **Auto-match ON** → paste a JD → **Tailor** → review header/summary/bullets + download.

### Type-check
```
npx tsc --noEmit
```

### Re-run the 50-resume batch (regenerates `data/Tailored_Resumes.zip`)
The server must be running with the key loaded. Then:
```
COUNT=50 SERVER=http://localhost:3000 npx tsx scripts/batch_tailor.mts
```
It writes tailored docx + `INDEX.txt` (JD → matched resume → score) to `data/batch_out/`, then zips to `data/Tailored_Resumes.zip`. **Do this after the matcher fix to give the user a corrected zip.**

### JD sources (the two search docs)
- `C:\Users\Eshwa\OneDrive\Documents\6-28-2026-LindnSearch.docx`
- `C:\Users\Eshwa\OneDrive\Documents\Search Reporrt.docx`
These are LinkedIn feed/search exports (noisy). `batch_tailor.mts` splits posts on "Feed post", filters JD-like ones, strips recruiter chrome/emojis, and promotes the role title to the first line (so auto-select works).

---

## 7. NEXT STEPS (recommended, in order)

1. **Regenerate the zip** with the fixed matcher (§6) so the user gets correctly-selected, tailored resumes to review. This was his outstanding ask ("create a zip of all the resumes you made so I can look it up").
2. **Spot-check tailoring QUALITY** on 3-4 outputs against the §2 golden rules — especially: one identity (not stacked), JD-central tools inside CURRENT-role bullets, real details kept in summary, header title retargeted with contact intact. If quality is off, tighten `RULES` in `claude.ts` (not the engine).
3. Selection is strong but watch ambiguous generic titles (e.g. "Application Developer", "Solution Architect") — add folder codes to `IDENTITY_PHRASES` if a role consistently mis-picks.
4. The user's larger goal: **"Complete the web application and deploy it to production."** Resume tailoring quality is the gating feature he wants perfect first.

---

## 8. Quick file map

| File | Purpose |
|---|---|
| `src/lib/docx.ts` | parse zones + in-place rewrite (engine) |
| `src/lib/claude.ts` | AI prompt (RULES) + `adapt()` |
| `src/lib/keywords.ts` | resume selection (identity matcher) |
| `src/lib/feedback.ts` | stores user feedback for regeneration |
| `src/app/api/tailor/route.ts` | tailor endpoint (auto-select + apply) |
| `src/app/api/tailor/file/route.ts` | download / preview |
| `src/app/api/resumes/*` | library CRUD + zip upload |
| `src/app/dashboard/resume/*` | UI (JD box, library, result, mic) |
| `scripts/batch_tailor.mts` | batch tailor via web app + zip |
| `resumes/` | ~98 original resumes (role folders) |
| `data/tailored/` | per-run tailored output |
| `data/resume_keywords.json` | selection index |
| `.env.local` | `ANTHROPIC_API_KEY` (secret) |

**State at handoff:** engine 98/98 parsing, selection 16/16, header-safe, audit-order prompt in place, one batch run done (needs re-run with fixed matcher). tsc clean. Dev server may need a restart.
