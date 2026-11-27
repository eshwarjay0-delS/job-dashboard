# Resume — Master Vision

*Draft captured 2026-10-17 from the owner's existing product. Owner to review and correct — this is the starting point, not the final word.*

## The one-liner

Your resume, fitted to every job and filed in one place — built once, tailored forever.

## What Resume is

The resume workshop inside MarketFit: build it, format it, fit it to each job description, and keep every version filed. The resume is never a static document here — it's a living profile that reshapes itself per application.

## Pillars

### 1. Build

- **Make Resume**: build a resume one part at a time — guided, section by section, no blank-page fear.
- **Resume Formatting**: take an existing resume and turn it into the approved professional format. Structure and polish, not rewriting history.

### 2. Fit (tailoring)

- Every resume can be **fitted to a job description**: keywords, skills, and experience re-weighted to what the JD asks for — without inventing anything the user hasn't done.
- **WhatsApp flow**: send a job post + your resume, get back a resume fitted to that job. The fastest tailoring loop in the product.
- The quality baseline is documented (`docs/resume-quality-baseline.md`) — tailoring must never drop below it.

### 3. File

- **Files**: every resume version kept in one place, labeled by job/role/date. When a recruiter asks "send your latest," the answer is one tap.
- Versions are never lost: each tailoring creates a new filed version, never overwrites the baseline.

## How it connects

- **Apply tab**: at apply time, the user picks a filed resume or generates a JD-tailored one on the spot (Apply vision, pillar 3).
- **Kompas**: the dossier feeds on filed resumes — real project history grounds interview answers.
- **Gmail**: the agent attaches the right resume version to submissions and drafts.

## Standing rules (never break)

- **95–100% JD match, undoubtedly.** Every tailored resume reports its measured JD keyword coverage — WhatsApp caption, web result headline — and repair passes climb toward the 98% target. Below 95%, the result says so plainly.
- **Tailoring re-presents; it never fabricates.** No invented metrics, platforms, certifications, or backdated experience. Honest gaps are listed (tap-to-add), never faked.
- There is no single resume — there's the right resume per job.

## Credential-target regression — 20 October 2026

The 19 October instruction to ignore certifications as tailoring targets is retained. The classifier now recognizes terminal-plus credential names and Salesforce Platform Developer I/II and CPQ Specialist without a Certified prefix. Unsupported credentials are removed from rewritten skills; original credentials remain. Evidence: `docs/research/credential-target-boundaries.md`. Live generation acceptance remains pending.

## Rewrite completeness — 20 October 2026

Overall keyword overlap cannot hide thin experience coverage. Every substantive role with supported requirements must reach the shared target before the result is complete or cacheable; roles with no supported requirement are not padded. Evidence: `docs/research/resume-per-role-completion.md`.

The web result shows unfinished rewrite status separately from keyword counts, including when all terms appear. The shared quality report preserves its incomplete flag. Older saved delivered-with-gaps reports receive a general review notice without inventing a specific failure reason. No scoring or delivery threshold changes. Evidence: `docs/research/resume-incomplete-notice.md`.

High keyword overlap does not make unfinished role rewrites complete. Partial outputs can retain the existing 95% delivery-floor behavior, but never receive completed status or enter the completed-result cache. Cache generation 15 invalidates older completion classifications without deleting resumes. Evidence: `docs/research/resume-completeness-cache.md`.

## Skills-to-experience ordering — 22 October 2026

The final generation stage must be experience repair, not Skills keyword placement. A source audit found that leftover terms were appended to Skills after `fillGaps` had finished, creating new per-role requirements with no later opportunity to write the corresponding client bullets. The shared web/WhatsApp pipeline now places the supported target vocabulary first, then repairs each relevant role against that complete set. This preserves the standing rule that keywords must be developed into action, context, and purpose/result—not merely listed. It does not convert a JD into evidence or permit invented qualifications. Evidence: `docs/research/resume-skills-experience-ordering.md`.

## Confirmed-keyword boundary — 22 October 2026

The complete cleaned JD plus Gemini set remains the measured target, but deterministic keyword placement and mandatory role repair cannot use the JD as proof of experience. They may force a term only when it appears in the baseline, an explicit candidate statement, or the candidate explicitly confirms experience with every listed requirement. “Add every keyword” is an editing instruction; “I have experience with every required skill” is evidence. Unsupported requirements stay visible as gaps rather than fabricated biography. Evidence: `docs/research/resume-confirmed-keyword-boundary.md`.

## Actual counts and weighting — 20 October 2026

Matched-term counts must come from the exported document, not a weighted percentage converted into an integer. Weighted coverage remains separate; both measures must meet the existing acceptance thresholds. Cache generation 16 supersedes generation 15 while retaining its incomplete-rewrite safeguard. Evidence: `docs/research/resume-score-counts.md`.

## Confirmation priority — 20 October 2026

Explicit candidate input precedes the pasted JD in bounded enrichment context. Long job descriptions must not crowd out confirmed experience or its employer restrictions. Cache generation 17 retains earlier safeguards and invalidates older context construction. Evidence: `docs/research/resume-confirmation-priority.md`.

## Display precision — 20 October 2026

Deployment confirmed through Vercel success for `16ff135`, after the Chief workstream corrected the incompatible cron cadence. The earlier blocked release status is superseded; fresh authenticated generation and download acceptance remain pending.

Shared result scores, keyword analysis, notes and the web match ring retain one decimal, truncated rather than rounded into a threshold. 94.9% must not appear as 95%; 97.9% must not appear as 98%; a noncomplete match must not appear as 100%. Acceptance still uses unrounded ratios. Cache generation 18 supersedes 17 so new requests do not reuse rounded result fields. Existing saved documents are not rewritten. Evidence: `docs/research/resume-display-precision.md`.


## Release reconciliation — 20 October 2026

Salesforce title recognition is being validated for baseline selection. Salesforce/SFDC developers must enter the title-matched pool; administrators remain a different role. See `docs/research/salesforce-role-selection.md`. The coding environment is available again; the earlier outage below is historical, not a current blocker.

Release verified 20 October: Vercel success for e78f4ed at https://vercel.com/qu4ntum-s-projects/job-dashboard/37h42KSxgw9JYgHk6z1QTyLLT2M6 and follow-up 7cf73fc. Execution environment unavailable in this check; no tests rerun or new runtime implementation. Restore a usable coding environment for further changes; authenticated browser/output acceptance remains pending.


## Synthetic public regression fixtures — 15 November 2026

Source-controlled WhatsApp resume tests must use synthetic candidate names, distinct `example.test` email addresses, and fictional phone numbers in the reserved 555-0100 through 555-0199 range. Do not embed private resume text, account identifiers, contact details, private filenames, or archive paths in public fixtures. Preserve cross-account test distinctions with different synthetic identities. The privacy regression is `scripts/tests/whatsapp-fixture-privacy.test.mjs`; passing it is source hygiene, not proof of live WhatsApp delivery or resume quality.


## Final-DOCX Gemini feedback boundary — 26 November 2026

The direct 3 November owner wording asks Gemini exactly `Give me ATS score` for feedback and asks which JD keywords are missing or weak so corrections can be considered. This approves the score/feedback and keyword-identification stage. It does **not** establish approval for automatic correction, re-export or recheck. The broader automated loop remains proposed until direct owner approval is recovered. Keep the ATS score and suggestions diagnostic only; candidate experience still requires the source resume or explicit candidate confirmation. This does not change the 95–100% factual-match goal or authorize unsupported claims. PR #417 is the score-only first-stage draft; no real Gemini call or exported-DOCX acceptance is claimed.


## Confirmed-skill attribution and placement review — 27 November 2026

The owner-approved rule remains narrow: an explicit candidate confirmation may support the named skill in relevant existing project bullets across roles, but it cannot create a new employer, project, action, outcome, title, date, location, contact, metric or credential. The JD is target context, never candidate experience. Gemini ATS score/feedback and missing/weak keyword identification are approved; automatic correction, re-export and recheck are not.

Master-based restack PR [#595](https://github.com/eshwarjay0-delS/job-dashboard/pull/595) has all five exact-head gates green, but remains DRAFT/non-mergeable pending a clean restack, protected preview, and owner-authorized resume/JD/confirmation plus exported-DOCX inspection. Static review COMMENT 6082791060 found that a sentence such as “I used AWS, and my team used GCP” can be retained as one candidate statement, incorrectly treating the team's GCP experience as the candidate's. The parser needs attribution regressions for team, colleague, client and organization clauses. Existing unresolved review thread 4713559321 also identifies a deterministic placement gap: a confirmed skill absent from original bullets can be allowed by the prompt/guard but is not a deterministic role-gap weave candidate.

PR #591 remains fail-closed and DRAFT; durable explicit same-account Files/Library selection is still absent from the actual WhatsApp route/session fallback. The 17 Oct 17:28 Chicago delivery remains unverified. No candidate bundle, model call or exported DOCX was processed here. The web 95% floor remains; 98% is a target, not a claimed live match.


## 27 November 2026 — run 22 review status

PR #598 exact head 58c10bad has all five remote gates green (focused regression 56/56). Static COMMENT review 6083779719 found a passive-attribution false positive for clauses such as `I used AWS and GCP was used by others`; add negative tests before merge. The PR remains unmerged/un-deployed pending correction, independent review, protected preview, owner-authorized resume/JD/confirmations and exported-DOCX inspection. No real bundle, model call, DOCX or live ATS percentage was produced.


## 27 November 2026 — run 22 follow-up

Static review comment 6083779719 found that passive attribution by `others` or external actors could bypass the candidate-confirmation splitter. Source commit 141590c8c5acf45bf56131b46325a3474cc180c broadens the passive actor matcher and commit 1b2a68fa8dfec01e226a68e6f9ed88f8b713a42d adds six negative regressions, preserving the ordinary candidate AWS/GCP list. Exact-head focused/full/WhatsApp recovery runs are still in progress; baseline/schema checks passed. No local execution or real resume/JD/DOCX acceptance.


## Run 22 follow-up — bare passive contractor attribution (27 November 2026)

PR #598's new passive actor guard still has a narrow source-matcher gap. Isolated simulation shows `I used AWS and GCP was used by contractors` and `I used AWS and GCP was handled by subcontractors` remain unsplit, so GCP may be retained as candidate-confirmed experience. COMMENT review 6083882072 requests negative cases and fail-closed attribution splitting while preserving the preceding `I used AWS` claim and normal candidate lists such as `I used AWS and GCP`. This is not a repository test. PR #598's all five exact-head gates, including full CI 45945333802, are now SUCCESS; the newly posted COMMENT 6083882072 identifies a bare plural passive actor bypass not covered by that suite. Keep it unmerged pending parser/test correction, fresh exact-head gates, independent review, protected preview and real exported-DOCX acceptance.

## Run 22 implementation follow-through — passive attribution (27 November 2026)

PR #598 branch code commit `583ed9ce5ac900eabce542b398fe26b9855706cb` expands passive actors; test commit `bfc35f6a637c101c0c19a3537ddaba57fe8d9745` adds nine negative cases for bare contractors/subcontractors, consultants, vendors, clients, colleagues and external/outside/third-party phrases. Isolated matcher simulation passed the nine negatives and ordinary AWS/GCP positive. Exact head `bfc35f6a` has Plan/REA schema and Kompas baseline SUCCESS; focused/full/WhatsApp recovery are still IN_PROGRESS. PR #598 is DRAFT. No local repository tests, real resume/JD, model call or DOCX export was performed. Keep unmerged pending exact-head CI, independent review, protected preview and authorized DOCX acceptance.