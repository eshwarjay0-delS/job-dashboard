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


## WhatsApp delivery safety and evidence — 23 November 2026

The 95–100% match remains the product goal and web-download floor; 98% is a target, not proof. WhatsApp retains its separate delivery policy: a complete, readable DOCX below 95% raw overlap may still be sent with gaps disclosed. A clean 70–94.9% pass requires at least 95% supported coverage and all identity, role-completeness and DOCX integrity checks. Below 70% is not a clean pass, but an otherwise complete, readable result may still be sent with gaps disclosed; the 19 November fallback correction does not change this existing raw-overlap behavior. Incomplete, failed, skills-only, unreadable or identity-mismatched rewrites are not sent as tailored files; fallback is only the explicitly selected same-account Files/Library resume with the exact label **Original resume — NOT TAILORED**. Unverified JD-only additions are a hard hold, never a deliverable shortfall.

An unchanged fallback is permitted only when the user explicitly names a same-account Files/Library resume and the durable recovery record proves that exact selection. The caption must be exactly **Original resume — NOT TAILORED**. No automatic closest-match substitution, no fresh-upload original fallback, no fallback when selection is absent/stale or account ownership cannot be proven, and no resending a prior baseline after identity/contact/date verification fails. Historical 27 October closest-match wording is superseded by the 19 November correction.

The current source/test restack is PR #557, based on the approved Kompas #554 branch. Its exact-head remote CI and WhatsApp recovery checks, independent review, protected preview, production READY alias and authenticated acceptance remain pending. The 17 October 2026 17:28 Chicago delivery remains unverified until the exact output DOCX, per-run R2 object/version, webhook correlation, Meta outbound message ID and signed delivery/read receipt are available. No replay or real send has been attempted.

## Current-master WhatsApp fallback continuation — 24 November 2026

PR #572 is the current approved candidate, directly based on canonical master 794e8cf. It preserves the 19 November correction: only a user-named same-account Files/Library resume can be sent unchanged, with the exact label Original resume — NOT TAILORED. The durable recovery record must bind the sender, verified account, JD, resume path and explicit selection; the account-owned root, relative/absolute selected path and profile email are checked, and selected bytes must equal the run input. The resume must contain exactly one matching profile email. Automatic relevance picks and fresh uploads cannot become unchanged fallback. Unsupported JD-only additions remain a hard hold. The completed-readable below-70% disclosed-shortfall behavior is not changed.

Current PR #572 head is 590670a408cca9ce58c594dd0ca3cc72edaead98, DRAFT and not deployed. Exact-head Kompas baseline and Plan/REA checks passed (45306446969 and 45306447013); full CI (45306447006) and WhatsApp recovery (45306447034) were still running at the latest check. The preceding exact head's full CI passed lint/type-check but failed the shared Kompas VM suite because four test harnesses lacked answerCtl/detectedQueue; the independent PR #554 owns the combined fixture and Listening-hold repair and awaits a second authorized reviewer. Do not copy or merge those changes to bypass review.

The production alias remains on master 794e8cf. No local checkout or installed Next.js 16.3.8 docs are available in this runtime; further route edits must wait for an approved environment with the installed package guide. No real WhatsApp send, DOCX, R2 write, Meta receipt, historical replay or handset acceptance occurred. The 17 October 2026 17:28 Chicago incident remains unverified; the exact output DOCX, per-run R2 object/version, request correlation, Meta outbound ID and signed delivered/read receipt are still missing.
