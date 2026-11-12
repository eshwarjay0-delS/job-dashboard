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

- **Use channel-specific acceptance, with truthful evidence.** Web downloads retain a 95% raw JD-overlap floor. WhatsApp may send a completed, readable DOCX below 95% with gaps disclosed; a clean 70–94.9% pass requires at least 95% supported coverage. A finished result below 70% is not a clean pass but may still be sent with gaps disclosed. For an initial JD request with no AI provider key, only the exact selected same-account library original may be sent, explicitly labeled NOT TAILORED after verifying the authenticated library root, selected path, exact bytes and profile email; otherwise no file. For swipe-reply refinement, provider failure, partial or incomplete output, unreadable or missing DOCX, or identity/date mismatch is text-only: never send the original or partial baseline, and preserve the last delivered version. The 98% figure is an evidence target, not a hard WhatsApp send threshold. Report raw overlap, supported coverage, role completeness and final-DOCX integrity separately.
- **Tailoring re-presents; it never fabricates.** No invented metrics, platforms, certifications, or backdated experience. Honest gaps are listed (tap-to-add), never faked.
- There is no single resume — there's the right resume per job.

## Credential-target regression — 20 October 2026

The 19 October instruction to ignore certifications as tailoring targets is retained. The classifier now recognizes terminal-plus credential names and Salesforce Platform Developer I/II and CPQ Specialist without a Certified prefix. Unsupported credentials are removed from rewritten skills; original credentials remain. Evidence: `docs/research/credential-target-boundaries.md`. Live generation acceptance remains pending.

## Rewrite completeness — 20 October 2026

Overall keyword overlap cannot hide thin experience coverage. Every substantive role with supported requirements must reach the shared target before the result is complete or cacheable; roles with no supported requirement are not padded. Evidence: `docs/research/resume-per-role-completion.md`.

The web result shows unfinished rewrite status separately from keyword counts, including when all terms appear. The shared quality report preserves its incomplete flag. Older saved delivered-with-gaps reports receive a general review notice without inventing a specific failure reason. No scoring or delivery threshold changes. Evidence: `docs/research/resume-incomplete-notice.md`.

High keyword overlap does not make unfinished role rewrites complete. Partial or incomplete outputs are held; they never receive completed status or enter the completed-result cache. The 6 November channel policy supersedes the former 95% WhatsApp delivery floor: completed readable DOCX files below 95% may be sent with gaps disclosed; 70% raw overlap plus 95% supported coverage defines a clean pass, and a completed readable result below 70% is not a clean pass but may still be sent with gaps disclosed. Cache generation 15 invalidates older completion classifications without deleting resumes. Evidence: `docs/research/resume-completeness-cache.md`.

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


## 12 November 2026 — role-scoped evidence release status (06:53 UTC) <!-- resume-evidence-recheck-0653z -->

PR #317 is the current-master restack of the approved resume/JD/confirmed-experience changes. Exact head `f3182de28fb229401e30893d7687805e55c846e7` passes full CI `43164222540`, WhatsApp recovery `43164222577` and Kompas baseline `43164222576`. Protected preview remains blocked by the missing private `KOMPAS_VERCEL_API_TOKEN` and Vercel project `live=false`; keep the PR DRAFT and unmerged.

The implementation keeps employer-specific bullets inside that employer's source evidence, allows general first-person confirmations to support profile/skills only, restores a whole bullet when its JD term is unsupported by the same role, and preserves visible gaps rather than inventing experience. No threshold was lowered. A green source/build suite is not a live 98% resume match; no live model generation, personal DOCX creation or WhatsApp send was performed.

**Continue:** after legitimate protected preview access is restored, review and merge the exact green PR head, then separately evaluate an authorized real resume/JD pair and the final exported DOCX. Keep unverified employer attribution, dates, credentials and metrics out of the resume.

## 12 November 2026 — owner-confirmed skills may map into existing projects

The owner’s 6 Nov 2026 9:55 AM CT correction, already recorded in journal entry `whatsapp-constructed-jd-finish-2026-11-06` and reaffirmed in PR #319 comment 6817645128, is authoritative: an explicit first-person confirmation of a JD skill may be mapped naturally into relevant existing project bullets across roles, including earlier roles, even when that role’s original bullet does not name the tool. Employer-source verification is not an additional prerequisite for that confirmed skill. This supersedes the narrower role-only restriction described in the earlier PR #317 restack notes; the old decision remains in the journal for history.

The confirmation authorizes the skill only. It does not authorize a new employer, project, action, outcome, title, location, date, contact, metric or credential, and it does not permit mixing another account’s resume/profile. JD wording, a target score or an editing instruction alone is not confirmation. The selected resume’s existing project context and frame remain intact. Conflicting education, employment chronology, tenure and credential facts from the historical 17 October source DOCX remain quarantined pending owner reconciliation.

PR #317 branch `fix/resume-role-evidence-restack-da1db145-20261112` was updated through code commits `dfcd2b4`, `14ac764`, `216581d` and `2851eaa`: the writer prompt now permits explicitly confirmed skills in relevant existing project bullets; the deterministic guard allows only those confirmed terms across roles while continuing to reject unconfirmed cross-role terms; role-alignment counts a confirmed term only when it appears in that role’s edited bullets. Exact-head full CI, WhatsApp recovery and Kompas baseline are pending for the updated head. Protected preview remains blocked by the missing private `KOMPAS_VERCEL_API_TOKEN`; the PR remains DRAFT, unmerged and undeployed.

No live model call, personal DOCX generation, WhatsApp send, R2 write or real handset acceptance occurred. This source/prompt change is not a live ATS score or proof of the historical 17 October delivery.
